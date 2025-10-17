/**
 * Voice Session Types
 * Centralized type definitions for ElevenLabs voice session management
 */

export type ConnectionStatus =
	| "idle"
	| "connecting"
	| "connected"
	| "disconnected";

export type MicrophoneStatus =
	| "idle"
	| "requesting"
	| "granted"
	| "denied"
	| "unsupported";

export type IntegrationResponse = {
	token: string;
	expiresAt: string | null;
	metadata: Record<string, unknown> | null;
} | null;

export type SessionUser = {
	id: string;
	email: string;
	name?: string;
	dateOfBirth?: string | null;
	birthTime?: string | null;
	birthPlace?: string | null;
};

export type SessionOverview = {
	streakDays: number;
	profileSummary: string | null;
	vedicSun: string | null;
	vedicMoon: string | null;
	westernSun: string | null;
};

export type SessionHandshake = {
	session: {
		workflowId?: string;
		julep?: {
			sessionId?: string;
			userId?: string;
		};
		user: SessionUser;
		overview?: SessionOverview;
	};
	integrations: {
		elevenlabs: IntegrationResponse;
	};
	prompt?: string | null;
};

export type AgentConfiguration = {
	prompt: string | null;
	firstMessage: string;
	dynamicVariables: Record<string, string | number | boolean> | undefined;
};

export type VoiceSessionProps = {
	agentId: string;
};

export type VoiceSessionState = {
	status: ConnectionStatus;
	error: string | null;
	warning: string | null;
	micStatus: MicrophoneStatus;
	micMuted: boolean;
	isStarting: boolean;
};
