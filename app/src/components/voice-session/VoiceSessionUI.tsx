/**
 * VoiceSessionUI Component
 * Pure presentational component for voice session controls and status
 */

import {
	BUTTON_LABELS,
	CONNECTION_LABELS,
	MICROPHONE_UNSUPPORTED_WARNING,
	MICROPHONE_WARNING,
	SESSION_DESCRIPTIONS,
	STATUS_MESSAGES,
} from "./constants";
import type { ConnectionStatus, MicrophoneStatus } from "./types";

type VoiceSessionUIProps = {
	status: ConnectionStatus;
	micStatus: MicrophoneStatus;
	micMuted: boolean;
	isStarting: boolean;
	userDisplayName: string;
	error: string | null;
	warning: string | null;
	handshakeReady: boolean;
	onStart: () => void;
	onStop: () => void;
	onToggleMute: () => void;
};

export function VoiceSessionUI({
	status,
	micStatus,
	micMuted,
	isStarting,
	userDisplayName,
	error,
	warning,
	handshakeReady,
	onStart,
	onStop,
	onToggleMute,
}: VoiceSessionUIProps) {
	const isConnected = status === "connected";
	const isConnecting = status === "connecting";
	const canAttemptStart = handshakeReady && micStatus !== "unsupported";
	const startDisabled =
		!canAttemptStart || isStarting || isConnecting || isConnected;
	const stopDisabled = status === "idle" || status === "disconnected";

	const startButtonLabel = isStarting
		? BUTTON_LABELS.starting
		: isConnected
			? BUTTON_LABELS.connected
			: BUTTON_LABELS.start;

	const stopButtonLabel =
		isConnecting || isConnected
			? BUTTON_LABELS.endSession
			: BUTTON_LABELS.stopSession;

	const micToggleLabel = micMuted ? BUTTON_LABELS.unmute : BUTTON_LABELS.mute;

	const sessionDescription = isConnected
		? SESSION_DESCRIPTIONS.connected(userDisplayName)
		: SESSION_DESCRIPTIONS.idle(userDisplayName);

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
			{/* Connection Status Indicator */}
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
					{CONNECTION_LABELS[status]}
				</div>
			</div>

			{/* Session Description */}
			<div
				style={{
					fontSize: "1.1rem",
					lineHeight: 1.5,
					opacity: 0.85,
				}}
			>
				{sessionDescription}
			</div>

			{/* Control Buttons */}
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
					onClick={onStart}
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
					onClick={onStop}
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
						onClick={onToggleMute}
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

			{/* Status Messages */}
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
					{STATUS_MESSAGES.micRequesting}
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
					{STATUS_MESSAGES.micMuted}
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
