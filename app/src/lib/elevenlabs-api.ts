import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const elevenLabsLogger = logger.child("elevenlabs:api");

/**
 * Base URL for ElevenLabs API
 */
const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";

/**
 * Message in a conversation transcript
 */
export interface ConversationMessage {
	role: "user" | "agent";
	message: string;
	timestamp: string;
}

/**
 * Full conversation transcript structure from ElevenLabs
 */
export interface ConversationTranscript {
	conversation_id: string;
	agent_id: string;
	status: string;
	metadata?: Record<string, unknown>;
	transcript: {
		messages: ConversationMessage[];
	};
}

/**
 * Conversation metadata from ElevenLabs
 */
export interface ConversationMetadata {
	conversation_id: string;
	agent_id: string;
	user_id?: string;
	status: "active" | "completed" | "failed";
	created_at: string;
	updated_at: string;
	metadata?: Record<string, unknown>;
}

/**
 * Options for fetching conversations
 */
export interface ListConversationsOptions {
	limit?: number;
	offset?: number;
	status?: "active" | "completed" | "failed";
}

/**
 * ElevenLabs API client for conversation and transcript management
 */
export class ElevenLabsClient {
	private apiKey: string;
	private baseUrl: string;

	constructor(apiKey?: string) {
		this.apiKey = apiKey || env.elevenLabsApiKey || "";
		this.baseUrl = ELEVENLABS_API_BASE;

		if (!this.apiKey) {
			elevenLabsLogger.warn(
				"ElevenLabs API key not provided. API calls will fail.",
			);
		}
	}

