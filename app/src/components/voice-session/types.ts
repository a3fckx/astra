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

/**
 * SessionOverview - Complete user_overview from MongoDB
 * This matches the MongoDB UserOverview schema and contains all background task results
 */
export type SessionOverview = {
	profile_summary?: string | null;
	first_message?: string | null;

	birth_details?: {
		city?: string | null;
		country?: string | null;
		place_text?: string | null;
		timezone?: string | null;
	};

	birth_chart?: {
		system?: "vedic" | "western" | "both";
		vedic?: Record<string, unknown>;
		western?: Record<string, unknown>;
		famous_people?: Array<Record<string, unknown>>;
		calculated_at?: Date | string;
	};

	preferences?: {
		communication_style?: string;
		topics_of_interest?: string[];
		hinglish_level?: number;
		flirt_opt_in?: boolean;
		astrology_system?: string;
		favorite_astro_topics?: string[];
		notification_preferences?: Record<string, unknown>;
	};

	recent_conversations?: Array<{
		conversation_id: string;
		date: Date | string;
		topics: string[];
		summary: string;
		key_insights: string[];
		questions_asked: string[];
		emotional_tone?: string;
		follow_up_actions?: string[];
	}>;

	gamification?: {
		streak_days: number;
		best_streak: number;
		total_conversations: number;
		milestones_unlocked: string[];
		topics_explored: string[];
		chart_completion_percent: number;
		last_conversation_date: Date | string;
		last_updated: Date | string;
	};

	latest_horoscope?: {
		date: string;
		content: string;
		sun_sign: string;
		moon_sign: string;
		generated_at: string;
	};

	latest_weekly_report?: Record<string, unknown>;
	weekly_reports?: Array<Record<string, unknown>>;

	incident_map?: Array<{
		title?: string | null;
		description: string;
		tags: string[];
	}>;

	insights?: Array<{
		type: string;
		content: string;
		generated_at: Date | string;
		confidence?: number;
	}>;

	last_updated?: Date | string;
	updated_by?: string;
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
