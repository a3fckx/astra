#!/usr/bin/env bun
import { Julep } from "@julep/sdk";
import * as fs from "fs";
import * as path from "path";

// Load environment
const JULEP_API_KEY = process.env.JULEP_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const ASTRA_MODEL = process.env.ASTRA_MODEL; // Optional: override model from env

if (!JULEP_API_KEY) {
	console.error("❌ JULEP_API_KEY not set in environment");
	process.exit(1);
}

const client = new Julep({
	apiKey: JULEP_API_KEY,
	environment: process.env.JULEP_ENVIRONMENT ?? "production",
});

interface AgentDefinition {
	name: string;
	model: string;
	project: string;
	about: string;
	instructions: string;
	metadata?: Record<string, unknown>;
	default_settings?: Record<string, unknown>;
	tools?: unknown[];
}

function parseYaml(content: string): AgentDefinition {
	// Simple YAML parser for our use case
	// For production, consider using a proper YAML library
	const lines = content.split("\n");
	const result: Record<string, unknown> = {};
	let currentKey = "";
	let currentValue = "";
	let inMultiline = false;
	let multilineKey = "";

	for (const line of lines) {
		// Skip comments and empty lines
		if (line.trim().startsWith("#") || line.trim() === "") {
			if (inMultiline) {
				currentValue += "\n";
			}
			continue;
		}

		// Check for multiline string start (|)
		if (line.includes(":") && line.trim().endsWith("|")) {
			const key = line.split(":")[0].trim();
			multilineKey = key;
			currentValue = "";
			inMultiline = true;
			continue;
		}

		// Handle multiline content
		if (inMultiline) {
			// Check if we're still in multiline (indented) or starting new key
			if (line.startsWith("  ") || line.startsWith("\t")) {
				currentValue += line.replace(/^  /, "") + "\n";
			} else {
				// Save multiline value and exit multiline mode
				result[multilineKey] = currentValue.trim();
				inMultiline = false;
				multilineKey = "";
				currentValue = "";
			}
		}

		// Handle regular key-value pairs
		if (!inMultiline && line.includes(":") && !line.trim().endsWith("|")) {
			const [key, ...valueParts] = line.split(":");
			const value = valueParts.join(":").trim();

			if (value.startsWith(">")) {
				// Block scalar - fold newlines
				multilineKey = key.trim();
				currentValue = "";
				inMultiline = true;
			} else if (value) {
				// Remove quotes if present
				result[key.trim()] = value.replace(/^["']|["']$/g, "");
			}
		}
	}

	// Save last multiline value if exists
	if (inMultiline && multilineKey) {
		result[multilineKey] = currentValue.trim();
	}

	return result as unknown as AgentDefinition;
}

async function loadAgentDefinition(filePath: string): Promise<AgentDefinition> {
	const absolutePath = path.join(process.cwd(), "..", filePath);
	const content = fs.readFileSync(absolutePath, "utf-8");
	return parseYaml(content);
}

async function createOrUpdateAgent(definition: AgentDefinition) {
	console.log(`\n🤖 Processing agent: ${definition.name}`);

	// Override model from environment variable if set
	const modelToUse = ASTRA_MODEL || definition.model;
	if (ASTRA_MODEL) {
		console.log(`   🔧 Using model from ASTRA_MODEL env: ${modelToUse}`);
	} else {
		console.log(`   📦 Using model from YAML: ${modelToUse}`);
	}

	try {
		// Check if agent already exists (by name + project metadata)
		const existingAgents = await client.agents.list({
			limit: 100,
		});

		const existing = existingAgents.items.find(
			(a) => a.name === definition.name,
		);

		if (existing) {
			console.log(`   ↻ Updating existing agent (${existing.id})`);
			const updated = await client.agents.update(existing.id, {
				about: definition.about,
				instructions: definition.instructions,
				model: modelToUse,
				metadata: definition.metadata,
				defaultSettings: definition.default_settings,
			});
			console.log("   ✓ Updated successfully");
			return updated;
		}

		console.log("   + Creating new agent");
		const created = await client.agents.create({
			name: definition.name,
			model: modelToUse,
			about: definition.about,
			instructions: definition.instructions,
			metadata: definition.metadata,
			defaultSettings: definition.default_settings,
		});
		console.log(`   ✓ Created with ID: ${created.id}`);
		return created;
	} catch (error) {
		console.error(`   ❌ Error: ${error}`);
		throw error;
	}
}

async function main() {
	console.log("🚀 Syncing agents from YAML definitions...\n");

	// Store OpenRouter API key in Julep Secrets (for agent access)
	if (OPENROUTER_API_KEY) {
		console.log("🔑 Storing OpenRouter API key in Julep Secrets...");
		try {
			await client.secrets.create({
				name: "OPENROUTER_API_KEY",
				value: OPENROUTER_API_KEY,
			});
			console.log("   ✓ Secret stored\n");
		} catch (error: unknown) {
			const err = error as { message?: string };
			if (err.message?.includes("already exists")) {
				console.log("   ↻ Secret already exists\n");
			} else {
				console.error("   ⚠ Could not store secret (non-fatal):", err.message);
			}
		}
	}

	// Load and sync agents
	const agentFiles = [
		"agents/definitions/astra.yaml",
		"agents/definitions/background-worker.yaml",
	];

	const results: Record<string, string> = {};

	for (const file of agentFiles) {
		try {
			const definition = await loadAgentDefinition(file);
			const agent = await createOrUpdateAgent(definition);
			results[definition.name] = agent.id;
		} catch (error) {
			console.error(`❌ Failed to process ${file}:`, error);
			process.exit(1);
		}
	}

	// Output environment variable format
	console.log("\n" + "=".repeat(60));
	console.log("📋 Add these to your app/.env file:");
	console.log("=".repeat(60));
	console.log(`ASTRA_AGENT_ID=${results.Astra || "NOT_CREATED"}`);
	console.log(
		`BACKGROUND_AGENT_ID=${results["Astra Background Worker"] || "NOT_CREATED"}`,
	);
	console.log("=".repeat(60));

	// Save to lock file
	const lockData = {
		project: "astra",
		agents: results,
		synced_at: new Date().toISOString(),
	};

	const lockPath = path.join(process.cwd(), "..", "julep-lock.json");
	fs.writeFileSync(lockPath, JSON.stringify(lockData, null, 2));
	console.log("\n✓ Saved agent IDs to julep-lock.json");
}

main().catch((error) => {
	console.error("❌ Fatal error:", error);
	process.exit(1);
});
