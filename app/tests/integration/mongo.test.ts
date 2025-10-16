import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import type { MongoClient } from 'mongodb';
import {
	connectTestDatabase,
	disconnectTestDatabase,
	clearTestCollections,
	getTestUsers,
	getTestSessions,
	getTestResponderEvents,
	getTestResponderOutbox,
	createTestUser,
	createTestSession,
	createTestResponderEvent,
	createTestOutboxMessage,
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

		describe('Responder Events Collection', () => {
			it('should create and retrieve responder events', async () => {
				const eventsCollection = getTestResponderEvents();
				const testEvent = createTestResponderEvent({
					userId: 'user_123',
					role: 'user',
					content: 'Hello, this is a test message',
				});

				// Insert event
				const insertResult = await eventsCollection.insertOne(testEvent);
				expect(insertResult.insertedId).toBeDefined();

				// Retrieve event
				const retrievedEvent = await eventsCollection.findOne({ userId: 'user_123' });
				expect(retrievedEvent).toBeDefined();
				expect(retrievedEvent?.content).toBe(testEvent.content);
				expect(retrievedEvent?.role).toBe('user');
			});

			it('should sort events by creation date', async () => {
				const eventsCollection = getTestResponderEvents();
				const userId = 'user_123';
				
				const event1 = createTestResponderEvent({
					userId,
					content: 'First message',
					createdAt: new Date('2024-01-01T10:00:00Z'),
				});

				const event2 = createTestResponderEvent({
					userId,
					content: 'Second message',
					createdAt: new Date('2024-01-01T10:05:00Z'),
				});

				await eventsCollection.insertMany([event2, event1]); // Insert out of order

				// Find and sort by creation date (ascending)
				const sortedEvents = await eventsCollection
					.find({ userId })
					.sort({ createdAt: 1 })
					.toArray();

				expect(sortedEvents).toHaveLength(2);
				expect(sortedEvents[0].content).toBe('First message');
				expect(sortedEvents[1].content).toBe('Second message');
			});

			it('should handle different event roles', async () => {
				const eventsCollection = getTestResponderEvents();
				const userId = 'user_123';

				const userEvent = createTestResponderEvent({
					userId,
					role: 'user',
					content: 'User message',
				});

				const assistantEvent = createTestResponderEvent({
					userId,
					role: 'assistant',
					content: 'Assistant response',
				});

				const systemEvent = createTestResponderEvent({
					userId,
					role: 'system',
					content: 'System notification',
				});

				await eventsCollection.insertMany([userEvent, assistantEvent, systemEvent]);

				// Find all events for the user
				const userEvents = await eventsCollection.find({ userId }).toArray();
				expect(userEvents).toHaveLength(3);

				// Find events by role
				const assistantEvents = await eventsCollection.find({ userId, role: 'assistant' }).toArray();
				expect(assistantEvents).toHaveLength(1);
				expect(assistantEvents[0].role).toBe('assistant');
			});
		});

		describe('Responder Outbox Collection', () => {
			it('should create and retrieve outbox messages', async () => {
				const outboxCollection = getTestResponderOutbox();
				const testMessage = createTestOutboxMessage({
					userId: 'user_123',
					content: 'Test outbox message',
					status: 'pending',
					metadata: { source: 'web' },
				});

				// Insert message
				const insertResult = await outboxCollection.insertOne(testMessage);
				expect(insertResult.insertedId).toBeDefined();

				// Retrieve message
				const retrievedMessage = await outboxCollection.findOne({ userId: 'user_123' });
				expect(retrievedMessage).toBeDefined();
				expect(retrievedMessage?.content).toBe(testMessage.content);
				expect(retrievedMessage?.status).toBe('pending');
				expect(retrievedMessage?.metadata).toEqual({ source: 'web' });
			});

			it('should update message status through workflow', async () => {
				const outboxCollection = getTestResponderOutbox();
				const testMessage = createTestOutboxMessage({
					userId: 'user_123',
					status: 'pending',
				});

				const insertResult = await outboxCollection.insertOne(testMessage);
				const messageId = insertResult.insertedId;

				// Simulate message processing workflow
				const processingStartedAt = new Date();
				await outboxCollection.updateOne(
					{ _id: messageId },
					{ $set: { status: 'processing', processingStartedAt, workerId: 'worker_123' } }
				);

				// Mark as delivered
				await outboxCollection.updateOne(
					{ _id: messageId },
					{ $set: { status: 'delivered', updatedAt: new Date() } }
				);

				// Verify final state
				const finalMessage = await outboxCollection.findOne({ _id: messageId });
				expect(finalMessage?.status).toBe('delivered');
				expect(finalMessage?.processingStartedAt).toBeDefined();
				expect(finalMessage?.workerId).toBe('worker_123');
				expect(finalMessage?.updatedAt).toBeDefined();
			});

			it('should handle failed messages', async () => {
				const outboxCollection = getTestResponderOutbox();
				const testMessage = createTestOutboxMessage({
					userId: 'user_123',
					status: 'pending',
				});

				const insertResult = await outboxCollection.insertOne(testMessage);
				const messageId = insertResult.insertedId;

				// Simulate processing failure
			 await outboxCollection.updateOne(
					{ _id: messageId },
					{ 
						$set: { 
							status: 'failed', 
							failedAt: new Date(),
							error: 'Connection timeout',
							updatedAt: new Date() 
						} 
					}
				);

				// Verify failed state
				const failedMessage = await outboxCollection.findOne({ _id: messageId });
				expect(failedMessage?.status).toBe('failed');
				expect(failedMessage?.error).toBe('Connection timeout');
				expect(failedMessage?.failedAt).toBeDefined();
			});

			it('should find messages by status', async () => {
				const outboxCollection = getTestResponderOutbox();
				const userId = 'user_123';

				const pendingMessage = createTestOutboxMessage({ userId, status: 'pending' });
				const processingMessage = createTestOutboxMessage({ userId, status: 'processing' });
				const deliveredMessage = createTestOutboxMessage({ userId, status: 'delivered' });
				const failedMessage = createTestOutboxMessage({ userId, status: 'failed' });

				await outboxCollection.insertMany([pendingMessage, processingMessage, deliveredMessage, failedMessage]);

				// Find pending messages
				const pendingMessages = await outboxCollection.find({ userId, status: 'pending' }).toArray();
				expect(pendingMessages).toHaveLength(1);
				expect(pendingMessages[0].status).toBe('pending');

				// Find failed messages
				const failedMessages = await outboxCollection.find({ userId, status: 'failed' }).toArray();
				expect(failedMessages).toHaveLength(1);
				expect(failedMessages[0].status).toBe('failed');
			});
		});
	});

	describe('Data Integrity and Validation', () => {
		it('should handle large text content properly', async () => {
			const eventsCollection = getTestResponderEvents();
			const largeContent = 'A'.repeat(10000); // 10KB of text

			const largeEvent = createTestResponderEvent({
				userId: 'user_123',
				content: largeContent,
			});

			const insertResult = await eventsCollection.insertOne(largeEvent);
			const retrievedEvent = await eventsCollection.findOne({ _id: insertResult.insertedId });

			expect(retrievedEvent?.content).toBe(largeContent);
			expect(retrievedEvent?.content.length).toBe(10000);
		});

		it('should handle complex metadata objects', async () => {
			const outboxCollection = getTestResponderOutbox();
			const complexMetadata = {
				source: 'mobile_app',
				platform: 'iOS',
				version: '1.2.3',
				userAgent: 'Mozilla/5.0...',
				tags: ['urgent', 'support', 'billing'],
				priority: 1,
				timestamp: new Date().toISOString(),
			};

			const messageWithComplexMetadata = createTestOutboxMessage({
				userId: 'user_123',
				metadata: complexMetadata,
			});

			const insertResult = await outboxCollection.insertOne(messageWithComplexMetadata);
			const retrievedMessage = await outboxCollection.findOne({ _id: insertResult.insertedId });

			expect(retrievedMessage?.metadata).toEqual(complexMetadata);
			expect(retrievedMessage?.metadata?.tags).toEqual(['urgent', 'support', 'billing']);
		});

		it('should handle null and undefined metadata', async () => {
			const eventsCollection = getTestResponderEvents();

			const eventWithNullMetadata = createTestResponderEvent({
				userId: 'user_123',
				metadata: null,
			});

			const eventWithoutMetadata = createTestResponderEvent();
			delete eventWithoutMetadata.metadata;

			await eventsCollection.insertMany([eventWithNullMetadata, eventWithoutMetadata]);

			const allEvents = await eventsCollection.find({ userId: 'user_123' }).toArray();
			expect(allEvents).toHaveLength(2);

			const withNull = allEvents.find(e => e.metadata === null);
			const without = allEvents.find(e => e.metadata === undefined);

			expect(withNull).toBeDefined();
			expect(without).toBeDefined();
		});
	});
});
