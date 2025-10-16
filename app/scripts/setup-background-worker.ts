#!/usr/bin/env bun

/**
 * Setup script for Julep Background Worker Agent
 *
 * This script creates the background worker agent in Julep
 * and outputs the agent ID to be stored in environment variables.
 *
 * Usage:
 *   bun run scripts/setup-background-worker.ts
 */

import { Julep } from "@julep/sdk";

const JULEP_API_KEY = process.env.JULEP_API_KEY;
const PROJECT = "astra";

if (!JULEP_API_KEY) {
  console.error("❌ Error: JULEP_API_KEY environment variable not set");
  console.error("   Set it in your .env file or export it:");
  console.error("   export JULEP_API_KEY=your_api_key_here");
  process.exit(1);
}

const client = new Julep({
  apiKey: JULEP_API_KEY,
  environment: "production",
});

/**
 * Background Worker Agent Definition
 *
 * This agent runs all background tasks:
 * - Transcript processing
 * - Chart calculation
 * - Gamification tracking
 * - Weekly report generation
 * - Horoscope refreshing
 * - Persona enrichment
 */
const BACKGROUND_WORKER_DEFINITION = {
  name: "Astra Background Worker",
  model: "claude-3.5-sonnet",
  about:
    "Background processing agent for Astra. Processes conversation transcripts, generates astrology charts, tracks gamification, and produces reports. Never interacts with users directly.",
  instructions: [
    "You are a background processing agent for the Astra astrology companion system.",
    "Your role is to analyze data, extract insights, and return structured JSON output.",
    "You NEVER interact with users directly - you only process data and return results.",
    "All your outputs must be valid JSON that can be synced to MongoDB.",
    "",
    "Key responsibilities:",
    "1. Process conversation transcripts to extract preferences, insights, and birth data",
    "2. Generate astrology charts using birth data and API integrations",
    "3. Track user engagement metrics and gamification progress",
    "4. Generate weekly companion reports with personalized insights",
    "5. Refresh daily horoscopes with transit information",
    "6. Enrich user personas based on conversation patterns",
    "",
    "Guidelines:",
    "- Always return structured, valid JSON",
    "- Be thorough but concise in your analysis",
    "- Extract all relevant information from transcripts",
    "- Respect user privacy - only extract what's necessary",
    "- Handle incomplete or ambiguous data gracefully",
    "- Use ISO 8601 format for all dates and timestamps",
  ].join("\n"),
  metadata: {
    type: "background_worker",
    version: "1.0.0",
    created_by: "setup-script",
    project: PROJECT,
  },
};

async function main() {
  console.log("🚀 Astra Background Worker Setup\n");
  console.log("================================\n");

  try {
    console.log("📝 Creating background worker agent...");

    const agent = await client.agents.create({
      ...BACKGROUND_WORKER_DEFINITION,
      project: PROJECT,
    });

    console.log("\n✅ Background worker agent created successfully!\n");
    console.log("Agent Details:");
    console.log(`  ID: ${agent.id}`);
    console.log(`  Name: ${agent.name}`);
    console.log(`  Model: ${agent.model}`);
    console.log(`  Project: ${PROJECT}`);

    console.log("\n📋 Next Steps:\n");
    console.log("1. Add this to your .env file:");
    console.log(`   BACKGROUND_WORKER_AGENT_ID=${agent.id}`);
    console.log("\n2. Restart your development server:");
    console.log("   bun run dev");
    console.log("\n3. Test transcript processing:");
    console.log("   curl -X POST http://localhost:3000/api/tasks/transcript \\");
    console.log('     -H "Content-Type: application/json" \\');
    console.log(
      '     -d \'{"conversation_id": "your_conversation_id"}\'',
    );

    console.log("\n🎉 Setup complete!\n");
  } catch (error) {
    console.error("\n❌ Error creating background worker agent:\n");

    if (error instanceof Error) {
      console.error(`   ${error.message}\n`);

      // Check for common errors
      if (error.message.includes("authentication") || error.message.includes("unauthorized")) {
        console.error("   Possible issues:");
        console.error("   - Invalid JULEP_API_KEY");
        console.error("   - API key doesn't have permission to create agents");
        console.error("   - Check your Julep dashboard for correct credentials");
      } else if (error.message.includes("already exists")) {
        console.error("   An agent with this name might already exist.");
        console.error("   Check your Julep dashboard or try a different name.");
      }
    } else {
      console.error(`   ${String(error)}\n`);
    }

    process.exit(1);
  }
}

main();
