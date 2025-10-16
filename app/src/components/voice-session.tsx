"use client";

import { useConversation } from "@elevenlabs/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const WORKFLOW_ID = "astra-responder";

export type VoiceSessionProps = {
	agentId: string;
};

type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected";

type IntegrationResponse = {
	token: string;
	expiresAt: string | null;
	metadata: Record<string, unknown> | null;
} | null;

type SessionHandshake = {
	session: {
		workflowId?: string;
		julep?: {
			sessionId?: string;
			userId?: string;
		};
		user: {
			id: string;
			email: string;
			name?: string;
		};
	};
	integrations: {
		"memory-store": IntegrationResponse;
		elevenlabs: IntegrationResponse;
	};
};

const USER_ACTIVITY_INTERVAL_MS = 15000;
const MICROPHONE_WARNING =
	"Microphone access is required for voice conversation. Please allow access and retry.";
const MICROPHONE_UNSUPPORTED_WARNING =
	"This browser does not support microphone access. Please try another browser or device.";

const connectionLabel = (status: ConnectionStatus) => {
	switch (status) {
		case "connected":
			return "Connected to Jadugar";
		case "connecting":
			return "Connecting…";
		case "disconnected":
			return "Disconnected";
		default:
			return "Starting…";
	}
};

const sanitizeDynamicVariables = (
	vars?: Record<string, string | number | boolean | null | undefined>,
) => {
	if (!vars) {
		return undefined;
	}
	const entries = Object.entries(vars).filter(
		([, value]) => value !== undefined && value !== null,
	);
	return entries.length
		? (Object.fromEntries(entries) as Record<string, string | number | boolean>)
		: undefined;
};

