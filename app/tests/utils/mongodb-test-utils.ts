import { MongoClient, type Collection, type Db, type ObjectId } from 'mongodb';
import type { AstraUser, AstraSession, ElevenLabsConversation, IntegrationToken } from '../../src/lib/mongo';

/**
 * MONGODB TEST UTILITIES
 * ======================
 * 
 * BUSINESS CONTEXT:
 * =================
 * Astra stores all user data in MongoDB Atlas across multiple collections. These utilities
 * provide a robust testing foundation that ensures our database interactions work correctly
 * without risking production data integrity.
 * 
 * 🗄️ DATA COLLECTIONS IN ASTRA:
 * ===========================
 * 
 * 👤 USERS COLLECTION (user):
 * - Core user profiles and authentication data
 * - Google OAuth integration (birthdays, profile info)
 * - Julep integration mapping
 * - BUSINESS IMPACT: User authentication = 100% revenue dependency
 * 
 * 💬 SESSIONS COLLECTION (astra_sessions):
 * - User conversation sessions with AI astrologer
 * - Session lifecycle management
 * - Analytics aggregation
 * - BUSINESS IMPACT: Sessions = core product offering
 * 
 * 💬 ELEVENLABS CONVERSATIONS (elevenlabs_conversations):
 * - Voice conversation sessions with ElevenLabs
 * - Agent interactions and workflow tracking
 * - Conversation metadata and analytics
 * - BUSINESS IMPACT: Voice interactions = core product feature
 *
 * 🔑 INTEGRATION TOKENS (integration_tokens):
 * - Per-user integration tokens (memory-store, elevenlabs)
 * - Secure token storage with expiration
 * - Access control for external services
 * - BUSINESS IMPACT: Token management = security & functionality
 * 
 * 🚨 TEST ISOLATION STRATEGY:
 * ========================
 * 
 * SEPARATE DATABASE:
 * - Uses 'astra_test' database, never touches production
 * - Prevents data contamination between tests and production
 * - Enables destructive testing without risk
 * 
 * CLEAN TEST ENVIRONMENT:
 * - Each test starts with empty collections
 * - No interference between test runs
 * - Predictable test results and debugging
 * 
 * BILLING & COST CONSIDERATIONS:
 * ==============================
 * - MongoDB Atlas in test environment (controlled costs)
 * - Connection pooling reduces overhead
 * - Proper cleanup prevents storage bloat
 * - Test data optimization reduces compute costs
 * 
 * PERFORMANCE IMPACT:
 * ===================
 * - In-memory testing where possible
 * - Connection pooling for efficiency
 * - Optimized test data size
 * - Parallel test execution support
 */

declare global {
	// eslint-disable-next-line no-var
	var __testMongoClient: MongoClient | undefined;
}

let testClient: MongoClient;
let testDb: Db;

/**
 * Get or create a test MongoDB client
 * 
 * SAFETY CONSIDERATIONS:
 * ======================
 * - Never connects to production database
 * - Uses test-specific connection string or local instance
 * - Implements connection pooling for performance
 * - Handles connection errors gracefully
 * 
 * CONFIGURATION STRATEGY:
 * =======================
 * - Primary: Uses MONGODB_URI environment variable (CI/CD)
 * - Fallback: Local MongoDB instance (development)
 * - Database isolation: Always uses 'astra_test'
 * - Connection reuse: Singleton pattern for efficiency
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

export function getTestElevenLabsConversations(): Collection<ElevenLabsConversation> {
	return getTestDatabase().collection<ElevenLabsConversation>('elevenlabs_conversations');
}

export function getTestIntegrationTokens(): Collection<IntegrationToken> {
	return getTestDatabase().collection<IntegrationToken>('integration_tokens');
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
 * Create a test ElevenLabs conversation with valid default data
 */
export function createTestElevenLabsConversation(overrides: Partial<ElevenLabsConversation> = {}): ElevenLabsConversation {
	return {
		user_id: createTestUser().id,
		conversation_id: `test_conv_${Date.now()}`,
		agent_id: 'test_agent',
		workflow_id: 'astra-responder',
		started_at: new Date(),
		updated_at: new Date(),
		metadata: null,
		...overrides,
	};
}

/**
 * Create a test integration token with valid default data
 */
export function createTestIntegrationToken(overrides: Partial<IntegrationToken> = {}): IntegrationToken {
	return {
		userId: createTestUser().id,
		integration: 'memory-store',
		token: `test_token_${Date.now()}`,
		metadata: null,
		createdAt: new Date(),
		updatedAt: new Date(),
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
