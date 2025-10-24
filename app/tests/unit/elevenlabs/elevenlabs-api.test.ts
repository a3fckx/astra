import { describe, expect, it, beforeEach, mock } from "bun:test";
import { ElevenLabsClient } from "@/lib/elevenlabs-api";
import type {
	ConversationTranscript,
	ConversationMessage,
	TranscriptFetchResult,
} from "@/lib/elevenlabs-api";

/**
 * ELEVENLABS API CLIENT TESTS
 * ============================
 * 
 * BUSINESS CONTEXT:
 * Tests the ElevenLabs API client with focus on the new retry logic for transcript fetching.
 * The retry mechanism is critical because ElevenLabs may take several seconds to make
 * transcripts available after a conversation ends.
 * 
 * BUSINESS IMPACT:
 * - Reliable transcript fetching = accurate conversation processing
 * - Retry logic prevents data loss from timing issues
 * - Proper filtering ensures clean, actionable transcript data
 */

describe("ElevenLabsClient - Transcript Retry Logic", () => {
	let client: ElevenLabsClient;
	let mockFetch: ReturnType<typeof mock>;

	beforeEach(() => {
		// Use test API key
		client = new ElevenLabsClient("test_api_key");
		mockFetch = mock();
	});

	describe("getTranscriptTextWithRetry", () => {
		it("should return transcript on first attempt when messages are available", async () => {
			const mockConversation: ConversationTranscript = {
				conversation_id: "conv_123",
				agent_id: "agent_456",
				status: "completed",
				transcript: [
					{
						role: "agent",
						message: "Hello, how can I help you?",
						time_in_call_secs: 1,
					},
					{
						role: "user",
						message: "Tell me about my chart",
						time_in_call_secs: 5,
					},
				],
			};

			// Mock the getConversation method
			const originalFetch = global.fetch;
			global.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () => Promise.resolve(mockConversation),
				} as Response),
			);

			const result = await client.getTranscriptTextWithRetry("conv_123", {
				maxAttempts: 1,
			});

			expect(result.text).toContain("AGENT: Hello, how can I help you?");
			expect(result.text).toContain("USER: Tell me about my chart");
			expect(result.attempts).toBe(1);
			expect(result.messageCount).toBe(2);

			global.fetch = originalFetch;
		});

		it("should retry when transcript is empty and succeed on second attempt", async () => {
			const emptyConversation: ConversationTranscript = {
				conversation_id: "conv_123",
				agent_id: "agent_456",
				status: "processing",
				transcript: [],
			};

			const populatedConversation: ConversationTranscript = {
				conversation_id: "conv_123",
				agent_id: "agent_456",
				status: "completed",
				transcript: [
					{
						role: "agent",
						message: "Your chart is ready!",
						time_in_call_secs: 1,
					},
				],
			};

			let callCount = 0;
			const originalFetch = global.fetch;
			global.fetch = mock(() => {
				callCount++;
				const data = callCount === 1 ? emptyConversation : populatedConversation;
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(data),
				} as Response);
			});

			const result = await client.getTranscriptTextWithRetry("conv_123", {
				maxAttempts: 5,
				delayMs: 10, // Short delay for tests
			});

			expect(result.text).toContain("AGENT: Your chart is ready!");
			expect(result.attempts).toBe(2);
			expect(result.messageCount).toBe(1);

			global.fetch = originalFetch;
		});

		it("should filter out messages with null content", async () => {
			const mockConversation: ConversationTranscript = {
				conversation_id: "conv_123",
				agent_id: "agent_456",
				status: "completed",
				transcript: [
					{
						role: "agent",
						message: "Real message",
						time_in_call_secs: 1,
					},
					{
						role: "agent",
						message: null,
						time_in_call_secs: 2,
					},
					{
						role: "user",
						message: "Another real message",
						time_in_call_secs: 3,
					},
				],
			};

			const originalFetch = global.fetch;
			global.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () => Promise.resolve(mockConversation),
				} as Response),
			);

			const result = await client.getTranscriptTextWithRetry("conv_123", {
				maxAttempts: 1,
			});

			expect(result.messageCount).toBe(2); // Only 2 valid messages
			expect(result.text).not.toContain("null");

			global.fetch = originalFetch;
		});

		it("should filter out messages with empty/whitespace content", async () => {
			const mockConversation: ConversationTranscript = {
				conversation_id: "conv_123",
				agent_id: "agent_456",
				status: "completed",
				transcript: [
					{
						role: "agent",
						message: "Valid message",
						time_in_call_secs: 1,
					},
					{
						role: "user",
						message: "   ",
						time_in_call_secs: 2,
					},
					{
						role: "agent",
						message: "",
						time_in_call_secs: 3,
					},
				],
			};

			const originalFetch = global.fetch;
			global.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () => Promise.resolve(mockConversation),
				} as Response),
			);

			const result = await client.getTranscriptTextWithRetry("conv_123", {
				maxAttempts: 1,
			});

			expect(result.messageCount).toBe(1);
			expect(result.text).toBe("AGENT: Valid message");

			global.fetch = originalFetch;
		});

		it("should filter out tool calls and tool results", async () => {
			const mockConversation: ConversationTranscript = {
				conversation_id: "conv_123",
				agent_id: "agent_456",
				status: "completed",
				transcript: [
					{
						role: "agent",
						message: "Let me check your chart",
						time_in_call_secs: 1,
					},
					{
						role: "agent",
						message: "Calling chart calculator",
						time_in_call_secs: 2,
						tool_calls: [{ name: "chart_calculator", params: {} }],
					},
					{
						role: "agent",
						message: "Chart calculation complete",
						time_in_call_secs: 3,
						tool_results: [{ result: "success" }],
					},
					{
						role: "agent",
						message: "Your Sun is in Leo",
						time_in_call_secs: 4,
					},
				],
			};

			const originalFetch = global.fetch;
			global.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () => Promise.resolve(mockConversation),
				} as Response),
			);

			const result = await client.getTranscriptTextWithRetry("conv_123", {
				maxAttempts: 1,
			});

			expect(result.messageCount).toBe(2); // Only first and last messages
			expect(result.text).toContain("Let me check your chart");
			expect(result.text).toContain("Your Sun is in Leo");
			expect(result.text).not.toContain("Calling chart calculator");
			expect(result.text).not.toContain("calculation complete");

			global.fetch = originalFetch;
		});

		it("should return empty result after max attempts with no messages", async () => {
			const emptyConversation: ConversationTranscript = {
				conversation_id: "conv_123",
				agent_id: "agent_456",
				status: "processing",
				transcript: [],
			};

			const originalFetch = global.fetch;
			global.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () => Promise.resolve(emptyConversation),
				} as Response),
			);

			const result = await client.getTranscriptTextWithRetry("conv_123", {
				maxAttempts: 3,
				delayMs: 10,
			});

			expect(result.text).toBe("");
			expect(result.attempts).toBe(3);
			expect(result.messageCount).toBe(0);

			global.fetch = originalFetch;
		});

		it("should handle API errors and retry", async () => {
			let callCount = 0;
			const originalFetch = global.fetch;
			global.fetch = mock(() => {
				callCount++;
				if (callCount === 1) {
					return Promise.resolve({
						ok: false,
						status: 500,
						text: () => Promise.resolve("Internal Server Error"),
					} as Response);
				}
				return Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							conversation_id: "conv_123",
							agent_id: "agent_456",
							status: "completed",
							transcript: [
								{
									role: "agent",
									message: "Success after retry",
									time_in_call_secs: 1,
								},
							],
						}),
				} as Response);
			});

			const result = await client.getTranscriptTextWithRetry("conv_123", {
				maxAttempts: 3,
				delayMs: 10,
			});

			expect(result.attempts).toBe(2);
			expect(result.text).toContain("Success after retry");

			global.fetch = originalFetch;
		});

		it("should throw error if all retry attempts fail", async () => {
			const originalFetch = global.fetch;
			global.fetch = mock(() =>
				Promise.resolve({
					ok: false,
					status: 500,
					text: () => Promise.resolve("Internal Server Error"),
				} as Response),
			);

			await expect(
				client.getTranscriptTextWithRetry("conv_123", {
					maxAttempts: 2,
					delayMs: 10,
				}),
			).rejects.toThrow();

			global.fetch = originalFetch;
		});

		it("should use correct default values for maxAttempts and delayMs", async () => {
			const mockConversation: ConversationTranscript = {
				conversation_id: "conv_123",
				agent_id: "agent_456",
				status: "completed",
				transcript: [
					{
						role: "agent",
						message: "Test message",
						time_in_call_secs: 1,
					},
				],
			};

			const originalFetch = global.fetch;
			global.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () => Promise.resolve(mockConversation),
				} as Response),
			);

			const result = await client.getTranscriptTextWithRetry("conv_123");

			// Default maxAttempts is 5, default delayMs is 2000
			expect(result.delayMs).toBe(2000);

			global.fetch = originalFetch;
		});

		it("should handle conversation with mixed valid and invalid messages", async () => {
			const mockConversation: ConversationTranscript = {
				conversation_id: "conv_123",
				agent_id: "agent_456",
				status: "completed",
				transcript: [
					{
						role: "agent",
						message: "Hello",
						time_in_call_secs: 1,
					},
					{
						role: "user",
						message: null,
						time_in_call_secs: 2,
					},
					{
						role: "agent",
						message: "   ",
						time_in_call_secs: 3,
					},
					{
						role: "user",
						message: "Hi there",
						time_in_call_secs: 4,
					},
					{
						role: "agent",
						message: "Tool call",
						time_in_call_secs: 5,
						tool_calls: [{ name: "test" }],
					},
					{
						role: "agent",
						message: "Goodbye",
						time_in_call_secs: 6,
					},
				],
			};

			const originalFetch = global.fetch;
			global.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () => Promise.resolve(mockConversation),
				} as Response),
			);

			const result = await client.getTranscriptTextWithRetry("conv_123", {
				maxAttempts: 1,
			});

			expect(result.messageCount).toBe(3); // Hello, Hi there, Goodbye
			expect(result.text).toContain("AGENT: Hello");
			expect(result.text).toContain("USER: Hi there");
			expect(result.text).toContain("AGENT: Goodbye");

			global.fetch = originalFetch;
		});
	});

	describe("getTranscriptText", () => {
		it("should call getTranscriptTextWithRetry with maxAttempts=1", async () => {
			const mockConversation: ConversationTranscript = {
				conversation_id: "conv_123",
				agent_id: "agent_456",
				status: "completed",
				transcript: [
					{
						role: "agent",
						message: "Test",
						time_in_call_secs: 1,
					},
				],
			};

			const originalFetch = global.fetch;
			global.fetch = mock(() =>
				Promise.resolve({
					ok: true,
					json: () => Promise.resolve(mockConversation),
				} as Response),
			);

			const text = await client.getTranscriptText("conv_123");

			expect(text).toContain("AGENT: Test");

			global.fetch = originalFetch;
		});
	});
});

