import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import type { MongoClient } from 'mongodb';
import {
	connectTestDatabase,
	disconnectTestDatabase,
	clearTestCollections,
	getTestUsers,
	getTestSessions,
	getTestElevenLabsConversations,
	getTestIntegrationTokens,
	createTestUser,
	createTestSession,
	createTestElevenLabsConversation,
	createTestIntegrationToken,
} from '../utils/mongodb-test-utils';

describe('MongoDB Integration Tests', () => {
	let client: MongoClient;

	beforeAll(async () => {
		// Setup test database connection
		await connectTestDatabase();
		client = (await import('../utils/mongodb-test-utils')).getTestMongoClient();
	});

	afterAll(async () => {
		// Cleanup test database connection
		await disconnectTestDatabase();
	});

	beforeEach(async () => {
		// Clear collections before each test
		await clearTestCollections();
	});

	afterEach(async () => {
		// Ensure collections are clean after each test
		await clearTestCollections();
	});

	describe('Database Connection', () => {
		it('should connect to test database successfully', async () => {
			// Verify connection is active
			const db = client.db();
			await db.admin().ping();
			expect(true).toBe(true); // If we reach here, connection is working
		});

		it('should maintain connection state across operations', async () => {
			const db = client.db();
			
			// Perform multiple operations
			await db.admin().ping();
			const collections = await db.listCollections().toArray();
			expect(Array.isArray(collections)).toBe(true);
			
			await db.admin().ping();
			expect(true).toBe(true); // Connection is still active
		});
	});

	describe('Collection Operations', () => {
		describe('Users Collection', () => {
			it('should create and retrieve a user', async () => {
				const usersCollection = getTestUsers();
				const testUser = createTestUser();

				// Insert user
				const insertResult = await usersCollection.insertOne(testUser);
				expect(insertResult.insertedId).toBeDefined();

				// Retrieve user
				const retrievedUser = await usersCollection.findOne({ id: testUser.id });
				expect(retrievedUser).toBeDefined();
				expect(retrievedUser?.email).toBe(testUser.email);
				expect(retrievedUser?.name).toBe(testUser.name);
			});

			it('should update a user record', async () => {
				const usersCollection = getTestUsers();
				const testUser = createTestUser();

				const insertResult = await usersCollection.insertOne(testUser);
				const userId = insertResult.insertedId;

				// Update user
				await usersCollection.updateOne(
					{ _id: userId },
					{ $set: { name: 'Updated Name', updatedAt: new Date() } }
				);

				// Verify update
				const updatedUser = await usersCollection.findOne({ _id: userId });
				expect(updatedUser?.name).toBe('Updated Name');
			});

			it('should delete a user record', async () => {
				const usersCollection = getTestUsers();
				const testUser = createTestUser();

				const insertResult = await usersCollection.insertOne(testUser);
				const userId = insertResult.insertedId;

				// Delete user
				const deleteResult = await usersCollection.deleteOne({ _id: userId });
				expect(deleteResult.deletedCount).toBe(1);

				// Verify deletion
				const deletedUser = await usersCollection.findOne({ _id: userId });
				expect(deletedUser).toBeNull();
			});

			it('should find users by email', async () => {
				const usersCollection = getTestUsers();
				const testUser = createTestUser({ email: 'specific@example.com' });

				await usersCollection.insertOne(testUser);

				// Find by email
				const foundUser = await usersCollection.findOne({ email: 'specific@example.com' });
				expect(foundUser).toBeDefined();
				expect(foundUser?.name).toBe(testUser.name);
			});
		});

		describe('Sessions Collection', () => {
			it('should create and retrieve a session', async () => {
				const sessionsCollection = getTestSessions();
				const testSession = createTestSession();

				// Insert session
				const insertResult = await sessionsCollection.insertOne(testSession);
				expect(insertResult.insertedId).toBeDefined();

				// Retrieve session
				const retrievedSession = await sessionsCollection.findOne({ user_id: testSession.user_id });
				expect(retrievedSession).toBeDefined();
				expect(retrievedSession?.julep_session_id).toBe(testSession.julep_session_id);
				expect(retrievedSession?.agent_id).toBe(testSession.agent_id);
			});

			it('should find sessions by user_id', async () => {
				const sessionsCollection = getTestSessions();
				const userId = 'test_user_123';
				const session1 = createTestSession({ user_id: userId });
				const session2 = createTestSession({ user_id: userId });

				await sessionsCollection.insertMany([session1, session2]);

				// Find sessions by user_id
				const userSessions = await sessionsCollection.find({ user_id: userId }).toArray();
				expect(userSessions).toHaveLength(2);
			});
		});

		describe('ElevenLabs Conversations Collection', () => {
		it('should create and retrieve conversations', async () => {
		const conversationsCollection = getTestElevenLabsConversations();
		const testConversation = createTestElevenLabsConversation({
		user_id: 'user_123',
		conversation_id: 'conv_123',
		agent_id: 'agent_123',
		});

		// Insert conversation
		const insertResult = await conversationsCollection.insertOne(testConversation);
		expect(insertResult.insertedId).toBeDefined();

		// Retrieve conversation
		const retrievedConversation = await conversationsCollection.findOne({ user_id: 'user_123' });
		expect(retrievedConversation).toBeDefined();
		expect(retrievedConversation?.conversation_id).toBe(testConversation.conversation_id);
		expect(retrievedConversation?.agent_id).toBe('agent_123');
		});

		it('should sort conversations by started date', async () => {
		const conversationsCollection = getTestElevenLabsConversations();
		const userId = 'user_123';

		const conversation1 = createTestElevenLabsConversation({
		user_id: userId,
		conversation_id: 'conv_1',
		started_at: new Date('2024-01-01T10:00:00Z'),
		});

		const conversation2 = createTestElevenLabsConversation({
		user_id: userId,
		conversation_id: 'conv_2',
		started_at: new Date('2024-01-01T10:05:00Z'),
		});

		await conversationsCollection.insertMany([conversation2, conversation1]); // Insert out of order

		// Find and sort by started date (ascending)
		const sortedConversations = await conversationsCollection
		.find({ user_id: userId })
		.sort({ started_at: 1 })
		.toArray();

		expect(sortedConversations).toHaveLength(2);
		expect(sortedConversations[0].conversation_id).toBe('conv_1');
		expect(sortedConversations[1].conversation_id).toBe('conv_2');
		});

		it('should handle different workflow types', async () => {
		const conversationsCollection = getTestElevenLabsConversations();
		const userId = 'user_123';

		const horoscopeConversation = createTestElevenLabsConversation({
		user_id: userId,
		conversation_id: 'conv_horo',
		workflow_id: 'horoscope-workflow',
		});

		const generalConversation = createTestElevenLabsConversation({
		user_id: userId,
		conversation_id: 'conv_general',
		workflow_id: 'general-chat',
		});

		const notesConversation = createTestElevenLabsConversation({
		user_id: userId,
		conversation_id: 'conv_notes',
		workflow_id: 'notes-workflow',
		});

		await conversationsCollection.insertMany([horoscopeConversation, generalConversation, notesConversation]);

		// Find all conversations for the user
		const userConversations = await conversationsCollection.find({ user_id: userId }).toArray();
		expect(userConversations).toHaveLength(3);

		// Find conversations by workflow
		const horoscopeConversations = await conversationsCollection.find({ user_id: userId, workflow_id: 'horoscope-workflow' }).toArray();
		expect(horoscopeConversations).toHaveLength(1);
		expect(horoscopeConversations[0].workflow_id).toBe('horoscope-workflow');
		});
		});

		describe('Integration Tokens Collection', () => {
		it('should create and retrieve integration tokens', async () => {
		const tokensCollection = getTestIntegrationTokens();
		const testToken = createTestIntegrationToken({
		userId: 'user_123',
		integration: 'memory-store',
		token: 'test_token_123',
		metadata: { source: 'web' },
		});

		// Insert token
		const insertResult = await tokensCollection.insertOne(testToken);
		expect(insertResult.insertedId).toBeDefined();

		// Retrieve token
		const retrievedToken = await tokensCollection.findOne({ userId: 'user_123' });
		expect(retrievedToken).toBeDefined();
		expect(retrievedToken?.token).toBe(testToken.token);
		expect(retrievedToken?.integration).toBe('memory-store');
		expect(retrievedToken?.metadata).toEqual({ source: 'web' });
		});

		it('should update token lifecycle', async () => {
		const tokensCollection = getTestIntegrationTokens();
		const testToken = createTestIntegrationToken({
		userId: 'user_123',
		integration: 'memory-store',
		});

		const insertResult = await tokensCollection.insertOne(testToken);
		const tokenId = insertResult.insertedId;

		// Simulate token refresh
		const newToken = 'refreshed_token_456';
		const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
		await tokensCollection.updateOne(
		{ _id: tokenId },
		 { $set: { token: newToken, expiresAt, updatedAt: new Date() } }
				);

		// Verify updated state
		const updatedToken = await tokensCollection.findOne({ _id: tokenId });
		expect(updatedToken?.token).toBe(newToken);
		expect(updatedToken?.expiresAt).toEqual(expiresAt);
				expect(updatedToken?.updatedAt).toBeDefined();
		});

		it('should handle expired tokens', async () => {
		const tokensCollection = getTestIntegrationTokens();
		const expiredToken = createTestIntegrationToken({
		 userId: 'user_123',
		  integration: 'memory-store',
					expiresAt: new Date(Date.now() - 1000), // Already expired
		 });

		const insertResult = await tokensCollection.insertOne(expiredToken);
		const tokenId = insertResult.insertedId;

		// Verify expired state
				const retrievedToken = await tokensCollection.findOne({ _id: tokenId });
		expect(retrievedToken?.expiresAt).toBeDefined();
		expect(retrievedToken?.expiresAt!.getTime()).toBeLessThan(Date.now());
			});

		it('should find tokens by integration type', async () => {
		const tokensCollection = getTestIntegrationTokens();
		const userId = 'user_123';

		const memoryToken = createTestIntegrationToken({ userId, integration: 'memory-store' });
		const elevenlabsToken = createTestIntegrationToken({ userId, integration: 'elevenlabs' });
		const anotherMemoryToken = createTestIntegrationToken({ userId, integration: 'memory-store' });

		await tokensCollection.insertMany([memoryToken, elevenlabsToken, anotherMemoryToken]);

		// Find memory-store tokens
				const memoryTokens = await tokensCollection.find({ userId, integration: 'memory-store' }).toArray();
		expect(memoryTokens).toHaveLength(2);
		expect(memoryTokens.every(t => t.integration === 'memory-store')).toBe(true);

		// Find elevenlabs tokens
		const elevenlabsTokens = await tokensCollection.find({ userId, integration: 'elevenlabs' }).toArray();
		 expect(elevenlabsTokens).toHaveLength(1);
				expect(elevenlabsTokens[0].integration).toBe('elevenlabs');
		});
		});
	});

	describe('Data Integrity and Validation', () => {
		it('should handle large token content properly', async () => {
			const tokensCollection = getTestIntegrationTokens();
			const largeToken = 'A'.repeat(10000); // 10KB token

			const largeTokenDoc = createTestIntegrationToken({
				userId: 'user_123',
				token: largeToken,
			});

			const insertResult = await tokensCollection.insertOne(largeTokenDoc);
			const retrievedToken = await tokensCollection.findOne({ _id: insertResult.insertedId });

			expect(retrievedToken?.token).toBe(largeToken);
			expect(retrievedToken?.token.length).toBe(10000);
		});

		it('should handle complex metadata objects', async () => {
			const tokensCollection = getTestIntegrationTokens();
			const complexMetadata = {
				source: 'mobile_app',
				platform: 'iOS',
				version: '1.2.3',
				userAgent: 'Mozilla/5.0...',
				tags: ['urgent', 'support', 'billing'],
				priority: 1,
				timestamp: new Date().toISOString(),
			};

			const tokenWithComplexMetadata = createTestIntegrationToken({
				userId: 'user_123',
				metadata: complexMetadata,
			});

			const insertResult = await tokensCollection.insertOne(tokenWithComplexMetadata);
			const retrievedToken = await tokensCollection.findOne({ _id: insertResult.insertedId });

			expect(retrievedToken?.metadata).toEqual(complexMetadata);
			expect(retrievedToken?.metadata?.tags).toEqual(['urgent', 'support', 'billing']);
		});

		it('should handle null and undefined metadata', async () => {
			const conversationsCollection = getTestElevenLabsConversations();

			const conversationWithNullMetadata = createTestElevenLabsConversation({
				user_id: 'user_123',
				metadata: null,
			});

			const conversationWithoutMetadata = createTestElevenLabsConversation({
				user_id: 'user_123',
			});
			delete conversationWithoutMetadata.metadata;

			await conversationsCollection.insertMany([conversationWithNullMetadata, conversationWithoutMetadata]);

			const allConversations = await conversationsCollection.find({ user_id: 'user_123' }).toArray();
			expect(allConversations).toHaveLength(2);

			const withNull = allConversations.find(c => c.metadata === null);
			const without = allConversations.find(c => c.metadata === undefined);

			expect(withNull).toBeDefined();
			expect(without).toBeDefined();
		});
	});
});
