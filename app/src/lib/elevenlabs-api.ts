import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const elevenLabsLogger = logger.child("elevenlabs:api");

/**
 * Base URL for ElevenLabs API
 */
const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";

/**
 * Message in a conversation transcript
 * ANCHOR:elevenlabs-transcript-structure
 * Updated to match actual ElevenLabs API response format
 */
export interface ConversationMessage {
	role: "user" | "agent";
	message: string | null;
	time_in_call_secs?: number;
	tool_calls?: unknown[];
	tool_results?: unknown[];
}

/**
 * Full conversation transcript structure from ElevenLabs
 * Note: transcript is an array directly, not nested under { messages: [] }
 */
export interface ConversationTranscript {
	conversation_id: string;
	agent_id: string;
	status: string;
	user_id?: string;
	metadata?: Record<string, unknown>;
	transcript: ConversationMessage[];
}

/**
 * Conversation metadata from ElevenLabs
 */
export interface ConversationMetadata {
	conversation_id: string;
	agent_id: string;
	user_id?: string;
	status: "active" | "completed" | "failed";
	created_at: string;
	updated_at: string;
	metadata?: Record<string, unknown>;
}

/**
 * Options for fetching conversations
 */
export interface ListConversationsOptions {
	limit?: number;
	offset?: number;
	status?: "active" | "completed" | "failed";
}

export interface TranscriptFetchOptions {
	maxAttempts?: number;
	delayMs?: number;
}

export interface TranscriptFetchResult {
	text: string;
	attempts: number;
	messageCount: number;
	delayMs: number;
	conversation: ConversationTranscript | null;
}

/**
 * ElevenLabs API client for conversation and transcript management
 */
export class ElevenLabsClient {
	private apiKey: string;
	private baseUrl: string;

	constructor(apiKey?: string) {
		this.apiKey = apiKey || env.elevenLabsApiKey || "";
		this.baseUrl = ELEVENLABS_API_BASE;

		if (!this.apiKey) {
			elevenLabsLogger.warn(
				"ElevenLabs API key not provided. API calls will fail.",
			);
		}
	}

