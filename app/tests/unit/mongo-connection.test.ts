import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { MongoClient } from 'mongodb';

// Import the actual mongo module (we'll test its core functionality)
const mongoModulePath = '../../src/lib/mongo';

describe('MongoDB Connection Module', () => {
	beforeEach(() => {
		// Reset the global MongoDB client before each test
		const globalAny = global as any;
		if (globalAny.__mongoClient) {
			delete globalAny.__mongoClient;
		}
	});

	afterEach(async () => {
		// Clean up any created connections
		const globalAny = global as any;
		if (globalAny.__mongoClient) {
			try {
				await globalAny.__mongoClient.close();
			} catch (error) {
				// Ignore cleanup errors
			}
			delete globalAny.__mongoClient;
		}
	});

	describe('Global Client Management', () => {
		it('should use global client in non-production environment', async () => {
			// Mock non-production environment
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = 'development';

			// Mock environment variables
			const originalMongoUri = process.env.MONGODB_URI;
			process.env.MONGODB_URI = 'mongodb://localhost:27017/test_astra';

			try {
				// Import the module to trigger client creation
				const mongoModule = await import(mongoModulePath);
				
				// The module should have created a global client
				const globalAny = global as any;
				expect(globalAny.__mongoClient).toBeDefined();
				expect(globalAny.__mongoClient).toBeInstanceOf(MongoClient);

				// Multiple calls should return the same client
				const client1 = mongoModule.getMongoClient();
				const client2 = mongoModule.getMongoClient();
				expect(client1).toBe(client2);
			} finally {
				// Restore environment
				process.env.NODE_ENV = originalEnv;
				process.env.MONGODB_URI = originalMongoUri;
			}
		});

		it('should not use global client in production environment', async () => {
			// Mock production environment
			const originalEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = 'production';

			// Mock environment variables
			const originalMongoUri = process.env.MONGODB_URI;
			process.env.MONGODB_URI = 'mongodb://localhost:27017/test_astra';

			try {
				// Import the module
				const mongoModule = await import(mongoModulePath);
				
				// The client should be created without global storage
				const globalAny = global as any;
				expect(globalAny.__mongoClient).toBeUndefined();

				// But we should still get a valid client
				const client = mongoModule.getMongoClient();
				expect(client).toBeInstanceOf(MongoClient);
			} finally {
				// Restore environment
				process.env.NODE_ENV = originalEnv;
				process.env.MONGODB_URI = originalMongoUri;
			}
		});
	});

	describe('Database Instance Management', () => {
		it('should provide a consistent database instance', async () => {
			// Mock environment variables
			const originalMongoUri = process.env.MONGODB_URI;
			process.env.MONGODB_URI = 'mongodb://localhost:27017/test_astra';
			const originalMongoDb = process.env.MONGODB_DB;
			process.env.MONGODB_DB = 'test_astra';

			try {
				const mongoModule = await import(mongoModulePath);
				
				const db1 = mongoModule.getMongoDb();
				const db2 = mongoModule.getMongoDb();
				
				expect(db1).toBe(db2);
				expect(db1.databaseName).toBe('test_astra');
			} finally {
				// Restore environment
				process.env.MONGODB_URI = originalMongoUri;
				process.env.MONGODB_DB = originalMongoDb;
			}
		});
	});

	describe('Collection Getters', () => {
		it('should provide typed collection accessors', async () => {
			// Mock environment variables
			const originalMongoUri = process.env.MONGODB_URI;
			process.env.MONGODB_URI = 'mongodb://localhost:27017/test_astra';

			try {
				const mongoModule = await import(mongoModulePath);
				
				// Test that collection getters return collection objects
				const usersCollection = mongoModule.getUsers();
				const sessionsCollection = mongoModule.getSessions();
				const eventsCollection = mongoModule.getResponderEvents();
				const outboxCollection = mongoModule.getResponderOutbox();

				expect(usersCollection).toBeDefined();
				expect(usersCollection.collectionName).toBe('user');
				
				expect(sessionsCollection).toBeDefined();
				expect(sessionsCollection.collectionName).toBe('astra_sessions');
				
				expect(eventsCollection).toBeDefined();
				expect(eventsCollection.collectionName).toBe('responder_events');
				
				expect(outboxCollection).toBeDefined();
				expect(outboxCollection.collectionName).toBe('responder_outbox');
			} finally {
				// Restore environment
				process.env.MONGODB_URI = originalMongoUri;
			}
		});

		it('should provide generic collection getter', async () => {
			// Mock environment variables
			const originalMongoUri = process.env.MONGODB_URI;
			process.env.MONGODB_URI = 'mongodb://localhost:27017/test_astra';

			try {
				const mongoModule = await import(mongoModulePath);
				
				const customCollection = mongoModule.getCollection('custom_items');
				expect(customCollection).toBeDefined();
				expect(customCollection.collectionName).toBe('custom_items');
			} finally {
				// Restore environment
				process.env.MONGODB_URI = originalMongoUri;
			}
		});
	});

	describe('Type Definitions', () => {
		it('should have proper TypeScript interfaces', async () => {
			const mongoModule = await import(mongoModulePath);
			
			// We can't directly test types at runtime, but we can verify
			// that the module exports the expected types and functions
			expect(typeof mongoModule.getUsers).toBe('function');
			expect(typeof mongoModule.getSessions).toBe('function');
			expect(typeof mongoModule.getResponderEvents).toBe('function');
			expect(typeof mongoModule.getResponderOutbox).toBe('function');
			expect(typeof mongoModule.getCollection).toBe('function');
			expect(typeof mongoModule.getMongoClient).toBe('function');
			expect(typeof mongoModule.getMongoDb).toBe('function');
		});

		it('should export type definitions for external use', async () => {
			const mongoModule = await import(mongoModulePath);
			
			// These should be available as named exports
			expect(mongoModule.AstraUser).toBeDefined();
			expect(mongoModule.AstraSession).toBeDefined();
			expect(mongoModule.ResponderEvent).toBeDefined();
			expect(mongoModule.ResponderOutboxMessage).toBeDefined();
		});
	});

	describe('Error Handling', () => {
		it('should handle connection errors gracefully', async () => {
			// Use an invalid MongoDB URI to simulate connection error
			const originalMongoUri = process.env.MONGODB_URI;
			process.env.MONGODB_URI = 'mongodb://invalid-host:27017/test_astra';

			try {
				// Import the module (should not throw immediately)
				const mongoModule = await import(mongoModulePath);
				
				// Get the client (connection is established lazily)
				const client = mongoModule.getMongoClient();
				
				// The connection error should be caught and logged
				// (we expect this to fail silently but not crash)
				expect(client).toBeInstanceOf(MongoClient);
				
				// Try to connect to trigger the connection attempt
				// This should be caught by the error handler in the module
				await expect(client.connect()).rejects.toThrow();
			} finally {
				// Restore environment
				process.env.MONGODB_URI = originalMongoUri;
			}
		});
	});
});
