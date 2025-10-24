import { elevenLabsClient } from "@/lib/elevenlabs-api";
import { findIntegrationToken } from "@/lib/integration-tokens";
import { getBackgroundWorkerAgentId, julepClient } from "@/lib/julep-client";
import { logger } from "@/lib/logger";
import {
	type AstraUser,
	type ElevenLabsConversation,
	getElevenLabsConversations,
	getUsers,
	type UserOverview,
} from "@/lib/mongo";
import { loadTaskDefinition } from "@/lib/tasks/loader";
import { resolveTimezoneForCountry } from "@/lib/timezone-map";

const transcriptLogger = logger.child("transcript-processor");

export type ProcessTranscriptParams = {
	user: AstraUser;
	conversation: ElevenLabsConversation;
};

export type ProcessTranscriptResult = {
	task_id: string;
	execution_id: string;
	conversation_id: string;
	overview_updates: Record<string, unknown>;
	conversation_summary: Record<string, unknown> | null;
	memories_count: number;
	merged_overview: UserOverview;
};

const ensureStringArray = (value: unknown, fallback: string[] = []) =>
	Array.isArray(value)
		? (value
				.filter((item) => typeof item === "string")
				.map((item) => item.trim())
				.filter((item) => item.length > 0) as string[])
		: fallback;

const cloneOverview = (overview: UserOverview | null) =>
	overview ? (JSON.parse(JSON.stringify(overview)) as UserOverview) : null;

/**
 * Orchestrates post-conversation processing after an ElevenLabs conversation ends.
 *
 * Fetches the transcript, optionally resolves a Memory Store token, runs the transcript
 * processor task, merges extracted insights into the user's overview in MongoDB, and
 * optionally triggers downstream background tasks (e.g., chart calculation).
 *
 * @returns An object containing `task_id`, `execution_id`, `conversation_id`, `overview_updates`, `conversation_summary`, `memories_count`, and the merged `merged_overview`.
 * @throws If fetching the transcript from ElevenLabs fails.
 * @throws If the transcript processor task completes with a non‑succeeded status.
 */