	/**
	 * Make a request to the ElevenLabs API
	 */
	private async request<T>(
		endpoint: string,
		options: RequestInit = {},
	): Promise<T> {
		const url = `${this.baseUrl}${endpoint}`;

		try {
			const response = await fetch(url, {
				...options,
				headers: {
					"xi-api-key": this.apiKey,
					"Content-Type": "application/json",
					...options.headers,
				},
			});

			if (!response.ok) {
				const errorText = await response.text();
				elevenLabsLogger.error("ElevenLabs API request failed", {
					endpoint,
					status: response.status,
					statusText: response.statusText,
					error: errorText,
				});

				throw new Error(
					`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`,
				);
			}

			const data = await response.json();
			return data as T;
		} catch (error) {
			elevenLabsLogger.error("ElevenLabs API request exception", {
				endpoint,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Fetch a conversation transcript by ID
	 *
	 * @param conversationId - The ElevenLabs conversation ID
	 * @returns Full conversation transcript with messages
	 *
	 * @example
	 * ```typescript
	 * const client = new ElevenLabsClient();
	 * const transcript = await client.getConversation('conv_abc123');
	 * console.log(transcript.transcript.messages);
	 * ```
	 */
	async getConversation(
		conversationId: string,
	): Promise<ConversationTranscript> {
		elevenLabsLogger.info("Fetching conversation", { conversationId });

		const transcript = await this.request<ConversationTranscript>(
			`/convai/conversations/${conversationId}`,
		);

		elevenLabsLogger.info("Conversation fetched successfully", {
			conversationId,
			messageCount: Array.isArray(transcript.transcript)
				? transcript.transcript.length
				: 0,
		});

		return transcript;
	}

	/**
	 * Extract plain text transcript from conversation messages
	 * ANCHOR:transcript-text-extraction
	 *
	 * Filters out:
	 * - System tool calls (language_detection, etc.)
	 * - Messages with null content
	 * - Tool result messages
	 *
	 * Keeps only actual user and agent dialogue
	 *
	 * @param conversationId - The ElevenLabs conversation ID
	 * @returns Formatted transcript text
	 *
	 * @example
	 * ```typescript
	 * const client = new ElevenLabsClient();
	 * const text = await client.getTranscriptText('conv_abc123');
	 * // Returns:
	 * // "AGENT: Leo, Shubham Attri! The Sun's favorite child.
	 * //  USER: I'm interested in talking to you
	 * //  AGENT: Suno, it's wonderful you're here."
	 * ```
	 */
	async getTranscriptText(conversationId: string): Promise<string> {
		const result = await this.getTranscriptTextWithRetry(conversationId, {
			maxAttempts: 1,
		});
		return result.text;
	}

	private filterTranscriptMessages(
		conversation: ConversationTranscript | null,
	): ConversationMessage[] {
		if (!conversation || !Array.isArray(conversation.transcript)) {
			return [];
		}

		return conversation.transcript.filter((msg) => {
			// Keep only messages with actual content
			if (!msg.message || typeof msg.message !== "string") {
				return false;
			}
			const trimmed = msg.message.trim();
			if (!trimmed.length) {
				return false;
			}
			// Skip tool calls/results
			if (msg.tool_calls && msg.tool_calls.length > 0) {
				return false;
			}
			if (msg.tool_results && msg.tool_results.length > 0) {
				return false;
			}
			return true;
		});
	}

	private async delay(ms: number) {
		return new Promise((resolve) => {
			setTimeout(resolve, ms);
		});
	}

	/**
	 * Fetch transcript text with polling retries.
	 *
	 * ElevenLabs can take a moment to surface transcript messages after a call ends.
	 * This helper polls the conversation endpoint until messages are available
	 * (or the attempt budget is exhausted).
	 */
	async getTranscriptTextWithRetry(
		conversationId: string,
		options: TranscriptFetchOptions = {},
	): Promise<TranscriptFetchResult> {
		const maxAttempts = Math.max(1, options.maxAttempts ?? 5);
		const delayMs = options.delayMs ?? 2000;

		let attempt = 0;
		let lastConversation: ConversationTranscript | null = null;
		let lastMessages: ConversationMessage[] = [];

		while (attempt < maxAttempts) {
			attempt += 1;
			try {
				lastConversation = await this.getConversation(conversationId);
			} catch (error) {
				elevenLabsLogger.error("Failed to fetch conversation transcript", {
					conversationId,
					attempt,
					error: error instanceof Error ? error.message : String(error),
				});
				if (attempt >= maxAttempts) {
					throw error;
				}
				elevenLabsLogger.info("Retrying transcript fetch after failure", {
					conversationId,
					attempt,
					maxAttempts,
				});
				await this.delay(delayMs);
				continue;
			}

			lastMessages = this.filterTranscriptMessages(lastConversation);
			const transcriptText = lastMessages
				.map((msg) => `${msg.role.toUpperCase()}: ${msg.message}`)
				.join("\n\n");

			if (transcriptText.length > 0) {
				elevenLabsLogger.info("Transcript text extracted", {
					conversationId,
					attempt,
					messageCount: lastMessages.length,
				});
				return {
					text: transcriptText,
					attempts: attempt,
					messageCount: lastMessages.length,
					delayMs,
					conversation: lastConversation,
				};
			}

			if (attempt < maxAttempts) {
				elevenLabsLogger.info("No transcript messages yet; polling again", {
					conversationId,
					attempt,
					maxAttempts,
					delayMs,
					status: lastConversation?.status,
				});
				await this.delay(delayMs);
			}
		}

		elevenLabsLogger.warn(
			"Transcript messages still unavailable after polling attempts",
			{
				conversationId,
				attempts: maxAttempts,
				lastStatus: lastConversation?.status,
			},
		);

		return {
			text: "",
			attempts: maxAttempts,
			messageCount: lastMessages.length,
			delayMs,
			conversation: lastConversation,
		};
	}

	/**
	 * List conversations for an agent
	 *
	 * @param agentId - The ElevenLabs agent ID
	 * @param options - Pagination and filtering options
	 * @returns Array of conversation metadata
	 *
	 * @example
	 * ```typescript
	 * const client = new ElevenLabsClient();
	 * const conversations = await client.listConversations('agent_123', {
	 *   limit: 10,
	 *   status: 'completed'
	 * });
	 * ```
	 */
	async listConversations(
		agentId: string,
		options: ListConversationsOptions = {},
	): Promise<ConversationMetadata[]> {
		const { limit = 50, offset = 0, status } = options;

		const queryParams = new URLSearchParams({
			limit: limit.toString(),
			offset: offset.toString(),
			...(status && { status }),
		});

		elevenLabsLogger.info("Listing conversations", {
			agentId,
			limit,
			offset,
			status,
		});

		const response = await this.request<{
			conversations: ConversationMetadata[];
		}>(`/convai/agents/${agentId}/conversations?${queryParams}`);

		elevenLabsLogger.info("Conversations listed successfully", {
			agentId,
			count: response.conversations?.length || 0,
		});

		return response.conversations || [];
	}

	/**
	 * Get conversation metadata without the full transcript
	 *
	 * Useful for checking status or metadata without fetching all messages
	 *
	 * @param conversationId - The ElevenLabs conversation ID
	 * @returns Conversation metadata
	 */
	async getConversationMetadata(
		conversationId: string,
	): Promise<ConversationMetadata> {
		elevenLabsLogger.info("Fetching conversation metadata", { conversationId });

		// Note: ElevenLabs API might not have a dedicated metadata endpoint
		// In that case, we fetch the full conversation and extract metadata
		const conversation = await this.getConversation(conversationId);

		const metadata: ConversationMetadata = {
			conversation_id: conversation.conversation_id,
			agent_id: conversation.agent_id,
			status: conversation.status as "active" | "completed" | "failed",
			created_at: "", // ElevenLabs should provide this
			updated_at: "", // ElevenLabs should provide this
			metadata: conversation.metadata,
		};

		return metadata;
	}

	/**
	 * Check if a conversation is complete
	 *
	 * @param conversationId - The ElevenLabs conversation ID
	 * @returns True if conversation has ended
	 */
	async isConversationComplete(conversationId: string): Promise<boolean> {
		try {
			const metadata = await this.getConversationMetadata(conversationId);
			return metadata.status === "completed";
		} catch (error) {
			elevenLabsLogger.error("Failed to check conversation status", {
				conversationId,
				error: error instanceof Error ? error.message : String(error),
			});
			return false;
		}
	}
}

/**
 * Default ElevenLabs client instance
 *
 * Uses API key from environment variables
 */
export const elevenLabsClient = new ElevenLabsClient();

/**
 * Get the formatted transcript text for the specified ElevenLabs conversation.
 *
 * @param conversationId - The ElevenLabs conversation ID
 * @returns The conversation transcript formatted as role-labeled paragraphs; an empty string if no transcript is available
 */
export async function fetchConversationTranscript(
	conversationId: string,
): Promise<string> {
	const result =
		await elevenLabsClient.getTranscriptTextWithRetry(conversationId);
	return result.text;
}

/**
 * Fetch full conversation data (convenience function)
 *
 * @param conversationId - The ElevenLabs conversation ID
 * @returns Full conversation transcript
 */
export async function fetchConversation(
	conversationId: string,
): Promise<ConversationTranscript> {
	return elevenLabsClient.getConversation(conversationId);
}

/**
 * List conversations for an agent (convenience function)
 *
 * @param agentId - The ElevenLabs agent ID
 * @param options - Pagination and filtering options
 * @returns Array of conversation metadata
 */
export async function listAgentConversations(
	agentId: string,
	options?: ListConversationsOptions,
): Promise<ConversationMetadata[]> {
	return elevenLabsClient.listConversations(agentId, options);
}