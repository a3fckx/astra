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
	elevenlabs_conversations?: string[];
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
	started_at: Date;
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
