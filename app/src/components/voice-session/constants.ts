/**
 * Voice Session Constants
 * Configuration values and static messages for ElevenLabs voice sessions
 */

export const WORKFLOW_ID = "astra-responder";

export const MICROPHONE_WARNING =
	"Microphone access is required for voice conversation. Please allow access and retry.";

export const MICROPHONE_UNSUPPORTED_WARNING =
	"This browser does not support microphone access. Please try another browser or device.";

export const CONNECTION_LABELS = {
	connected: "Connected to Jadugar",
	connecting: "Connecting…",
	disconnected: "Disconnected",
	idle: "Starting…",
} as const;

export const SESSION_DESCRIPTIONS = {
	connected: (name: string) =>
		`Hey ${name}, Jadugar is listening. Speak naturally and we'll take it from here.`,
	idle: (name: string) =>
		`Hey ${name}, press start when you're ready to talk to Jadugar. We'll open the mic once you approve it.`,
} as const;

export const BUTTON_LABELS = {
	starting: "Starting…",
	connected: "Connected",
	start: "Start voice session",
	endSession: "End session",
	stopSession: "Stop session",
	mute: "Mute mic",
	unmute: "Unmute mic",
} as const;

export const STATUS_MESSAGES = {
	micRequesting: "Please allow microphone access so Jadugar can hear you.",
	micMuted: "Microphone muted — Jadugar can't hear you until you unmute.",
	handshakeLoading:
		"Still preparing your session. Please try again momentarily.",
	sessionUnavailable:
		"Session context unavailable. Refresh the page and sign in again.",
	agentMissing: "ElevenLabs agent configuration missing. Contact support.",
	memoryWarning:
		"Unable to initialise session context; continuing without memory sync.",
} as const;
