import { Julep } from "@julep/sdk";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const julepLogger = logger.child("julep:client");

/**
 * Task execution status
 */
export type TaskExecutionStatus =
	| "queued"
	| "starting"
	| "running"
	| "awaiting_input"
	| "succeeded"
	| "failed"
	| "cancelled";

/**
 * Task execution result
 */
export interface TaskExecutionResult {
	id: string;
	task_id: string;
	status: TaskExecutionStatus;
	output?: unknown;
	error?: string;
	created_at?: string;
	updated_at?: string;
}

/**
 * Options for polling task execution
 */
export interface PollOptions {
	maxAttempts?: number;
	intervalMs?: number;
	onProgress?: (status: TaskExecutionStatus, attempt: number) => void;
}

/**
 * Options for creating a task execution
 */
export interface ExecuteTaskOptions {
	input: Record<string, unknown>;
	metadata?: Record<string, unknown>;
	pollOptions?: PollOptions;
}

/**
 * Julep client wrapper for Astra project
 *
 * Provides simplified interface for task execution and agent management
 */
export class JulepClient {
	private client: Julep;
	private project: string;

	constructor(apiKey?: string, project = "astra") {
		const key = apiKey || env.julepApiKey || "";

		if (!key) {
			julepLogger.warn("Julep API key not provided. API calls will fail.");
		}

		this.client = new Julep({
			apiKey: key,
			environment: "production",
		});

		this.project = project;

		julepLogger.info("Julep client initialized", { project });
	}

	/**
	 * Get the underlying Julep SDK client
	 *
	 * Use this for direct access to SDK methods
	 */
	get sdk(): Julep {
		return this.client;
	}

