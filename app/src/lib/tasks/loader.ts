import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import { logger } from "@/lib/logger";

const taskLogger = logger.child("tasks:loader");

/**
 * Task definitions available in the system
 */
export const TASK_DEFINITIONS = {
	TRANSCRIPT_PROCESSOR: "transcript-processor.yaml",
	CHART_CALCULATOR: "chart-calculator.yaml",
	FAMOUS_PEOPLE_FINDER: "famous-people-finder.yaml",
	GAMIFICATION_TRACKER: "gamification-tracker.yaml",
	WEEKLY_REPORT: "weekly-report-generator.yaml",
	HOROSCOPE_REFRESHER: "horoscope-refresher.yaml",
	PERSONA_ENRICHMENT: "persona-enrichment.yaml",
} as const;

export type TaskDefinitionName = keyof typeof TASK_DEFINITIONS;

/**
 * Cache for loaded task definitions to avoid repeated file reads
 */
const taskCache = new Map<string, unknown>();

/**
 * Get the absolute path to the agents/tasks directory
 *
 * ANCHOR:task-directory-resolution
 * Works in both development and production (Vercel):
 * - Dev: Points to project root (checks both /app/agents and /agents)
 * - Production: Points to deployed directory
 * 
 * The tasks directory can be in two locations:
 * 1. /astra/app/agents/tasks (when running from /app)
 * 2. /astra/agents/tasks (project root, when running from parent)
 */
function getTasksDirectory(): string {
	// Try current directory first (for Next.js runtime)
	const currentDir = path.join(process.cwd(), "agents", "tasks");
	if (fs.existsSync(currentDir)) {
		return currentDir;
	}
	
	// Try parent directory (for scripts run from /app directory)
	const parentDir = path.join(process.cwd(), "..", "agents", "tasks");
	if (fs.existsSync(parentDir)) {
		return parentDir;
	}
	
	// Default to current directory (will fail later with clear error)
	return currentDir;
}

/**
 * Load a task definition from YAML file
 *
 * ANCHOR:task-definition-loading
 * All agent workflows live in `agents/tasks/*.yaml`. This helper is the single
 * entry point for loading those definitions so every API route and CLI script
 * pulls the same version.
 *
 * Guarantees:
 *   - Works in dev (from repo) and production (Next.js serverless bundle)
 *   - Caches parsed YAML to avoid re-reading on every request
 *   - Throws with a descriptive error when a task name drifts from TASK_DEFINITIONS
 *
 * Business-critical tasks that rely on this loader:
 *   - TRANSCRIPT_PROCESSOR → updates Mongo `user_overview`, Memory Store, Julep docs
 *   - CHART_CALCULATOR     → generates Vedic/Western charts for dynamic variables
 *   - GAMIFICATION_TRACKER → maintains streaks/milestones in `user_overview.gamification`
 *   - HOROSCOPE_REFRESHER  → seeds the daily horoscope snapshot
 *   - WEEKLY_REPORT        → drafts long-form summaries for the companion experience
 *   - PERSONA_ENRICHMENT   → analyzes tone/preferences for Samay’s persona tuning
 *
 * When you add or rename a YAML file, update TASK_DEFINITIONS above and document the
 * new task in docs/ARCHITECTURE.md so frontline prompts know which fields exist.
 *
 * @param taskName - Name of the task definition (from TASK_DEFINITIONS)
 * @returns Parsed YAML object ready for Julep API
 * @throws Error if file doesn't exist or parsing fails
 *
 * @example
 * ```typescript
 * const taskDef = loadTaskDefinition('TRANSCRIPT_PROCESSOR');
 * const task = await julepClient.tasks.create(agentId, taskDef);
 * ```
 */
export function loadTaskDefinition(taskName: TaskDefinitionName): unknown {
	const filename = TASK_DEFINITIONS[taskName];
	const cacheKey = filename;

	// Return cached version if available
	if (taskCache.has(cacheKey)) {
		taskLogger.debug("Loading task from cache", { taskName, filename });
		return taskCache.get(cacheKey);
	}

	try {
		const tasksDir = getTasksDirectory();
		const taskPath = path.join(tasksDir, filename);

		taskLogger.debug("Loading task definition", { taskName, taskPath });

		// Check if file exists
		if (!fs.existsSync(taskPath)) {
			throw new Error(
				`Task definition file not found: ${taskPath}. Available tasks: ${Object.keys(TASK_DEFINITIONS).join(", ")}`,
			);
		}

		// Read and parse YAML
		const yamlContent = fs.readFileSync(taskPath, "utf8");
		const taskDef = yaml.parse(yamlContent);

		if (!taskDef) {
			throw new Error(`Failed to parse YAML for task: ${taskName}`);
		}

		// Cache the parsed definition
		taskCache.set(cacheKey, taskDef);

		taskLogger.info("Task definition loaded successfully", {
			taskName,
			filename,
		});

		return taskDef;
	} catch (error) {
		taskLogger.error("Failed to load task definition", {
			taskName,
			filename,
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

/**
 * Load a task definition from a custom file path
 *
 * @param filePath - Relative path from agents/tasks/ directory
 * @returns Parsed YAML object
 *
 * @example
 * ```typescript
 * const taskDef = loadTaskDefinitionFromPath('custom/my-task.yaml');
 * ```
 */
export function loadTaskDefinitionFromPath(filePath: string): unknown {
	const cacheKey = `custom:${filePath}`;

	if (taskCache.has(cacheKey)) {
		taskLogger.debug("Loading custom task from cache", { filePath });
		return taskCache.get(cacheKey);
	}

	try {
		const tasksDir = getTasksDirectory();
		const taskPath = path.join(tasksDir, filePath);

		if (!fs.existsSync(taskPath)) {
			throw new Error(`Task file not found: ${taskPath}`);
		}

		const yamlContent = fs.readFileSync(taskPath, "utf8");
		const taskDef = yaml.parse(yamlContent);

		if (!taskDef) {
			throw new Error(`Failed to parse YAML from: ${filePath}`);
		}

		taskCache.set(cacheKey, taskDef);

		taskLogger.info("Custom task definition loaded", { filePath });

		return taskDef;
	} catch (error) {
		taskLogger.error("Failed to load custom task definition", {
			filePath,
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

/**
 * Clear the task definition cache
 *
 * Useful in development when task definitions are being updated
 */
export function clearTaskCache(): void {
	taskCache.clear();
	taskLogger.info("Task definition cache cleared");
}

/**
 * Preload all task definitions into cache
 *
 * Call this during application startup to warm the cache
 */
export function preloadTaskDefinitions(): void {
	taskLogger.info("Preloading task definitions...");

	for (const taskName of Object.keys(
		TASK_DEFINITIONS,
	) as TaskDefinitionName[]) {
		try {
			loadTaskDefinition(taskName);
		} catch (error) {
			taskLogger.warn("Failed to preload task definition", {
				taskName,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	taskLogger.info("Task definitions preloaded", {
		count: taskCache.size,
	});
}
