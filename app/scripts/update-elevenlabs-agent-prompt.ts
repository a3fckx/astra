/**
 * Updates the ElevenLabs agent's system prompt via API
 * This ensures the agent uses our responder.md prompt as its base configuration
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;

if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
	console.error("❌ Missing required environment variables:");
	console.error("  ELEVENLABS_API_KEY:", !!ELEVENLABS_API_KEY);
	console.error("  ELEVENLABS_AGENT_ID:", !!ELEVENLABS_AGENT_ID);
	process.exit(1);
}

async function updateAgentPrompt() {
	console.log("\n🔄 Updating ElevenLabs Agent Prompt\n");
	console.log("Agent ID:", ELEVENLABS_AGENT_ID);

	// Load the prompt from responder.md
	const promptPath = join(process.cwd(), "docs", "responder.md");
	console.log("Loading prompt from:", promptPath);

	let promptContent: string;
	try {
		promptContent = readFileSync(promptPath, "utf-8");
		console.log("✅ Prompt loaded:", promptContent.length, "characters");
	} catch (error) {
		console.error("❌ Failed to load prompt file:", error);
		process.exit(1);
	}

	// Update the agent via API
	const url = `https://api.elevenlabs.io/v1/convai/agents/${ELEVENLABS_AGENT_ID}`;

	console.log("\n📤 Sending PATCH request to:", url);

	try {
		const response = await fetch(url, {
			method: "PATCH",
			headers: {
				"xi-api-key": ELEVENLABS_API_KEY,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				conversation_config: {
					agent: {
						prompt: {
							prompt: promptContent,
						},
					},
				},
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error("❌ API Error:", response.status, response.statusText);
			console.error("Response:", errorText);
			process.exit(1);
		}

		const result = await response.json();
		console.log("\n✅ Agent prompt updated successfully!");
		console.log("\nAgent details:");
		console.log("  Name:", result.name);
		console.log("  ID:", result.agent_id);
		console.log("  Prompt length:", result.conversation_config?.agent?.prompt?.prompt?.length ?? 0, "characters");

		console.log("\n🎉 Done! The agent will now use the updated prompt.");
		console.log("💡 Test by starting a new conversation.");
	} catch (error) {
		console.error("❌ Failed to update agent:", error);
		process.exit(1);
	}
}

updateAgentPrompt();
