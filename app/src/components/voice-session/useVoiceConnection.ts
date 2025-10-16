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
	const contextualUpdateSent = useRef(false);

	const { startSession, endSession, sendContextualUpdate } = useConversation({
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
			contextualUpdateSent.current = false;
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
		onDisconnect: (details) => {
			console.info("[ElevenLabs] Conversation disconnected", details);
			sessionActiveRef.current = false;
			contextualUpdateSent.current = false;
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
			contextualUpdateSent.current = false;
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
					}),
				});
			} catch (persistenceError) {
				console.error(
					"Failed to persist ElevenLabs conversation metadata",
					persistenceError,
				);
			}
		},
		[agentId, handshake?.session.workflowId],
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
			contextualUpdateSent.current = false;
			setMicMuted(false);
			setError(null);
		} catch (sessionError) {
			sessionActiveRef.current = false;
			contextualUpdateSent.current = false;

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
			contextualUpdateSent.current = false;
			setStatus("idle");
			setMicMuted(false);
		}
	}, [endSession, status]);

	const toggleMute = useCallback(() => {
		setMicMuted((prev) => !prev);
	}, []);

	/**
	 * ANCHOR:session-context-update
	 * Send session context to ElevenLabs once connected
	 */
	useEffect(() => {
		if (
			!handshakeLoaded ||
			!handshake ||
			status !== "connected" ||
			contextualUpdateSent.current
		) {
			return;
		}

		const contextPayload = {
			type: "session_context",
			userId: handshake.session.user.id,
			userEmail: handshake.session.user.email,
			workflowId: handshake.session.workflowId ?? WORKFLOW_ID,
			julepSessionId: handshake.session.julep?.sessionId,
		};

		console.info(
			"[Contextual Update] Preparing to send session context to ElevenLabs",
			{
				timestamp: new Date().toISOString(),
				userId: contextPayload.userId,
				workflowId: contextPayload.workflowId,
				hasJulepSession: Boolean(contextPayload.julepSessionId),
			},
		);

		try {
			const contextString = JSON.stringify(contextPayload);
			console.info("[Contextual Update] Sending payload", {
				payloadSize: contextString.length,
				payload: contextPayload,
			});

			sendContextualUpdate(contextString);

			console.info(
				"[Contextual Update] Successfully sent session context to ElevenLabs",
				{
					timestamp: new Date().toISOString(),
					userId: contextPayload.userId,
				},
			);
		} catch (contextError) {
			console.error(
				"[Contextual Update] Failed to send ElevenLabs contextual update",
				{
					timestamp: new Date().toISOString(),
					userId: contextPayload.userId,
					error:
						contextError instanceof Error
							? contextError.message
							: String(contextError),
					stack: contextError instanceof Error ? contextError.stack : undefined,
				},
			);
		}
		contextualUpdateSent.current = true;
	}, [status, handshakeLoaded, handshake, sendContextualUpdate]);

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
