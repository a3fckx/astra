import { MongoClient, type Collection, type Db, type ObjectId } from 'mongodb';
import type { AstraUser, AstraSession, ResponderEvent, ResponderOutboxMessage } from '../../src/lib/mongo';

declare global {
	// eslint-disable-next-line no-var
	var __testMongoClient: MongoClient | undefined;
}

let testClient: MongoClient;
let testDb: Db;

/**
 * Get or create a test MongoDB client
 * Uses a separate database for testing to avoid conflicts
 */
export function getTestMongoClient(): MongoClient {
	if (!testClient) {
		const testUri = Bun.env.MONGODB_URI || 'mongodb://localhost:27017/astra_test';
		testClient = new MongoClient(testUri);
	}
	return testClient;
}

/**
 * Get test database instance
 */
export function getTestDatabase(): Db {
	if (!testDb) {
		const client = getTestMongoClient();
		const dbName = Bun.env.MONGODB_DB || 'astra_test';
		testDb = client.db(dbName);
	}
	return testDb;
}

/**
 * Connect to test database
 */
export async function connectTestDatabase(): Promise<void> {
	const client = getTestMongoClient();
	await client.connect();
	console.log('Connected to test MongoDB database');
}

/**
 * Disconnect from test database
 */
export async function disconnectTestDatabase(): Promise<void> {
	if (testClient) {
		await testClient.close();
		console.log('Disconnected from test MongoDB database');
	}
}

/**
 * Clear all test collections
 */
export async function clearTestCollections(): Promise<void> {
	const db = getTestDatabase();
	const collections = await db.collections();
	
	for (const collection of collections) {
		await collection.deleteMany({});
	}
}

/**
 * Get test collections with proper typing
 */
export function getTestUsers(): Collection<AstraUser> {
	return getTestDatabase().collection<AstraUser>('user');
}

export function getTestSessions(): Collection<AstraSession> {
	return getTestDatabase().collection<AstraSession>('astra_sessions');
}

export function getTestResponderEvents(): Collection<ResponderEvent> {
	return getTestDatabase().collection<ResponderEvent>('responder_events');
}

export function getTestResponderOutbox(): Collection<ResponderOutboxMessage> {
	return getTestDatabase().collection<ResponderOutboxMessage>('responder_outbox');
}

/**
 * Create a test user with valid default data
 */
export function createTestUser(overrides: Partial<AstraUser> = {}): AstraUser {
	const now = new Date();
	return {
		id: `test_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
		name: 'Test User',
		email: `test${Date.now()}@example.com`,
		emailVerified: true,
		createdAt: now,
		updatedAt: now,
		julep_project: 'astra',
		...overrides,
	};
}

/**
 * Create a test session with valid default data
 */
export function createTestSession(overrides: Partial<AstraSession> = {}): AstraSession {
	const now = new Date();
	return {
		user_id: createTestUser().id,
		julep_session_id: `test_session_${Date.now()}`,
		agent_id: 'test_agent',
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

/**
 * Create a test responder event with valid default data
 */
export function createTestResponderEvent(overrides: Partial<ResponderEvent> = {}): ResponderEvent {
	return {
		userId: createTestUser().id,
		role: 'user',
		content: 'Test message content',
		createdAt: new Date(),
		metadata: null,
		...overrides,
	};
}

/**
 * Create a test outbox message with valid default data
 */
export function createTestOutboxMessage(overrides: Partial<ResponderOutboxMessage> = {}): ResponderOutboxMessage {
	return {
		userId: createTestUser().id,
		content: 'Test outbox message',
		createdAt: new Date(),
		status: 'pending',
		metadata: null,
		...overrides,
	};
}

/**
 * Helper to wait for async operations (useful for testing)
 */
export function waitFor(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a valid ObjectId for testing
 */
export function generateTestId(): ObjectId {
	return new ObjectId();
}