	/**
	 * Create a Julep user
	 *
	 * @param email - User email address
	 * @param metadata - Additional user metadata
	 * @returns Created user object
	 */
	async createUser(email: string, metadata?: Record<string, unknown>) {
		julepLogger.info("Creating Julep user", { email });

		try {
			const user = await this.client.users.create({
				project: this.project,
				email,
				metadata,
			});

			julepLogger.info("Julep user created", { userId: user.id, email });

			return user;
		} catch (error) {
			julepLogger.error("Failed to create Julep user", {
				email,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Get a Julep user by ID
	 *
	 * @param userId - Julep user ID
	 * @returns User object
	 */
	async getUser(userId: string) {
		try {
			const user = await this.client.users.get(userId, {
				project: this.project,
			});

			return user;
		} catch (error) {
			julepLogger.error("Failed to get Julep user", {
				userId,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Create a user document
	 *
	 * @param userId - Julep user ID
	 * @param type - Document type (e.g., "profile", "preferences")
	 * @param content - Document content
	 * @param metadata - Document metadata
	 * @returns Created document
	 */
	async createUserDoc(
		userId: string,
		type: string,
		content: Record<string, unknown>,
		metadata?: Record<string, unknown>,
	) {
		julepLogger.info("Creating user document", { userId, type });

		try {
			const doc = await this.client.users.docs.create({
				project: this.project,
				userId,
				type,
				content,
				metadata: {
					...metadata,
					updated_by: "system",
					timestamp_iso: new Date().toISOString(),
				},
			});

			julepLogger.info("User document created", {
				userId,
				type,
				docId: doc.id,
			});

			return doc;
		} catch (error) {
			julepLogger.error("Failed to create user document", {
				userId,
				type,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Search user documents
	 *
	 * @param userId - Julep user ID
	 * @param query - Search query
	 * @param options - Search options
	 * @returns Array of matching documents
	 */
	async searchUserDocs(
		userId: string,
		query: string,
		options?: {
			type?: string;
			limit?: number;
			metadata_filter?: Record<string, unknown>;
		},
	) {
		try {
			const results = await this.client.users.docs.search({
				project: this.project,
				userId,
				text: query,
				metadata_filter: options?.metadata_filter,
				limit: options?.limit || 10,
			});

			julepLogger.debug("User documents searched", {
				userId,
				query,
				resultsCount: results.docs?.length || 0,
			});

			return results.docs || [];
		} catch (error) {
			julepLogger.error("Failed to search user documents", {
				userId,
				query,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Get an agent by ID
	 *
	 * @param agentId - Julep agent ID
	 * @returns Agent object
	 */
	async getAgent(agentId: string) {
		try {
			const agent = await this.client.agents.get(agentId, {
				project: this.project,
			});

			return agent;
		} catch (error) {
			julepLogger.error("Failed to get agent", {
				agentId,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Create a task from definition
	 *
	 * @param agentId - Agent ID to run the task
	 * @param taskDefinition - Task definition object (parsed YAML)
	 * @returns Created task
	 */
	async createTask(agentId: string, taskDefinition: unknown) {
		julepLogger.info("Creating task", { agentId });

		try {
			const task = await this.client.tasks.create(agentId, taskDefinition);

			julepLogger.info("Task created", { agentId, taskId: task.id });

			return task;
		} catch (error) {
			julepLogger.error("Failed to create task", {
				agentId,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Execute a task and optionally poll for completion
	 *
	 * ANCHOR:julep-task-polling
	 * Central choke point for every background workflow. This helper wraps the
	 * Julep executions API so the application always:
	 *   1. dispatches an execution with the exact payload our YAML tasks expect
	 *   2. polls until completion (2s cadence, 2 min cap by default)
	 *   3. returns the normalized JSON that downstream Mongo updaters can merge
	 *
	 * Business context:
	 * - Transcript pipeline sends: julep_user_id, conversation_id, transcript_text,
	 *   existing_overview snapshot, and optional memory_store_token.
	 * - Chart/gamification/report tasks piggyback on the same polling logic to keep
	 *   Mongo + Julep docs in sync.
	 * - Execution metadata (execution_id/task_id) is recorded on the conversation
	 *   record so the dashboard can trace every run.
	 *
	 * Any change here must stay aligned with the YAML task inputs/outputs documented
	 * in agents/tasks/*.yaml (especially transcript-processor) or the merge logic in
	 * transcript-processor.ts will drift.
	 *
	 * @param taskId - Task ID to execute
	 * @param options - Execution options
	 * @returns Task execution result
	 */
	async executeTask(
		taskId: string,
		options: ExecuteTaskOptions,
	): Promise<TaskExecutionResult> {
		julepLogger.info("Executing task", { taskId, input: options.input });

		try {
			const execution = await this.client.executions.create(taskId, {
				input: options.input,
				metadata: options.metadata,
			});

			julepLogger.info("Task execution started", {
				taskId,
				executionId: execution.id,
			});

			// If poll options provided, wait for completion
			if (options.pollOptions) {
				return await this.pollExecution(execution.id, options.pollOptions);
			}

			return {
				id: execution.id,
				task_id: taskId,
				status: execution.status as TaskExecutionStatus,
				output: execution.output,
				error: execution.error,
			};
		} catch (error) {
			julepLogger.error("Failed to execute task", {
				taskId,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Get execution status
	 *
	 * @param executionId - Execution ID
	 * @returns Execution result
	 */
	async getExecution(executionId: string): Promise<TaskExecutionResult> {
		try {
			const execution = await this.client.executions.get(executionId);

			return {
				id: execution.id,
				task_id: execution.task_id || "",
				status: execution.status as TaskExecutionStatus,
				output: execution.output,
				error: execution.error,
				created_at: execution.created_at,
				updated_at: execution.updated_at,
			};
		} catch (error) {
			julepLogger.error("Failed to get execution", {
				executionId,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}

	/**
	 * Poll execution until completion
	 *
	 * @param executionId - Execution ID to poll
	 * @param options - Polling options
	 * @returns Final execution result
	 */
	async pollExecution(
		executionId: string,
		options: PollOptions = {},
	): Promise<TaskExecutionResult> {
		const { maxAttempts = 60, intervalMs = 2000, onProgress } = options;

		let attempt = 0;

		julepLogger.info("Starting execution polling", {
			executionId,
			maxAttempts,
			intervalMs,
		});

		while (attempt < maxAttempts) {
			const result = await this.getExecution(executionId);

			// Call progress callback if provided
			if (onProgress) {
				onProgress(result.status, attempt + 1);
			}

			julepLogger.debug("Polling execution", {
				executionId,
				attempt: attempt + 1,
				status: result.status,
			});

			// Check if execution is complete
			if (
				result.status === "succeeded" ||
				result.status === "failed" ||
				result.status === "cancelled"
			) {
				julepLogger.info("Execution completed", {
					executionId,
					status: result.status,
					attempts: attempt + 1,
				});

				return result;
			}

			// Wait before next poll
			await new Promise((resolve) => setTimeout(resolve, intervalMs));
			attempt++;
		}

		// Timeout reached
		julepLogger.error("Execution polling timeout", {
			executionId,
			maxAttempts,
		});

		throw new Error(
			`Execution polling timeout after ${maxAttempts} attempts (${(maxAttempts * intervalMs) / 1000}s)`,
		);
	}

	/**
	 * Create and execute a task in one call
	 *
	 * Convenience method for common workflow
	 *
	 * @param agentId - Agent ID
	 * @param taskDefinition - Task definition
	 * @param input - Task input
	 * @param pollOptions - Optional polling options
	 * @returns Task execution result
	 */
	async createAndExecuteTask(
		agentId: string,
		taskDefinition: unknown,
		input: Record<string, unknown>,
		pollOptions?: PollOptions,
	): Promise<TaskExecutionResult> {
		const task = await this.createTask(agentId, taskDefinition);

		return await this.executeTask(task.id, {
			input,
			pollOptions,
		});
	}
}

/**
 * Default Julep client instance
 *
 * Uses API key from environment variables
 */
export const julepClient = new JulepClient();

/**
 * Retrieve the background worker agent ID from the BACKGROUND_WORKER_AGENT_ID environment variable.
 *
 * @returns The configured background worker agent ID.
 * @throws If `BACKGROUND_WORKER_AGENT_ID` is not set in the environment.
 */
export function getBackgroundWorkerAgentId(): string {
	const agentId = env.backgroundWorkerAgentId;

	if (!agentId) {
		julepLogger.error(
			"No background worker agent ID configured. Set BACKGROUND_WORKER_AGENT_ID environment variable.",
		);
		throw new Error("Background worker agent ID not configured");
	}

	return agentId;
}