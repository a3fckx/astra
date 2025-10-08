import { type Collection, type Document, MongoClient } from "mongodb";
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

export type ResponderEvent = {
	_id?: string;
	userId: string;
	role: "assistant" | "system" | "user";
	content: string;
	createdAt: Date;
	metadata?: Record<string, unknown> | null;
};

export type ResponderOutboxMessage = {
	_id?: string;
	userId: string;
	content: string;
	createdAt: Date;
	status: "pending" | "processing" | "delivered" | "failed";
	metadata?: Record<string, unknown> | null;
};

export const getResponderEvents = (): Collection<ResponderEvent> =>
	db.collection<ResponderEvent>("responder_events");

export const getResponderOutbox = (): Collection<ResponderOutboxMessage> =>
	db.collection<ResponderOutboxMessage>("responder_outbox");

export const getCollection = <TDocument extends Document>(
	name: string,
): Collection<TDocument> => db.collection<TDocument>(name);

export const getMongoClient = () => client;
export const getMongoDb = () => db;