	/**
	 * Make a request to the ElevenLabs API
	 */
	private async request<T>(
		endpoint: string,
		options: RequestInit = {},
	): Promise<T> {
		const url = `${this.baseUrl}${endpoint}`;

		try {
			const response = await fetch(url, {
				...options,
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					"Content-Type": "application/json",
					...options.headers,
				},
			});

			if (!response.ok) {
				const errorText = await response.text();
				elevenLabsLogger.error("ElevenLabs API request failed", {
					endpoint,
					status: response.status,
					statusText: response.statusText,
					error: errorText,
				});

				throw new Error(
					`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`,
				);
			}

			const data = await response.json();
			return data as T;
		} catch (error) {
			elevenLabsLogger.error("ElevenLabs API request exception", {
				endpoint,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Fetch a conversation transcript by ID
	 *
	 * @param conversationId - The ElevenLabs conversation ID
	 * @returns Full conversation transcript with messages
	 *
	 * @example
	 * ```typescript
	 * const client = new ElevenLabsClient();
	 * const transcript = await client.getConversation('conv_abc123');
	 * console.log(transcript.transcript.messages);
	 * ```
	 */
	async getConversation(
		conversationId: string,
	): Promise<ConversationTranscript> {
		elevenLabsLogger.info("Fetching conversation", { conversationId });

		const transcript = await this.request<ConversationTranscript>(
			`/convai/conversations/${conversationId}`,
		);

		elevenLabsLogger.info("Conversation fetched successfully", {
			conversationId,
			messageCount: transcript.transcript?.messages?.length || 0,
		});

		return transcript;
	}

	/**
	 * Extract plain text transcript from conversation messages
	 *
	 * @param conversationId - The ElevenLabs conversation ID
	 * @returns Formatted transcript text
	 *
	 * @example
	 * ```typescript
	 * const client = new ElevenLabsClient();
	 * const text = await client.getTranscriptText('conv_abc123');
	 * // Returns:
	 * // "USER: Hello
	 * //  AGENT: Hi there!
	 * //  USER: How are you?"
	 * ```
	 */
	async getTranscriptText(conversationId: string): Promise<string> {
		try {
			const conversation = await this.getConversation(conversationId);

			if (!conversation.transcript?.messages) {
				elevenLabsLogger.warn("No transcript messages found", {
					conversationId,
				});
				return "";
			}

			const transcriptText = conversation.transcript.messages
				.map((msg) => `${msg.role.toUpperCase()}: ${msg.message}`)
				.join("\n\n");

			elevenLabsLogger.debug("Transcript text extracted", {
				conversationId,
				length: transcriptText.length,
			});

			return transcriptText;
		} catch (error) {
			elevenLabsLogger.error("Failed to extract transcript text", {
				conversationId,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * List conversations for an agent
	 *
	 * @param agentId - The ElevenLabs agent ID
	 * @param options - Pagination and filtering options
	 * @returns Array of conversation metadata
	 *
	 * @example
	 * ```typescript
	 * const client = new ElevenLabsClient();
	 * const conversations = await client.listConversations('agent_123', {
	 *   limit: 10,
	 *   status: 'completed'
	 * });
	 * ```
	 */
	async listConversations(
		agentId: string,
		options: ListConversationsOptions = {},
	): Promise<ConversationMetadata[]> {
		const { limit = 50, offset = 0, status } = options;

		const queryParams = new URLSearchParams({
			limit: limit.toString(),
			offset: offset.toString(),
			...(status && { status }),
		});

		elevenLabsLogger.info("Listing conversations", {
			agentId,
			limit,
			offset,
			status,
		});

		const response = await this.request<{
			conversations: ConversationMetadata[];
		}>(`/convai/agents/${agentId}/conversations?${queryParams}`);

		elevenLabsLogger.info("Conversations listed successfully", {
			agentId,
			count: response.conversations?.length || 0,
		});

		return response.conversations || [];
	}

	/**
	 * Get conversation metadata without the full transcript
	 *
	 * Useful for checking status or metadata without fetching all messages
	 *
	 * @param conversationId - The ElevenLabs conversation ID
	 * @returns Conversation metadata
	 */
	async getConversationMetadata(
		conversationId: string,
	): Promise<ConversationMetadata> {
		elevenLabsLogger.info("Fetching conversation metadata", { conversationId });

		// Note: ElevenLabs API might not have a dedicated metadata endpoint
		// In that case, we fetch the full conversation and extract metadata
		const conversation = await this.getConversation(conversationId);

		const metadata: ConversationMetadata = {
			conversation_id: conversation.conversation_id,
			agent_id: conversation.agent_id,
			status: conversation.status as "active" | "completed" | "failed",
			created_at: "", // ElevenLabs should provide this
			updated_at: "", // ElevenLabs should provide this
			metadata: conversation.metadata,
		};

		return metadata;
	}

	/**
	 * Check if a conversation is complete
	 *
	 * @param conversationId - The ElevenLabs conversation ID
	 * @returns True if conversation has ended
	 */
	async isConversationComplete(conversationId: string): Promise<boolean> {
		try {
			const metadata = await this.getConversationMetadata(conversationId);
			return metadata.status === "completed";
		} catch (error) {
			elevenLabsLogger.error("Failed to check conversation status", {
				conversationId,
				error: error instanceof Error ? error.message : String(error),
			});
			return false;
		}
	}
}

/**
 * Default ElevenLabs client instance
 *
 * Uses API key from environment variables
 */
export const elevenLabsClient = new ElevenLabsClient();

/**
 * Fetch conversation transcript text (convenience function)
 *
 * @param conversationId - The ElevenLabs conversation ID
 * @returns Formatted transcript text
 *
 * @example
 * ```typescript
 * const text = await fetchConversationTranscript('conv_abc123');
 * ```
 */
export async function fetchConversationTranscript(
	conversationId: string,
): Promise<string> {
	return elevenLabsClient.getTranscriptText(conversationId);
}

/**
 * Fetch full conversation data (convenience function)
 *
 * @param conversationId - The ElevenLabs conversation ID
 * @returns Full conversation transcript
 */
export async function fetchConversation(
	conversationId: string,
): Promise<ConversationTranscript> {
	return elevenLabsClient.getConversation(conversationId);
}

/**
 * List conversations for an agent (convenience function)
 *
 * @param agentId - The ElevenLabs agent ID
 * @param options - Pagination and filtering options
 * @returns Array of conversation metadata
 */
export async function listAgentConversations(
	agentId: string,
	options?: ListConversationsOptions,
): Promise<ConversationMetadata[]> {
	return elevenLabsClient.listConversations(agentId, options);
}
