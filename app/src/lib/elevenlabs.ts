import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const ttsLogger = logger.child("elevenlabs");

const createClient = () => {
	const apiKey = process.env.ELEVENLABS_API_KEY;
	if (!apiKey) {
		ttsLogger.warn(
			"ELEVENLABS_API_KEY is not set. Conversational AI features will be disabled.",
		);
		return null;
	}

	return new ElevenLabsClient({ apiKey });
};

export const elevenlabsEnv = {
	apiKey: process.env.ELEVENLABS_API_KEY,
	agentId: env.elevenLabsAgentId,
};

const elevenlabsClient = createClient();

export function getElevenLabsClient() {
	if (!elevenlabsClient || !elevenlabsEnv.apiKey) {
		throw new Error("ELEVENLABS_API_KEY not configured");
	}
	return elevenlabsClient;
}
