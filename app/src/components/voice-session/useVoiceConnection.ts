/**
 * useVoiceConnection Hook
 * Manages ElevenLabs voice connection, activity tracking, and contextual updates
 */

import { useConversation } from "@elevenlabs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	MICROPHONE_UNSUPPORTED_WARNING,
	MICROPHONE_WARNING,
	STATUS_MESSAGES,
	WORKFLOW_ID,
} from "./constants";
import type {
	ConnectionStatus,
	MicrophoneStatus,
	SessionHandshake,
} from "./types";

type UseVoiceConnectionProps = {
	agentId: string;
	handshake: SessionHandshake | null;
	handshakeLoaded: boolean;
	micStatus: MicrophoneStatus;
	requestMicAccess: () => Promise<void>;
	agentPrompt: string | null;
	agentFirstMessage: string;
	dynamicVariables: Record<string, string | number | boolean> | undefined;
};

export function useVoiceConnection({
	agentId,
	handshake,
	handshakeLoaded,
	micStatus,
	requestMicAccess,
	agentPrompt,
	agentFirstMessage,
	dynamicVariables,
}: UseVoiceConnectionProps) {
	const [status, setStatus] = useState<ConnectionStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const [micMuted, setMicMuted] = useState(false);
	const [isStarting, setIsStarting] = useState(false);
	const sessionActiveRef = useRef(false);

	const { startSession, endSession } = useConversation({
		micMuted,
		onMessage: (payload) => {
			if (!payload || typeof payload !== "object") {
				return;
			}
			const source = (payload as { source?: string }).source;
			const message = (payload as { message?: string }).message;
			if (!message) {
				return;
			}

			const trimmed = message.trim();
			if (!trimmed) {
				return;
			}

			if (source === "ai") {
				console.info("[ElevenLabs] Agent response:", trimmed);

				// ANCHOR:auto-disconnect-on-farewell
				// Auto-disconnect when agent says farewell phrases
				// Agent must use exact phrases for detection (documented in prompt)
				const farewellPatterns = [
					/farewell for now/i,
					/may your (path|journey).{0,50}be/i,
					/until (we speak|next time|our paths cross)/i,
					/namaste.{0,20}(take care|goodbye|until)/i,
				];

				if (farewellPatterns.some((pattern) => pattern.test(trimmed))) {
					console.info(
						"[ElevenLabs] Agent farewell detected, auto-disconnecting in 2.5s",
					);
					setTimeout(() => {
						void endSessionRef.current();
					}, 2500); // 2.5s delay for graceful ending
				}
			} else if (source === "user") {
				console.info("[ElevenLabs] User transcript:", trimmed);
			}
		},
		onError: (message, details) => {
			const resolvedMessage =
				typeof message === "string" && message.trim().length > 0
					? message
					: "ElevenLabs conversation error";
			console.error("ElevenLabs conversation error", resolvedMessage, details);
			setError(resolvedMessage);
			const wasActive = sessionActiveRef.current;
			sessionActiveRef.current = false;
			setStatus(wasActive ? "disconnected" : "idle");
		},
		onStatusChange: ({ status: next }) => {
			if (next === "connected" || next === "connecting") {
				setStatus(next);
				return;
			}
			if (next === "disconnecting") {
				setStatus("disconnected");
				return;
			}
			setStatus(sessionActiveRef.current ? "disconnected" : "idle");
		},
		onDisconnect: async (details) => {
			console.info("[ElevenLabs] Conversation disconnected", details);

			// ANCHOR:trigger-transcript-processing
			// Trigger background processing immediately after conversation ends
			// This fetches transcript, runs Julep tasks, and syncs to MongoDB
			const conversationId = details?.conversationId;

			if (conversationId) {
				console.info(
					"[ElevenLabs] Triggering background transcript processing",
					conversationId,
				);
				try {
					// Fire-and-forget - don't await to avoid blocking disconnect
					// CRITICAL: Include credentials to send session cookie for auth
					fetch("/api/tasks/transcript", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ conversation_id: conversationId }),
						credentials: "include", // Required for session authentication
					})
						.then((res) => {
							if (!res.ok) {
								console.error(
									"[ElevenLabs] Transcript processing failed:",
									res.status,
									res.statusText,
								);
							} else {
								console.info(
									"[ElevenLabs] Transcript processing triggered successfully",
								);
							}
						})
						.catch((error) => {
							console.error(
								"[ElevenLabs] Failed to trigger transcript processing",
								error,
							);
						});
				} catch (error) {
					console.error(
						"[ElevenLabs] Failed to trigger transcript processing",
						error,
					);
				}
			}

			sessionActiveRef.current = false;
			setStatus("disconnected");
		},
		onConversationMetadata: (metadata) => {
			console.info("[ElevenLabs] Conversation metadata:", metadata);
		},
		onUnhandledClientToolCall: (call) => {
			if (!call) {
				return;
			}
			console.warn("Unhandled ElevenLabs client tool call", call);
		},
	});

	const endSessionRef = useRef(endSession);
	useEffect(() => {
		endSessionRef.current = endSession;
	}, [endSession]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			sessionActiveRef.current = false;
			void endSessionRef.current();
		};
	}, []);

	/**
	 * ANCHOR:conversation-ledger
	 * Persist conversation metadata to MongoDB for transcript retrieval
	 */
	const persistConversation = useCallback(
		async (conversationId: string) => {
			try {
				await fetch("/api/responder/conversations", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						conversationId,
						agentId,
						workflowId: handshake?.session.workflowId ?? WORKFLOW_ID,
						overview: handshake?.session.overview ?? null,
					}),
				});
			} catch (persistenceError) {
				console.error(
					"Failed to persist ElevenLabs conversation metadata",
					persistenceError,
				);
			}
		},
		[agentId, handshake?.session.workflowId, handshake?.session.overview],
	);

	const handleStart = useCallback(async () => {
		if (!agentId) {
			setError(STATUS_MESSAGES.agentMissing);
			return;
		}
		if (isStarting || status === "connecting" || status === "connected") {
			return;
		}
		if (!handshakeLoaded) {
			setError(STATUS_MESSAGES.handshakeLoading);
			return;
		}
		if (!handshake) {
			setError(STATUS_MESSAGES.sessionUnavailable);
			return;
		}

		setIsStarting(true);
		setError(null);

		try {
			await requestMicAccess();
			setStatus("connecting");

			const response = await fetch("/api/elevenlabs/signed-url", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ agentId }),
			});

			if (!response.ok) {
				throw new Error(`Failed to get signed URL (${response.status})`);
			}

			const { signedUrl } = (await response.json()) as { signedUrl: string };

			// ANCHOR:debug-session-config
			// Debug logging to verify prompt override and dynamic variables
			console.info("[ElevenLabs] Session configuration:", {
				hasPromptOverride: !!agentPrompt,
				promptLength: agentPrompt?.length ?? 0,
				firstMessage: `${agentFirstMessage?.substring(0, 100)}...`,
				dynamicVariablesKeys: Object.keys(dynamicVariables ?? {}),
				hasBirthDate: dynamicVariables?.has_birth_date,
				hasBirthTime: dynamicVariables?.has_birth_time,
				hasBirthPlace: dynamicVariables?.has_birth_place,
			});

			const conversationId = await startSession({
				signedUrl,
				connectionType: "websocket",
				userId: handshake.session.user.id,
				dynamicVariables,
				textOnly: false,
				overrides: {
					agent: {
						...(agentPrompt
							? {
									prompt: {
										prompt: agentPrompt,
									},
								}
							: {}),
						firstMessage: agentFirstMessage,
					},
				},
			});
			console.info("[ElevenLabs] Conversation started", conversationId);
			void persistConversation(conversationId);

			sessionActiveRef.current = true;
			setMicMuted(false);
			setError(null);
		} catch (sessionError) {
			sessionActiveRef.current = false;

			const baseMessage =
				sessionError instanceof Error && sessionError.message.trim().length > 0
					? sessionError.message
					: "Failed to start ElevenLabs voice session.";

			if (micStatus === "denied") {
				setError(MICROPHONE_WARNING);
			} else if (micStatus === "unsupported") {
				setError(MICROPHONE_UNSUPPORTED_WARNING);
			} else {
				setError(baseMessage);
			}

			console.error("Failed to start ElevenLabs voice session", sessionError);
			setStatus("idle");
		} finally {
			setIsStarting(false);
		}
	}, [
		agentId,
		agentPrompt,
		agentFirstMessage,
		dynamicVariables,
		handshake,
		handshakeLoaded,
		isStarting,
		micStatus,
		requestMicAccess,
		startSession,
		status,
		persistConversation,
	]);

	const handleStop = useCallback(async () => {
		if (status === "idle" || status === "disconnected") {
			return;
		}

		try {
			await endSession();
		} catch (stopError) {
			console.error("Failed to stop ElevenLabs voice session", stopError);
		} finally {
			sessionActiveRef.current = false;
			setStatus("idle");
			setMicMuted(false);
		}
	}, [endSession, status]);

	const toggleMute = useCallback(() => {
		setMicMuted((prev) => !prev);
	}, []);

	/**
	 * ANCHOR:session-context-removed
	 * Session context is now passed via dynamicVariables at session start.
	 * The previous contextual update was sending JSON and causing
	 * "Invalid message received" errors from ElevenLabs WebSocket.
	 *
	 * All necessary context (user_name, workflow_id, julep_session_id, etc.)
	 * is available to the agent through the dynamicVariables passed to startSession.
	 * Use sendContextualUpdate only for natural language context during conversation.
	 */

	return {
		status,
		error,
		micMuted,
		isStarting,
		handleStart,
		handleStop,
		toggleMute,
	};
}
