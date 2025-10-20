import {
	type Collection,
	type Document,
	MongoClient,
	type ObjectId,
} from "mongodb";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

declare global {
	// eslint-disable-next-line no-var
	var __mongoClient: MongoClient | undefined;
}

const client = global.__mongoClient ?? new MongoClient(env.mongodbUri);
const mongoLogger = logger.child("mongo");
if (process.env.NODE_ENV !== "production") {
	global.__mongoClient = client;
}

void client.connect().catch((error) => {
	mongoLogger.error("Failed to initialize MongoDB client", error as Error);
});

const db = client.db(env.mongodbDb);

export type UserOverviewInsight = {
	type: string;
	content: string;
	generated_at?: Date | string;
};

export type UserOverviewPreferences = {
	communication_style?:
		| "casual"
		| "balanced"
		| "formal"
		| "neutral"
		| string
		| null;
	topics_of_interest?: string[];
	hinglish_level?: number | null;
	flirt_opt_in?: boolean | null;
	astrology_system?: "vedic" | "western" | "both" | string | null;
	notification_preferences?: Record<string, unknown> | null;
	favorite_astro_topics?: string[];
};

export type UserOverviewConversation = {
	conversation_id: string;
	date: Date | string;
	topics?: string[];
	summary?: string;
	key_insights?: string[];
	questions_asked?: string[];
	emotional_tone?: string;
	follow_up_actions?: string[];
};

export type UserOverviewGamification = {
	streak_days?: number | null;
	total_conversations?: number | null;
	milestones?: string[];
	points?: number | null;
	level?: number | null;
};

export type UserOverviewHoroscope = {
	date?: string;
	content?: string | null;
	transit_highlights?: string[];
};

export type UserIncident = {
	title?: string | null;
	description: string;
	tags?: string[];
};

export type UserOverviewBirthDetails = {
	city?: string | null;
	country?: string | null;
	place_text?: string | null;
	timezone?: string | null;
};

export type UserOverviewBirthChart = {
	system: "vedic" | "western" | "both";
	vedic?: {
		sun_sign?: string;
		moon_sign?: string;
		ascendant?: string;
		planets?: Array<{
			name: string;
			sign: string;
			house: number;
			degree: string;
			nakshatra?: string;
		}>;
		house_lords?: Array<{ house: number; lord: string }>;
		yogas?: string[];
		dasha?: { mahadasha: string; antardasha: string };
		strengths?: string[];
		challenges?: string[];
		chart_summary?: string;
	} | null;
	western?: {
		sun_sign?: string;
		moon_sign?: string;
		rising_sign?: string;
		planets?: Array<{
			name: string;
			sign: string;
			house: number;
			degree: string;
		}>;
		house_cusps?: Array<{ house: number; sign: string; degree: string }>;
		aspects?: Array<{
			planet1: string;
			planet2: string;
			aspect: string;
			orb: string;
		}>;
		elements?: { fire: number; earth: number; air: number; water: number };
		modalities?: { cardinal: number; fixed: number; mutable: number };
		patterns?: string[];
		chart_summary?: string;
	} | null;
	calculated_at: Date | string;
};

export type UserOverview = {
	profile_summary?: string | null;
	first_message?: string | null;
	preferences?: UserOverviewPreferences;
	recent_conversations?: UserOverviewConversation[];
	gamification?: UserOverviewGamification;
	latest_horoscope?: UserOverviewHoroscope | null;
	birth_details?: UserOverviewBirthDetails | null;
	birth_chart?: UserOverviewBirthChart | null;
	insights?: UserOverviewInsight[];
	incident_map?: UserIncident[];
	last_updated?: Date;
	updated_by?: string;
};

export type AstraUser = {
	_id?: ObjectId;
	id: string;
	name: string;
	email: string;
	image?: string;
	emailVerified: boolean;
	createdAt: Date;
	updatedAt: Date;
	julep_user_id?: string;
	julep_project: "astra";
	birth_day?: number;
	birth_month?: number;
	date_of_birth?: Date;
	birth_time?: string;
	birth_location?: string;
	birth_timezone?: string;
	birth_city?: string;
	birth_country?: string;
	elevenlabs_conversations?: string[];
	user_overview?: UserOverview | null;
};

export type AstraSession = {
	_id?: string;
	user_id: string;
	julep_session_id: string;
	agent_id: string;
	createdAt: Date;
	updatedAt: Date;
};

export type ElevenLabsConversation = {
	_id?: ObjectId;
	user_id: string;
	conversation_id: string;
	agent_id?: string | null;
	workflow_id?: string | null;
	status?: "active" | "completed" | "abandoned";
	started_at: Date;
	ended_at?: Date | null;
	duration_ms?: number | null;
	updated_at: Date;
	metadata?: Record<string, unknown> | null;
};

export type IntegrationToken = {
	_id?: ObjectId;
	userId: string;
	integration: "memory-store" | "elevenlabs";
	token: string;
	expiresAt?: Date | null;
	metadata?: Record<string, unknown> | null;
	createdAt: Date;
	updatedAt: Date;
};

export const getUsers = (): Collection<AstraUser> =>
	db.collection<AstraUser>("user");

export const getSessions = (): Collection<AstraSession> =>
	db.collection<AstraSession>("astra_sessions");

export const getElevenLabsConversations =
	(): Collection<ElevenLabsConversation> =>
		db.collection<ElevenLabsConversation>("elevenlabs_conversations");

export const getIntegrationTokens = (): Collection<IntegrationToken> =>
	db.collection<IntegrationToken>("integration_tokens");

export const getCollection = <TDocument extends Document>(
	name: string,
): Collection<TDocument> => db.collection<TDocument>(name);

export const getMongoClient = () => client;
export const getMongoDb = () => db;
