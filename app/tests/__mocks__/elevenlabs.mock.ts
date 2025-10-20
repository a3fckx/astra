/**
 * Voice Session Test Mocks
 *
 * Provides mock implementations of ElevenLabs SDK and voice session dependencies
 * for comprehensive unit and integration testing.
 *
 * Business Context:
 * - Voice sessions are core revenue-generating features
 * - Testing prevents regressions that break voice functionality
 * - Mocks enable fast, reliable tests without external API dependencies
 */

import type { SessionHandshake } from "@/components/voice-session/types";

/**
 * Mock ElevenLabs Conversation Hook
 * Simulates the @elevenlabs/react useConversation hook
 */
export interface MockUseConversationReturn {
	startSession: jest.Mock | ((config: any) => Promise<string>);
	endSession: jest.Mock | (() => Promise<void>);
	sendContextualUpdate?: jest.Mock | ((message: string) => void);
	sendMCPToolApprovalResult?: jest.Mock | ((toolCallId: string, approved: boolean) => void);
}

export interface MockConversationConfig {
	micMuted?: boolean;
	onMessage?: (payload: any) => void;
	onError?: (message: string, details: any) => void;
	onStatusChange?: (status: { status: string }) => void;
	onDisconnect?: (details: any) => void;
	onConversationMetadata?: (metadata: any) => void;
	onUnhandledClientToolCall?: (call: any) => void;
	onMCPToolCall?: (call: any) => void;
	onMCPConnectionStatus?: (status: any) => void;
	clientTools?: Record<string, (params: any) => any>;
}

let mockConversationConfig: MockConversationConfig = {};

export function createMockUseConversation(
	overrides?: Partial<MockUseConversationReturn>,
): MockUseConversationReturn {
	return {
		startSession: jest.fn().mockResolvedValue("conv_mock_123"),
		endSession: jest.fn().mockResolvedValue(undefined),
		sendContextualUpdate: jest.fn(),
		sendMCPToolApprovalResult: jest.fn(),
		...overrides,
	};
}

export function getMockConversationConfig(): MockConversationConfig {
	return mockConversationConfig;
}

export function setMockConversationConfig(config: MockConversationConfig): void {
	mockConversationConfig = config;
}

export function resetMockConversationConfig(): void {
	mockConversationConfig = {};
}

/**
 * Mock Session Handshake Data
 * Provides realistic test data for session handshake responses
 */
export function createMockSessionHandshake(
	overrides?: Partial<SessionHandshake>,
): SessionHandshake {
	return {
		session: {
			user: {
				id: "user_mock_123",
				email: "test@example.com",
				name: "Test User",
				dateOfBirth: "1990-01-15",
				birthTime: "14:30",
				birthPlace: "New Delhi, India",
				...overrides?.session?.user,
			},
			workflowId: "astra-responder",
			julep: {
				sessionId: "fake_julep_session_id_for_testing",
				...overrides?.session?.julep,
			},
			...overrides?.session,
		},
		integrations: {
			elevenlabs: {
				// ggignore - This is a fake test token, not a real secret
				token: "fake_elevenlabs_token_for_testing",
				...overrides?.integrations?.elevenlabs,
			},
			memoryStore: {
				// ggignore - This is a fake test token, not a real secret
				token: "fake_memory_store_token_for_testing",
				...overrides?.integrations?.memoryStore,
			},
			...overrides?.integrations,
		},
		prompt: overrides?.prompt ?? null,
	};
}

/**
 * Mock Session Handshake - Minimal User Data
 * User without birth data (new user scenario)
 */
export function createMockSessionHandshakeMinimal(): SessionHandshake {
	return {
		session: {
			user: {
				id: "user_new_123",
				email: "newuser@example.com",
				name: "New User",
			},
			workflowId: "astra-responder",
			julep: {
				sessionId: "fake_julep_session_id_for_testing_minimal",
			},
		},
		integrations: {
			elevenlabs: {
				// ggignore - This is a fake test token, not a real secret
				token: "fake_elevenlabs_token_for_testing_minimal",
			},
		},
		prompt: null,
	};
}

/**
 * Mock Session Handshake - No Julep Session
 * Tests graceful degradation when Julep is unavailable
 */