export async function processTranscriptConversation({
	user,
	conversation,
}: ProcessTranscriptParams): Promise<ProcessTranscriptResult> {
	const users = getUsers();
	const conversations = getElevenLabsConversations();

	const existingOverview: UserOverview | null = user.user_overview ?? null;
	const overviewPayload = cloneOverview(existingOverview);

	// ANCHOR:memory-store-token-resolution
	// Check if user has Memory Store token for optional long-term memory persistence
	// Task will use MCP integration if token is valid, otherwise skip Memory Store
	const memoryStoreTokenRecord = await findIntegrationToken(
		user.id,
		"memory-store",
	).catch((error) => {
		transcriptLogger.error("Failed to fetch memory-store token", {
			userId: user.id,
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	});

	const memoryStoreToken =
		memoryStoreTokenRecord &&
		(!memoryStoreTokenRecord.expiresAt ||
			memoryStoreTokenRecord.expiresAt.getTime() > Date.now())
			? memoryStoreTokenRecord.token
			: null;

	if (memoryStoreTokenRecord && !memoryStoreToken) {
		transcriptLogger.warn("Memory Store token expired", {
			userId: user.id,
			expiresAt: memoryStoreTokenRecord.expiresAt?.toISOString() ?? null,
		});
	}

	const transcriptResult = await elevenLabsClient.getTranscriptTextWithRetry(
		conversation.conversation_id,
		{
			maxAttempts: 6,
			delayMs: 2000,
		},
	);

	const transcriptText = transcriptResult.text;

	if (transcriptText === null || transcriptText === undefined) {
		throw new Error("Failed to fetch transcript from ElevenLabs");
	}

	transcriptLogger.info("Transcript fetched", {
		conversationId: conversation.conversation_id,
		length: transcriptText.length,
	});

	const trimmedTranscript = transcriptText.trim();
	if (!trimmedTranscript) {
		const previousOverview = existingOverview ?? {};
		const now = new Date();

		const conversationEntry = {
			conversation_id: conversation.conversation_id,
			date: now,
			topics: [] as string[],
			summary:
				"Conversation ended before any transcript was captured. No insights recorded.",
			key_insights: [] as string[],
			questions_asked: [] as string[],
			emotional_tone: undefined as string | undefined,
			follow_up_actions: [] as string[],
		};

		const recentConversations = [
			...(previousOverview.recent_conversations ?? []),
			conversationEntry,
		].slice(-10);

		const mergedOverview: UserOverview = {
			...previousOverview,
			recent_conversations: recentConversations,
			last_updated: now,
			updated_by: "transcript-empty",
		};

		await users.updateOne(
			{ id: user.id },
			{
				$set: {
					user_overview: mergedOverview,
				},
			},
		);

		await conversations.updateOne(
			{ conversation_id: conversation.conversation_id },
			{
				$set: {
					status: "completed",
					updated_at: now,
					metadata: {
						...conversation.metadata,
						transcript_processed: false,
						transcript_empty: true,
						transcript_poll_attempts: transcriptResult.attempts,
						transcript_poll_delay_ms: transcriptResult.delayMs,
						transcript_message_count: transcriptResult.messageCount,
						transcript_status: transcriptResult.conversation?.status,
					},
				},
			},
		);

		transcriptLogger.warn(
			"Transcript was empty; recorded placeholder conversation summary",
			{
				conversationId: conversation.conversation_id,
				userId: user.id,
			},
		);

		return {
			task_id: "transcript-empty",
			execution_id: "transcript-empty",
			conversation_id: conversation.conversation_id,
			overview_updates: {},
			conversation_summary: conversationEntry,
			memories_count: 0,
			merged_overview: mergedOverview,
		};
	}

	// ANCHOR:julep-task-execution
	// Load task definition from YAML and execute via Julep SDK
	// Task runs on Background Worker Agent and returns structured JSON
	// We poll for completion (max 2 minutes) and then merge results to MongoDB
	const taskDef = loadTaskDefinition("TRANSCRIPT_PROCESSOR");
	const agentId = getBackgroundWorkerAgentId();

	const result = await julepClient.createAndExecuteTask(
		agentId,
		taskDef,
		{
			julep_user_id: user.julep_user_id,
			conversation_id: conversation.conversation_id,
			transcript_text: trimmedTranscript,
			existing_overview: overviewPayload ?? undefined,
			memory_store_token: memoryStoreToken ?? undefined,
		},
		{
			maxAttempts: 120,
			intervalMs: 2000,
			onProgress: (status, attempt) => {
				transcriptLogger.debug("Task execution progress", {
					conversationId: conversation.conversation_id,
					status,
					attempt,
				});
			},
		},
	);

	if (result.status !== "succeeded") {
		await conversations.updateOne(
			{ conversation_id: conversation.conversation_id },
			{
				$set: {
					status: "completed",
					updated_at: new Date(),
					metadata: {
						...conversation.metadata,
						transcript_processed: false,
						error: result.error || "Task execution failed",
					},
				},
			},
		);

		throw new Error(result.error || "Transcript task execution failed");
	}

	const extracted = result.output as {
		overview_updates?: {
			profile_summary?: string | null;
			preferences?: Record<string, unknown>;
			insights?: Record<string, unknown>[];
			latest_horoscope?: Record<string, unknown> | null;
			gamification?: Record<string, unknown>;
		};
		conversation_summary?: Record<string, unknown>;
		memories?: Array<Record<string, unknown>>;
		birth_details?: {
			birth_time?: string | null;
			city?: string | null;
			country?: string | null;
			place_text?: string | null;
		};
		first_message?: string;
		incident_map?: Array<{
			title?: string | null;
			description?: string | null;
			tags?: unknown;
		}>;
	};

	const overviewUpdates = extracted.overview_updates ?? {};
	const previousOverview = existingOverview ?? {};
	const now = new Date();

	const rawPreferences = overviewUpdates.preferences as {
		communication_style?: string | null;
		topics_of_interest?: unknown;
		hinglish_level?: unknown;
		flirt_opt_in?: boolean | null;
		astrology_system?: string | null;
		notification_preferences?: Record<string, unknown> | null;
		favorite_astro_topics?: unknown;
	};

	const previousPreferences = previousOverview.preferences ?? {};
	let hinglishLevel: number | null | undefined;
	const rawHinglish = rawPreferences?.hinglish_level;
	if (rawHinglish === null) {
		hinglishLevel = null;
	} else if (typeof rawHinglish === "number" && Number.isFinite(rawHinglish)) {
		hinglishLevel = rawHinglish;
	} else if (typeof rawHinglish === "string") {
		const parsed = Number.parseInt(rawHinglish, 10);
		if (!Number.isNaN(parsed)) {
			hinglishLevel = parsed;
		}
	}

	const mergedPreferences = overviewUpdates.preferences
		? {
				...previousPreferences,
				...overviewUpdates.preferences,
				topics_of_interest: ensureStringArray(
					rawPreferences?.topics_of_interest,
					previousPreferences.topics_of_interest ?? [],
				),
				favorite_astro_topics: ensureStringArray(
					rawPreferences?.favorite_astro_topics,
					previousPreferences.favorite_astro_topics ?? [],
				),
				notification_preferences:
					rawPreferences?.notification_preferences ??
					previousPreferences.notification_preferences ??
					null,
				hinglish_level:
					hinglishLevel ??
					previousPreferences.hinglish_level ??
					(null as number | null),
			}
		: previousPreferences;

	const newInsights = Array.isArray(overviewUpdates.insights)
		? overviewUpdates.insights.map((insight) => ({
				...insight,
				generated_at:
					insight?.generated_at ?? insight?.generatedAt ?? now.toISOString(),
			}))
		: [];

	const mergedInsights = [...(previousOverview.insights ?? []), ...newInsights];

	const mergedGamification = overviewUpdates.gamification
		? {
				...previousOverview.gamification,
				...overviewUpdates.gamification,
			}
		: previousOverview.gamification;

	const mergedHoroscope =
		overviewUpdates.latest_horoscope !== undefined
			? overviewUpdates.latest_horoscope
			: (previousOverview.latest_horoscope ?? null);

	const profileSummary =
		overviewUpdates.profile_summary !== undefined
			? overviewUpdates.profile_summary
			: (previousOverview.profile_summary ?? null);

	const incidentEntries = Array.isArray(extracted.incident_map)
		? extracted.incident_map
				.map((incident) => {
					const description =
						typeof incident?.description === "string"
							? incident.description.trim()
							: "";
					if (!description) {
						return null;
					}
					return {
						title:
							typeof incident?.title === "string"
								? incident.title.trim() || null
								: null,
						description,
						tags: Array.isArray(incident?.tags)
							? incident.tags
									.filter((tag): tag is string => typeof tag === "string")
									.map((tag) => tag.trim())
									.filter((tag) => tag.length > 0)
							: [],
					};
				})
				.filter(
					(
						incident,
					): incident is {
						title: string | null;
						description: string;
						tags: string[];
					} => incident !== null,
				)
		: [];

	const mergedIncidents = incidentEntries.length
		? [...(previousOverview.incident_map ?? []), ...incidentEntries].slice(-10)
		: (previousOverview.incident_map ?? []);

	const conversationSummary = extracted.conversation_summary ?? null;
	const conversationEntry = conversationSummary
		? {
				conversation_id: conversation.conversation_id,
				date: now,
				topics: ensureStringArray(
					(conversationSummary.topics as unknown) ?? [],
				),
				summary: (conversationSummary.summary as string) ?? "",
				key_insights: ensureStringArray(
					(conversationSummary.key_insights as unknown) ?? [],
				),
				questions_asked: ensureStringArray(
					(conversationSummary.questions_asked as unknown) ?? [],
				),
				emotional_tone:
					(conversationSummary.emotional_tone as string | undefined) ??
					undefined,
				follow_up_actions: ensureStringArray(
					(conversationSummary.follow_up_actions as unknown) ?? [],
				),
			}
		: null;

	const recentConversations = [
		...(previousOverview.recent_conversations ?? []),
		...(conversationEntry ? [conversationEntry] : []),
	].slice(-10);

	const birthDetails = extracted.birth_details ?? {};
	const birthTime =
		typeof birthDetails.birth_time === "string" &&
		birthDetails.birth_time.trim().length > 0
			? birthDetails.birth_time.trim()
			: undefined;
	const birthCity =
		typeof birthDetails.city === "string" && birthDetails.city.trim().length > 0
			? birthDetails.city.trim()
			: undefined;
	const birthCountry =
		typeof birthDetails.country === "string" &&
		birthDetails.country.trim().length > 0
			? birthDetails.country.trim()
			: undefined;
	const birthPlaceText =
		typeof birthDetails.place_text === "string" &&
		birthDetails.place_text.trim().length > 0
			? birthDetails.place_text.trim()
			: undefined;

	const derivedPlace =
		birthPlaceText ??
		([birthCity, birthCountry].filter((value) => !!value).join(", ") ||
			undefined);

	const derivedTimezone =
		resolveTimezoneForCountry(birthCountry) ?? user.birth_timezone ?? null;

	const previousBirthDetails = previousOverview.birth_details ?? {};
	const mergedBirthDetails = {
		city: birthCity ?? previousBirthDetails.city ?? null,
		country: birthCountry ?? previousBirthDetails.country ?? null,
		place_text:
			birthPlaceText ?? previousBirthDetails.place_text ?? derivedPlace ?? null,
		timezone:
			derivedTimezone ??
			previousBirthDetails.timezone ??
			user.birth_timezone ??
			null,
	};

	// ANCHOR:mongodb-overview-merge
	// Merge task output with existing user_overview and persist to MongoDB
	// This is the source of truth for ElevenLabs agent context in next conversation
	// Update first_message if task generated a new one
	// Replace [USERNAME] placeholder with {{user_name}} for ElevenLabs dynamic variables
	const newFirstMessage =
		typeof extracted.first_message === "string" &&
		extracted.first_message.length > 10
			? extracted.first_message.replace(/\[USERNAME\]/g, "{{user_name}}")
			: undefined;

	const mergedOverview: UserOverview = {
		...previousOverview,
		profile_summary: profileSummary ?? null,
		first_message: newFirstMessage ?? previousOverview.first_message ?? null,
		preferences: mergedPreferences,
		gamification: mergedGamification,
		latest_horoscope: mergedHoroscope ?? null,
		insights: mergedInsights,
		incident_map: mergedIncidents,
		recent_conversations: recentConversations,
		last_updated: now,
		updated_by: result.id,
		birth_details: mergedBirthDetails,
	};

	const userSetUpdate: Record<string, unknown> = {
		user_overview: mergedOverview,
	};
	if (birthTime) {
		userSetUpdate.birth_time = birthTime;
	}
	if (birthCity) {
		userSetUpdate.birth_city = birthCity;
	}
	if (birthCountry) {
		userSetUpdate.birth_country = birthCountry;
	}
	if (derivedPlace) {
		userSetUpdate.birth_location = derivedPlace;
	}
	if (derivedTimezone) {
		userSetUpdate.birth_timezone = derivedTimezone;
	}

	await users.updateOne(
		{ id: user.id },
		{
			$set: userSetUpdate,
		},
	);

	await conversations.updateOne(
		{ conversation_id: conversation.conversation_id },
		{
			$set: {
				status: "completed",
				ended_at: new Date(),
				updated_at: new Date(),
				metadata: {
					...conversation.metadata,
					transcript_processed: true,
					transcript_poll_attempts: transcriptResult.attempts,
					transcript_poll_delay_ms: transcriptResult.delayMs,
					transcript_message_count: transcriptResult.messageCount,
					transcript_status: transcriptResult.conversation?.status,
					task_id: result.task_id,
					execution_id: result.id,
					conversation_summary: conversationEntry
						? {
								summary: conversationEntry.summary,
								topics: conversationEntry.topics,
								key_insights: conversationEntry.key_insights,
								emotional_tone: conversationEntry.emotional_tone,
							}
						: (conversation.metadata?.conversation_summary ?? null),
				},
			},
		},
	);

	transcriptLogger.info("MongoDB user_overview merged", {
		userId: user.id,
		preferencesUpdated: !!overviewUpdates.preferences,
		insightsAdded: newInsights.length,
		hasConversationSummary: !!conversationEntry,
		memoriesCount: Array.isArray(extracted.memories)
			? extracted.memories.length
			: 0,
	});

	// ANCHOR:trigger-chart-calculation
	// If we now have complete birth data, trigger chart calculation (fire-and-forget)
	// This will generate Vedic/Western charts and find famous people born on same date
	const hasCompleteBirthData =
		user.date_of_birth &&
		user.birth_time &&
		(birthCity || user.birth_city) &&
		!user.user_overview?.birth_chart;

	if (hasCompleteBirthData) {
		transcriptLogger.info("Triggering chart calculation", {
			userId: user.id,
			birthDate: user.date_of_birth?.toISOString().split("T")[0],
			hasBirthTime: true,
		});

		// Fire-and-forget - don't await to avoid blocking transcript processing
		const chartTaskDef = loadTaskDefinition("CHART_CALCULATOR");
		julepClient
			.createAndExecuteTask(
				agentId,
				chartTaskDef,
				{
					birth_date: user.date_of_birth?.toISOString().split("T")[0],
					birth_time: user.birth_time,
					birth_location: birthCity || user.birth_city || "Unknown",
					birth_timezone: derivedTimezone || user.birth_timezone || "UTC",
					ayanamsha: "lahiri",
				},
				{
					maxAttempts: 30,
					intervalMs: 2000,
				},
			)
			.then(async (chartResult) => {
				if (chartResult.status === "succeeded") {
					transcriptLogger.info("Chart calculation succeeded", {
						userId: user.id,
						taskId: chartResult.task_id,
					});

					// Update user with birth chart
					await users.updateOne(
						{ id: user.id },
						{
							$set: {
								"user_overview.birth_chart": chartResult.output.birth_chart,
								"user_overview.last_updated": new Date(),
							},
						},
					);
				} else {
					transcriptLogger.error("Chart calculation failed", {
						userId: user.id,
						error: chartResult.error,
					});
				}
			})
			.catch((error) => {
				transcriptLogger.error("Chart calculation error", {
					userId: user.id,
					error: error instanceof Error ? error.message : String(error),
				});
			});
	}

	return {
		task_id: result.task_id,
		execution_id: result.id,
		conversation_id: conversation.conversation_id,
		overview_updates: overviewUpdates as Record<string, unknown>,
		conversation_summary: conversationEntry,
		memories_count: Array.isArray(extracted.memories)
			? extracted.memories.length
			: 0,
		merged_overview: mergedOverview,
	};
}