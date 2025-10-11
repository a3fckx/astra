import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

const createClient = () => {
	const apiKey = process.env.ELEVENLABS_API_KEY;
	if (!apiKey) {
		console.warn(
			"ELEVENLABS_API_KEY is not set. Text-to-speech responses will be disabled.",
		);
		return null;
	}

	return new ElevenLabsClient({ apiKey });
};

export const elevenlabsEnv = {
	apiKey: process.env.ELEVENLABS_API_KEY,
	voiceId: process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID,
};

const elevenlabsClient = createClient();

export async function textToSpeechStream(text: string, voiceId?: string) {
	if (!elevenlabsClient || !elevenlabsEnv.apiKey) {
		throw new Error("ELEVENLABS_API_KEY not configured");
	}

	try {
		const stream = await elevenlabsClient.textToSpeech.convertAsStream(
			voiceId ?? elevenlabsEnv.voiceId,
			{
				text,
				model_id: "eleven_turbo_v2_5",
				voice_settings: {
					stability: 0.5,
					similarity_boost: 0.75,
				},
			},
		);

		return stream;
	} catch (error) {
		console.error("Failed to generate TTS:", error);
		throw error;
	}
}

export async function textToSpeech(text: string, voiceId?: string) {
	if (!elevenlabsClient || !elevenlabsEnv.apiKey) {
		throw new Error("ELEVENLABS_API_KEY not configured");
	}

	try {
		const audio = await elevenlabsClient.textToSpeech.convert(
			voiceId ?? elevenlabsEnv.voiceId,
			{
				text,
				model_id: "eleven_turbo_v2_5",
				voice_settings: {
					stability: 0.5,
					similarity_boost: 0.75,
				},
			},
		);

		return audio;
	} catch (error) {
		console.error("Failed to generate TTS:", error);
		throw error;
	}
}