export function createMockSessionHandshakeNoJulep(): SessionHandshake {
	return {
		session: {
			user: {
				id: "user_no_julep_123",
				email: "nojulep@example.com",
				name: "No Julep User",
			},
			workflowId: "astra-responder",
		},
		integrations: {
			elevenlabs: {
				// ggignore - This is a fake test token, not a real secret
				token: "fake_elevenlabs_token_for_testing_no_julep",
			},
		},
		prompt: null,
	};
}

/**
 * Mock Session Handshake - Missing Integration Tokens
 * Tests handling of missing external service tokens
 */
export function createMockSessionHandshakeNoTokens(): SessionHandshake {
	return {
		session: {
			user: {
				id: "user_no_tokens_123",
				email: "notokens@example.com",
				name: "No Tokens User",
			},
			workflowId: "astra-responder",
			julep: {
				sessionId: "fake_julep_session_id_for_testing_no_tokens",
			},
		},
		integrations: {},
		prompt: null,
	};
}

/**
 * Mock Dynamic Variables
 * Typical dynamic variables passed to ElevenLabs
 */
export function createMockDynamicVariables(
	overrides?: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
	return {
		user_name: "Test User",
		workflow_id: "astra-responder",
		julep_session_id: "fake_julep_session_id_for_testing",
		// ggignore - This is a fake test token, not a real secret
		elevenlabs_user_token: "fake_elevenlabs_user_token_for_testing",
		date_of_birth: "1990-01-15",
		birth_time: "14:30",
		birth_place: "New Delhi, India",
		...overrides,
	};
}

/**
 * Mock Fetch Response - Signed URL
 */
export function createMockSignedUrlResponse(signedUrl?: string): Response {
	return {
		ok: true,
		status: 200,
		json: async () => ({
			signedUrl: signedUrl ?? "wss://mock.elevenlabs.io/ws",
		}),
	} as Response;
}

/**
 * Mock Fetch Response - Error
 */
export function createMockErrorResponse(status: number, error: string): Response {
	return {
		ok: false,
		status,
		json: async () => ({ error }),
	} as Response;
}

/**
 * Mock Conversation Events
 * Simulate ElevenLabs conversation lifecycle events
 */
export interface MockConversationEvents {
	triggerMessage: (source: "ai" | "user", message: string) => void;
	triggerError: (message: string, details?: any) => void;
	triggerStatusChange: (status: "connecting" | "connected" | "disconnecting" | "disconnected") => void;
	triggerDisconnect: (reason?: string, message?: string) => void;
	triggerMetadata: (metadata: any) => void;
	triggerClientToolCall: (toolName: string, parameters: any) => void;
	triggerMCPToolCall: (toolCallId: string, serviceId: string, state: string) => void;
}

let eventHandlers: MockConversationConfig = {};

export function createMockConversationEvents(): MockConversationEvents {
	return {
		triggerMessage: (source, message) => {
			if (eventHandlers.onMessage) {
				eventHandlers.onMessage({ source, message });
			}
		},
		triggerError: (message, details = {}) => {
			if (eventHandlers.onError) {
				eventHandlers.onError(message, details);
			}
		},
		triggerStatusChange: (status) => {
			if (eventHandlers.onStatusChange) {
				eventHandlers.onStatusChange({ status });
			}
		},
		triggerDisconnect: (reason = "user_hangup", message = "Disconnected") => {
			if (eventHandlers.onDisconnect) {
				eventHandlers.onDisconnect({ reason, message });
			}
		},
		triggerMetadata: (metadata) => {
			if (eventHandlers.onConversationMetadata) {
				eventHandlers.onConversationMetadata(metadata);
			}
		},
		triggerClientToolCall: (toolName, parameters) => {
			if (eventHandlers.onUnhandledClientToolCall) {
				eventHandlers.onUnhandledClientToolCall({ toolName, parameters });
			}
		},
		triggerMCPToolCall: (toolCallId, serviceId, state) => {
			if (eventHandlers.onMCPToolCall) {
				eventHandlers.onMCPToolCall({
					tool_call_id: toolCallId,
					service_id: serviceId,
					state,
				});
			}
		},
	};
}

export function registerEventHandlers(handlers: MockConversationConfig): void {
	eventHandlers = handlers;
}

export function clearEventHandlers(): void {
	eventHandlers = {};
}

/**
 * Mock Microphone Access
 * Simulates browser microphone permission states
 */
export type MockMicrophoneStatus = "granted" | "denied" | "prompt" | "unsupported";