describe("ElevenLabsClient - Edge Cases", () => {
	let client: ElevenLabsClient;

	beforeEach(() => {
		client = new ElevenLabsClient("test_api_key");
	});

	it("should handle null conversation response gracefully", async () => {
		const originalFetch = global.fetch;
		global.fetch = mock(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(null),
			} as Response),
		);

		const result = await client.getTranscriptTextWithRetry("conv_123", {
			maxAttempts: 1,
		});

		expect(result.text).toBe("");
		expect(result.messageCount).toBe(0);

		global.fetch = originalFetch;
	});

	it("should handle conversation with non-array transcript", async () => {
		const originalFetch = global.fetch;
		global.fetch = mock(() =>
			Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({
						conversation_id: "conv_123",
						agent_id: "agent_456",
						status: "completed",
						transcript: "not an array" as any,
					}),
			} as Response),
		);

		const result = await client.getTranscriptTextWithRetry("conv_123", {
			maxAttempts: 1,
		});

		expect(result.text).toBe("");
		expect(result.messageCount).toBe(0);

		global.fetch = originalFetch;
	});

	it("should handle very long messages correctly", async () => {
		const longMessage = "a".repeat(10000);
		const mockConversation: ConversationTranscript = {
			conversation_id: "conv_123",
			agent_id: "agent_456",
			status: "completed",
			transcript: [
				{
					role: "agent",
					message: longMessage,
					time_in_call_secs: 1,
				},
			],
		};

		const originalFetch = global.fetch;
		global.fetch = mock(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockConversation),
			} as Response),
		);

		const result = await client.getTranscriptTextWithRetry("conv_123", {
			maxAttempts: 1,
		});

		expect(result.text).toContain(longMessage);
		expect(result.messageCount).toBe(1);

		global.fetch = originalFetch;
	});

	it("should handle special characters in messages", async () => {
		const specialMessage = 'Hello "world" with <tags> & symbols © ™ 你好';
		const mockConversation: ConversationTranscript = {
			conversation_id: "conv_123",
			agent_id: "agent_456",
			status: "completed",
			transcript: [
				{
					role: "user",
					message: specialMessage,
					time_in_call_secs: 1,
				},
			],
		};

		const originalFetch = global.fetch;
		global.fetch = mock(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockConversation),
			} as Response),
		);

		const result = await client.getTranscriptTextWithRetry("conv_123", {
			maxAttempts: 1,
		});

		expect(result.text).toContain(specialMessage);

		global.fetch = originalFetch;
	});
});

describe("ElevenLabsClient - Convenience Functions", () => {
	it("should format transcript with proper line breaks", async () => {
		const mockConversation: ConversationTranscript = {
			conversation_id: "conv_123",
			agent_id: "agent_456",
			status: "completed",
			transcript: [
				{
					role: "agent",
					message: "First message",
					time_in_call_secs: 1,
				},
				{
					role: "user",
					message: "Second message",
					time_in_call_secs: 2,
				},
				{
					role: "agent",
					message: "Third message",
					time_in_call_secs: 3,
				},
			],
		};

		const originalFetch = global.fetch;
		global.fetch = mock(() =>
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve(mockConversation),
			} as Response),
		);

		const client = new ElevenLabsClient("test_api_key");
		const result = await client.getTranscriptTextWithRetry("conv_123", {
			maxAttempts: 1,
		});

		// Verify formatting
		expect(result.text).toContain("AGENT: First message\n\nUSER: Second message\n\nAGENT: Third message");

		global.fetch = originalFetch;
	});
});