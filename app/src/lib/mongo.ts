import {
	type Collection,
	type Document,
	MongoClient,
	type ObjectId,
} from "mongodb";
import { env } from "@/lib/env";

declare global {
	// eslint-disable-next-line no-var
	var __mongoClient: MongoClient | undefined;
}

const client = global.__mongoClient ?? new MongoClient(env.mongodbUri);
if (process.env.NODE_ENV !== "production") {
	global.__mongoClient = client;
}

void client.connect().catch((error) => {
	console.error("Failed to initialize MongoDB client", error);
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
};

export type AstraSession = {
	_id?: string;
	user_id: string;
	julep_session_id: string;
	agent_id: string;
	createdAt: Date;
	updatedAt: Date;
};

export type ResponderEvent = {
	_id?: ObjectId;
	userId: string;
	workflowId?: string;
	role: "assistant" | "system" | "user";
	content: string;
	createdAt: Date;
	metadata?: Record<string, unknown> | null;
};

export type ResponderOutboxMessage = {
	_id?: ObjectId;
	userId: string;
	workflowId?: string;
	content: string;
	createdAt: Date;
	status: "pending" | "processing" | "delivered" | "failed";
	metadata?: Record<string, unknown> | null;
	processingStartedAt?: Date;
	updatedAt?: Date;
	workerId?: string;
	failedAt?: Date;
	error?: string;
};

export const getUsers = (): Collection<AstraUser> =>
	db.collection<AstraUser>("user");

export const getSessions = (): Collection<AstraSession> =>
	db.collection<AstraSession>("astra_sessions");

export const getResponderEvents = (): Collection<ResponderEvent> =>
	db.collection<ResponderEvent>("responder_events");

export const getResponderOutbox = (): Collection<ResponderOutboxMessage> =>
	db.collection<ResponderOutboxMessage>("responder_outbox");

export const getCollection = <TDocument extends Document>(
	name: string,
): Collection<TDocument> => db.collection<TDocument>(name);

export const getMongoClient = () => client;
export const getMongoDb = () => db;
