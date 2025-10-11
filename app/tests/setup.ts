import { beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';

// Global test setup and teardown
beforeAll(async () => {
	// Global test setup can go here
	console.log('Setting up test environment...');
});

afterAll(async () => {
	// Global test cleanup can go here
	console.log('Cleaning up test environment...');
});

beforeEach(async () => {
	// Reset any global state before each test
});

afterEach(async () => {
	// Clean up after each test
});

// Set default test timeout
Bun.env.NODE_ENV = 'test';