export function VoiceSession({ agentId }: VoiceSessionProps) {
	const [status, setStatus] = useState<ConnectionStatus>("idle");
	const [error, setError] = useState<string | null>(null);
	const [warning, setWarning] = useState<string | null>(null);
	const [memoryWarning, setMemoryWarning] = useState<string | null>(null);
	const [micStatus, setMicStatus] = useState<
		"idle" | "requesting" | "granted" | "denied" | "unsupported"
	>("idle");
	const [micMuted, setMicMuted] = useState(false);
	const [isStarting, setIsStarting] = useState(false);
	const [handshake, setHandshake] = useState<SessionHandshake | null>(null);
	const [handshakeLoaded, setHandshakeLoaded] = useState(false);
	const [mcpConnections, setMcpConnections] = useState<Record<string, boolean>>(
		{},
	);
	const sessionActiveRef = useRef(false);
	const activityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
		null,
	);
	const contextualUpdateSent = useRef(false);
	const micRequestRef = useRef<Promise<void> | null>(null);

	const {
		startSession,
		endSession,
		sendUserActivity,
		sendContextualUpdate,
		sendMCPToolApprovalResult,
	} = useConversation({
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
		onDisconnect: () => {
			sessionActiveRef.current = false;
			contextualUpdateSent.current = false;
			setStatus("disconnected");
		},
		onConversationMetadata: (metadata) => {
			console.info("[ElevenLabs] Conversation metadata:", metadata);
		},
		onMCPConnectionStatus: (payload) => {
			if (!payload?.integrations) {
				return;
			}

			setMcpConnections((prev) => {
				const next = { ...prev };
				for (const integration of payload.integrations) {
					if (!integration || !integration.integration_id) {
						continue;
					}
					next[integration.integration_id] = integration.is_connected;
				}
				return next;
			});
		},
		/**
		 * ANCHOR:mcp-memory-approval
		 * Memory Store access routes through ElevenLabs MCP. When the agent asks
		 * for approval we automatically grant it if the per-user token is present.
		 * This mirrors ChatKit’s behaviour where the dashboard quietly approves
		 * trusted tooling so the user isn’t spammed with prompts.
		 */
		onMCPToolCall: (call) => {
			if (!call || call.service_id !== "memory-store") {
				return;
			}

			if (call.state === "awaiting_approval") {
				const toolId = call.tool_call_id;
				const hasToken =
					(handshake?.integrations["memory-store"]?.token?.trim().length ?? 0) >
					0;

				if (hasToken) {
					try {
						sendMCPToolApprovalResult(toolId, true);
						setMemoryWarning(null);
					} catch (approvalError) {
						console.error(
							"Failed to approve Memory Store MCP tool call",
							approvalError,
						);
						setMemoryWarning(
							"Memory Store approval failed; Jadugar may not update your notes.",
						);
					}
				} else {
					setMemoryWarning(
						"Memory Store approval requested, but no token is stored for this user.",
					);
				}
				return;
			}

			if (call.state === "failure") {
				const message =
					typeof call.error_message === "string" && call.error_message.trim()
						? call.error_message
						: "Memory Store tool call failed.";
				setError(message);
				console.error("Memory Store MCP failure", call);
				return;
			}

			if (call.state === "success") {
				console.info("Memory Store MCP success", call.result);
			}
		},
		onUnhandledClientToolCall: (call) => {
			if (!call) {
				return;
			}
			console.warn("Unhandled ElevenLabs client tool call", call);
		},
	});

	useEffect(() => {
		return () => {
			sessionActiveRef.current = false;
			contextualUpdateSent.current = false;
			if (activityIntervalRef.current) {
				clearInterval(activityIntervalRef.current);
				activityIntervalRef.current = null;
			}
			void endSession();
		};
	}, [endSession]);

	useEffect(() => {
		const loadHandshake = async () => {
			try {
				const response = await fetch(
					`/api/responder/session?workflowId=${encodeURIComponent(WORKFLOW_ID)}`,
				);
				if (!response.ok) {
					throw new Error(
						`Failed to fetch session context (${response.status})`,
					);
				}

				const payload = (await response.json()) as {
					session?: SessionHandshake["session"];
					integrations?: Partial<SessionHandshake["integrations"]>;
				};

				if (!payload.session?.user?.id || !payload.session.user.email) {
					throw new Error("Session payload missing user information");
				}

				setHandshake({
					session: payload.session,
					integrations: {
						"memory-store": payload.integrations?.["memory-store"] ?? null,
						elevenlabs: payload.integrations?.elevenlabs ?? null,
					},
				});
				setWarning(null);
			} catch (handshakeError) {
				console.error("Failed to fetch session handshake", handshakeError);
				setWarning(
					"Unable to initialise session context; continuing without memory sync.",
				);
			} finally {
				setHandshakeLoaded(true);
			}
		};

		void loadHandshake();
	}, []);

	const userDisplayName = useMemo(() => {
		if (!handshake) {
			return "friend";
		}
		const candidate =
			handshake.session.user.name?.trim() ??
			handshake.session.user.email.trim();
		return candidate.length > 0 ? candidate : "friend";
	}, [handshake]);

	const dynamicVariables = useMemo(() => {
		if (!handshake) {
			return undefined;
		}
		return sanitizeDynamicVariables({
			user_name: userDisplayName,
			workflow_id: handshake.session.workflowId ?? WORKFLOW_ID,
			julep_session_id: handshake.session.julep?.sessionId,
			memory_store_token: handshake.integrations["memory-store"]?.token ?? null,
			elevenlabs_user_token: handshake.integrations.elevenlabs?.token ?? null,
		});
	}, [handshake, userDisplayName]);

	const requestMicrophoneAccess = useCallback(async () => {
		if (
			typeof navigator === "undefined" ||
			!navigator.mediaDevices ||
			!navigator.mediaDevices.getUserMedia
		) {
			setMicStatus("unsupported");
			throw new Error(
				"Microphone access is not supported in this environment.",
			);
		}

		if (micStatus === "granted") {
			return;
		}

		if (micRequestRef.current) {
			await micRequestRef.current;
			return;
		}

		setMicStatus("requesting");
		const request = navigator.mediaDevices
			.getUserMedia({ audio: true })
			.then((stream) => {
				stream.getTracks().forEach((track) => {
					track.stop();
				});
				setMicStatus("granted");
			})
			.catch((micError) => {
				setMicStatus("denied");
				throw micError instanceof Error
					? micError
					: new Error("Microphone access denied");
			})
			.finally(() => {
				micRequestRef.current = null;
			});

		micRequestRef.current = request;
		await request;
	}, [micStatus]);

	const handleStart = useCallback(async () => {
		if (!agentId) {
			setError("ElevenLabs agent configuration missing. Contact support.");
			return;
		}
		if (isStarting || status === "connecting" || status === "connected") {
			return;
		}
		if (!handshakeLoaded) {
			setWarning("Still preparing your session. Please try again momentarily.");
			return;
		}
		if (!handshake) {
			setError(
				"Session context unavailable. Refresh the page and sign in again.",
			);
			return;
		}

		setIsStarting(true);
		setError(null);
		setWarning(null);
		setMemoryWarning(null);

		try {
			await requestMicrophoneAccess();
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
			});
			console.info("[ElevenLabs] Conversation started", conversationId);

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
		dynamicVariables,
		handshake,
		handshakeLoaded,
		isStarting,
		micStatus,
		requestMicrophoneAccess,
		startSession,
		status,
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

	useEffect(() => {
		if (!handshakeLoaded || !handshake) {
			return;
		}

		const hasToken =
			(handshake.integrations["memory-store"]?.token?.trim().length ?? 0) > 0;

		if (!hasToken) {
			setMemoryWarning(
				"Memory Store token not detected; voice turns will skip shared memory updates until you approve access.",
			);
			return;
		}

		const memoryConnected = mcpConnections["memory-store"];
		if (memoryConnected === false) {
			setMemoryWarning(
				"Memory Store is disconnected; Jadugar will retry syncing notes shortly.",
			);
			return;
		}

		if (memoryConnected === true) {
			setMemoryWarning(null);
		}
	}, [handshakeLoaded, handshake, mcpConnections]);

	useEffect(() => {
		if (status !== "connected") {
			if (activityIntervalRef.current) {
				clearInterval(activityIntervalRef.current);
				activityIntervalRef.current = null;
			}
			return;
		}

		if (activityIntervalRef.current) {
			return;
		}

		activityIntervalRef.current = setInterval(() => {
			sendUserActivity();
		}, USER_ACTIVITY_INTERVAL_MS);

		return () => {
			if (activityIntervalRef.current) {
				clearInterval(activityIntervalRef.current);
				activityIntervalRef.current = null;
			}
		};
	}, [status, sendUserActivity]);

	useEffect(() => {
		if (
			!handshakeLoaded ||
			!handshake ||
			status !== "connected" ||
			contextualUpdateSent.current
		) {
			return;
		}

		try {
			sendContextualUpdate(
				JSON.stringify({
					type: "session_context",
					userId: handshake.session.user.id,
					userEmail: handshake.session.user.email,
					workflowId: handshake.session.workflowId ?? WORKFLOW_ID,
					julepSessionId: handshake.session.julep?.sessionId,
					memoryStoreTokenAvailable:
						(handshake.integrations["memory-store"]?.token?.trim().length ??
							0) > 0,
				}),
			);
		} catch (contextError) {
			console.error(
				"Failed to send ElevenLabs contextual update",
				contextError,
			);
		}
		contextualUpdateSent.current = true;
	}, [status, handshakeLoaded, handshake, sendContextualUpdate]);

	const handshakeReady = handshakeLoaded && Boolean(handshake);
	const isConnected = status === "connected";
	const isConnecting = status === "connecting";
	const canAttemptStart = handshakeReady && micStatus !== "unsupported";
	const startDisabled =
		!canAttemptStart || isStarting || isConnecting || isConnected;
	const stopDisabled = status === "idle" || status === "disconnected";
	const startButtonLabel = isStarting
		? "Starting…"
		: isConnected
			? "Connected"
			: "Start voice session";
	const stopButtonLabel =
		status === "connecting" || isConnected ? "End session" : "Stop session";
	const micToggleLabel = micMuted ? "Unmute mic" : "Mute mic";
	const sessionDescription = isConnected
		? `Hey ${userDisplayName}, Jadugar is listening. Speak naturally and we’ll take it from here.`
		: `Hey ${userDisplayName}, press start when you’re ready to talk to Jadugar. We’ll open the mic once you approve it.`;

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: "1rem",
				padding: "2rem",
				borderRadius: "1.5rem",
				border: "1px solid rgba(148, 163, 184, 0.24)",
				background: "rgba(15, 23, 42, 0.85)",
				color: "#e2e8f0",
				minWidth: "320px",
				maxWidth: "480px",
				textAlign: "center",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "0.75rem",
				}}
			>
				<span
					style={{
						width: "0.75rem",
						height: "0.75rem",
						borderRadius: "999px",
						backgroundColor:
							status === "connected"
								? "#22c55e"
								: status === "connecting"
									? "#fbbf24"
									: "#ef4444",
						boxShadow:
							status === "connected"
								? "0 0 0 6px rgba(34, 197, 94, 0.2)"
								: "none",
					}}
				/>
				<div
					style={{
						fontSize: "0.95rem",
						fontWeight: 600,
					}}
				>
					{connectionLabel(status)}
				</div>
			</div>

			<div
				style={{
					fontSize: "1.1rem",
					lineHeight: 1.5,
					opacity: 0.85,
				}}
			>
				{sessionDescription}
			</div>

			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					justifyContent: "center",
					gap: "0.75rem",
					marginTop: "0.5rem",
				}}
			>
				<button
					type="button"
					onClick={handleStart}
					disabled={startDisabled}
					style={{
						padding: "0.7rem 1.5rem",
						borderRadius: "999px",
						fontWeight: 600,
						border: "1px solid rgba(148, 163, 184, 0.35)",
						background: startDisabled
							? "rgba(51, 65, 85, 0.55)"
							: isConnected
								? "#16a34a"
								: "#2563eb",
						color: startDisabled ? "#94a3b8" : "#f8fafc",
						cursor: startDisabled ? "not-allowed" : "pointer",
						transition: "background 150ms ease, transform 150ms ease",
						minWidth: "11rem",
					}}
				>
					{startButtonLabel}
				</button>
				<button
					type="button"
					onClick={handleStop}
					disabled={stopDisabled}
					style={{
						padding: "0.7rem 1.4rem",
						borderRadius: "999px",
						fontWeight: 600,
						border: "1px solid rgba(148, 163, 184, 0.35)",
						background: stopDisabled ? "rgba(51, 65, 85, 0.35)" : "#b91c1c",
						color: stopDisabled ? "#94a3b8" : "#fee2e2",
						cursor: stopDisabled ? "not-allowed" : "pointer",
						minWidth: "10rem",
					}}
				>
					{stopButtonLabel}
				</button>
				{(isConnected || isConnecting) && (
					<button
						type="button"
						onClick={() => setMicMuted((prev) => !prev)}
						style={{
							padding: "0.7rem 1.4rem",
							borderRadius: "999px",
							fontWeight: 600,
							border: "1px solid rgba(148, 163, 184, 0.35)",
							background: micMuted
								? "rgba(107, 114, 128, 0.4)"
								: "rgba(37, 99, 235, 0.25)",
							color: "#e2e8f0",
							cursor: "pointer",
							minWidth: "10rem",
						}}
					>
						{micToggleLabel}
					</button>
				)}
			</div>

			{warning && !error && (
				<div
					style={{
						marginTop: "0.25rem",
						padding: "0.65rem 0.9rem",
						borderRadius: "0.75rem",
						background: "rgba(251, 191, 36, 0.18)",
						color: "#fde68a",
						fontSize: "0.85rem",
					}}
				>
					{warning}
				</div>
			)}

			{micStatus === "requesting" && (
				<div
					style={{
						padding: "0.65rem 0.9rem",
						borderRadius: "0.75rem",
						background: "rgba(59, 130, 246, 0.18)",
						color: "#bfdbfe",
						fontSize: "0.85rem",
					}}
				>
					Please allow microphone access so Jadugar can hear you.
				</div>
			)}

			{micStatus === "denied" && !error && (
				<div
					style={{
						marginTop: "0.25rem",
						padding: "0.75rem 1rem",
						borderRadius: "0.75rem",
						background: "rgba(239, 68, 68, 0.18)",
						color: "#fecaca",
						fontSize: "0.85rem",
					}}
				>
					{MICROPHONE_WARNING}
				</div>
			)}

			{micStatus === "unsupported" && !error && (
				<div
					style={{
						marginTop: "0.25rem",
						padding: "0.75rem 1rem",
						borderRadius: "0.75rem",
						background: "rgba(107, 114, 128, 0.25)",
						color: "#e5e7eb",
						fontSize: "0.85rem",
					}}
				>
					{MICROPHONE_UNSUPPORTED_WARNING}
				</div>
			)}

			{micMuted && isConnected && !error && (
				<div
					style={{
						marginTop: "0.25rem",
						padding: "0.65rem 0.9rem",
						borderRadius: "0.75rem",
						background: "rgba(59, 130, 246, 0.18)",
						color: "#bfdbfe",
						fontSize: "0.85rem",
					}}
				>
					Microphone muted — Jadugar can’t hear you until you unmute.
				</div>
			)}

			{memoryWarning && !error && (
				<div
					style={{
						marginTop: "0.25rem",
						padding: "0.65rem 0.9rem",
						borderRadius: "0.75rem",
						background: "rgba(59, 130, 246, 0.18)",
						color: "#bfdbfe",
						fontSize: "0.85rem",
					}}
				>
					{memoryWarning}
				</div>
			)}

			{error && (
				<div
					style={{
						marginTop: "0.5rem",
						padding: "0.75rem 1rem",
						borderRadius: "0.75rem",
						background: "rgba(239, 68, 68, 0.15)",
						color: "#fecaca",
						fontSize: "0.875rem",
					}}
				>
					{error}
				</div>
			)}
		</div>
	);
}