export function createMockMicrophoneAccess(
	status: MockMicrophoneStatus = "granted",
): () => Promise<void> {
	return jest.fn().mockImplementation(async () => {
		if (status === "denied") {
			throw new Error("Microphone access denied");
		}
		if (status === "unsupported") {
			throw new Error("Microphone not supported");
		}
		// "granted" and "prompt" both succeed
	});
}

/**
 * Mock Agent Prompt
 * Sample agent system prompt for testing
 */
export function createMockAgentPrompt(): string {
	return `You are Jadugar, a cosmic astrology companion.
You speak with warmth and wisdom, guiding users through their astrological journey.
Use the user's birth data to provide personalized insights.`;
}

/**
 * Test Scenario Builders
 * Pre-configured scenarios for common test cases
 */
export const testScenarios = {
	/**
	 * Happy Path: Complete user with all data
	 */
	happyPath: () => ({
		handshake: createMockSessionHandshake(),
		dynamicVariables: createMockDynamicVariables(),
		micStatus: "granted" as const,
		agentPrompt: null,
	}),

	/**
	 * New User: Minimal data, no birth info
	 */
	newUser: () => ({
		handshake: createMockSessionHandshakeMinimal(),
		dynamicVariables: createMockDynamicVariables({
			date_of_birth: undefined,
			birth_time: undefined,
			birth_place: undefined,
		}),
		micStatus: "granted" as const,
		agentPrompt: null,
	}),

	/**
	 * Degraded Mode: No Julep session (memory unavailable)
	 */
	noJulep: () => ({
		handshake: createMockSessionHandshakeNoJulep(),
		dynamicVariables: createMockDynamicVariables({
			julep_session_id: undefined,
		}),
		micStatus: "granted" as const,
		agentPrompt: null,
	}),

	/**
	 * Permission Denied: Microphone access blocked
	 */
	micDenied: () => ({
		handshake: createMockSessionHandshake(),
		dynamicVariables: createMockDynamicVariables(),
		micStatus: "denied" as const,
		agentPrompt: null,
	}),

	/**
	 * Custom Prompt: Testing prompt override
	 */
	customPrompt: () => ({
		handshake: createMockSessionHandshake(),
		dynamicVariables: createMockDynamicVariables(),
		micStatus: "granted" as const,
		agentPrompt: createMockAgentPrompt(),
	}),
};

/**
 * Assertion Helpers
 * Common test assertions for voice sessions
 */
export const assertions = {
	/**
	 * Assert startSession called with correct config
	 */
	assertStartSessionCalledCorrectly: (
		startSessionMock: jest.Mock,
		expectedUserId: string,
		expectedDynamicVars: Record<string, any>,
	) => {
		expect(startSessionMock).toHaveBeenCalledTimes(1);
		const callArgs = startSessionMock.mock.calls[0][0];
		expect(callArgs).toHaveProperty("signedUrl");
		expect(callArgs).toHaveProperty("connectionType", "websocket");
		expect(callArgs).toHaveProperty("userId", expectedUserId);
		expect(callArgs).toHaveProperty("dynamicVariables");
		expect(callArgs.dynamicVariables).toMatchObject(expectedDynamicVars);
	},

	/**
	 * Assert conversation metadata persisted to MongoDB
	 */
	assertConversationPersisted: (
		fetchMock: jest.Mock,
		conversationId: string,
		agentId: string,
	) => {
		const persistCalls = fetchMock.mock.calls.filter(
			(call) => call[0] === "/api/responder/conversations",
		);
		expect(persistCalls.length).toBeGreaterThan(0);
		const lastPersistCall = persistCalls[persistCalls.length - 1];
		const body = JSON.parse(lastPersistCall[1].body);
		expect(body.conversationId).toBe(conversationId);
		expect(body.agentId).toBe(agentId);
	},

	/**
	 * Assert no sensitive data in logs
	 */
	assertNoSensitiveDataLogged: (consoleSpy: jest.SpyInstance) => {
		const allLogs = consoleSpy.mock.calls.flat().join(" ");
		expect(allLogs).not.toMatch(/password|secret|token|api[_-]?key/i);
	},
};

/**
 * Cleanup Helper
 * Reset all mocks between tests
 */
export function cleanupMocks(): void {
	resetMockConversationConfig();
	clearEventHandlers();
}
