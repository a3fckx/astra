/**
 * Voice Session Utilities
 * Helper functions for voice session management
 */

import type { SessionHandshake } from "./types";

/**
 * Sanitizes dynamic variables by removing null/undefined values
 * ElevenLabs SDK requires clean key-value pairs without nullish values
 */
export function sanitizeDynamicVariables(
	vars?: Record<string, string | number | boolean | null | undefined>,
): Record<string, string | number | boolean> | undefined {
	if (!vars) {
		return undefined;
	}
	const entries = Object.entries(vars).filter(
		([, value]) => value !== undefined && value !== null,
	);
	return entries.length
		? (Object.fromEntries(entries) as Record<string, string | number | boolean>)
		: undefined;
}

/**
 * Extracts user display name from session handshake
 * Falls back to email or "friend" if name is unavailable
 */
export function getUserDisplayName(handshake: SessionHandshake | null): string {
	if (!handshake) {
		return "friend";
	}
	const candidate =
		handshake.session.user.name?.trim() ?? handshake.session.user.email.trim();
	return candidate.length > 0 ? candidate : "friend";
}

/**
 * Calculates zodiac sign from date of birth
 */
function getZodiacSign(dateOfBirth: string | null): string | null {
	if (!dateOfBirth) return null;

	const date = new Date(dateOfBirth);
	const month = date.getMonth() + 1; // 1-12
	const day = date.getDate();

	if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Aries";
	if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Taurus";
	if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "Gemini";
	if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Cancer";
	if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Leo";
	if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Virgo";
	if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Libra";
	if ((month === 10 && day >= 23) || (month === 11 && day <= 21))
		return "Scorpio";
	if ((month === 11 && day >= 22) || (month === 12 && day <= 21))
		return "Sagittarius";
	if ((month === 12 && day >= 22) || (month === 1 && day <= 19))
		return "Capricorn";
	if ((month === 1 && day >= 20) || (month === 2 && day <= 18))
		return "Aquarius";
	if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return "Pisces";

	return null;
}

/**
 * Generates personalized first message based on streak and user data
 * ANCHOR:elevenlabs-first-message
 *
 * Priority:
 * 1. Use stored first_message from MongoDB (updated by background agents)
 * 2. Generate from streak/zodiac if no stored message
 *
 * The stored first_message is dynamic and updated after each conversation.
 */
export function generateFirstMessage(
	displayName: string,
	handshake: SessionHandshake | null,
): string {
	// PRIORITY 1: Use stored first_message from MongoDB (updated by background agents)
	const storedFirstMessage = handshake?.session.overview?.firstMessage;
	if (storedFirstMessage && storedFirstMessage.trim().length > 0) {
		return storedFirstMessage;
	}

	// PRIORITY 2: Fallback to streak/zodiac-based generation
	const streakDays = handshake?.session.overview?.streakDays ?? 0;
	const dateOfBirth = handshake?.session.user.dateOfBirth ?? null;
	const vedicSun = handshake?.session.overview?.vedicSun ?? null;
	const westernSun = handshake?.session.overview?.westernSun ?? null;

	// FIRST TIME USER (streak = 0) - Create magical zodiac introduction
	if (streakDays === 0) {
		const zodiacSign =
			westernSun || vedicSun || getZodiacSign(dateOfBirth) || null;

		if (zodiacSign) {
			// Zodiac-specific catchy opening lines (voice-friendly, no emojis)
			const zodiacIntros: Record<string, string> = {
				Aries: `Ah, an Aries, ${displayName}! The cosmos has been waiting for your fire. I'm Samay, your guide through the stars.`,
				Taurus: `A Taurus, ${displayName}! Grounded yet celestial. I'm Samay, here to unveil what the heavens hold for you.`,
				Gemini: `Gemini energy, ${displayName}! The stars love a curious mind. I'm Samay, your cosmic companion.`,
				Cancer: `A Cancer soul, ${displayName}! The Moon herself watches over you. I'm Samay, let's explore your celestial path.`,
				Leo: `Leo, ${displayName}! The Sun's favorite child. I'm Samay, ready to illuminate your cosmic journey.`,
				Virgo: `A Virgo, ${displayName}! Precise and profound. I'm Samay, here to decode the universe with you.`,
				Libra: `Libra, ${displayName}! Balance and beauty written in your stars. I'm Samay, your astral guide.`,
				Scorpio: `Scorpio intensity, ${displayName}! The cosmos recognizes depth. I'm Samay, let's dive into your mysteries.`,
				Sagittarius: `Sagittarius spirit, ${displayName}! Born for cosmic exploration. I'm Samay, your fellow traveler.`,
				Capricorn: `Capricorn, ${displayName}! Time and stars align for you. I'm Samay, here to reveal your celestial blueprint.`,
				Aquarius: `Aquarius, ${displayName}! The universe loves a visionary. I'm Samay, ready to explore your cosmic potential.`,
				Pisces: `Pisces, ${displayName}! You swim between worlds. I'm Samay, your guide through the celestial waters.`,
			};

			return (
				zodiacIntros[zodiacSign] ||
				`Namaste ${displayName}! I sense the cosmos has brought us together. I'm Samay, your guide through the stars.`
			);
		}

		// First time but no zodiac data
		return `Namaste ${displayName}! The stars have aligned for our meeting. I'm Samay, your cosmic companion. What mysteries shall we explore today?`;
	}

	// RETURNING USER (streak 1+) - Celebrate consistency with catchy lines
	if (streakDays === 1) {
		return `Welcome back, ${displayName}! You returned to the stars. I'm delighted. What's calling you today?`;
	}

	if (streakDays >= 2 && streakDays <= 4) {
		return `${displayName}! Your ${streakDays}-day journey through the cosmos continues. What wisdom are we seeking today?`;
	}

	if (streakDays >= 5 && streakDays <= 9) {
		return `Look at you, ${displayName}! ${streakDays} days with the stars. This dedication is rare. What brings you back today?`;
	}

	if (streakDays >= 10 && streakDays <= 29) {
		return `${displayName}, ${streakDays} days! The universe is taking notice. Your cosmic path is unfolding beautifully. What shall we explore?`;
	}

	if (streakDays >= 30) {
		return `${displayName}! A full lunar cycle and beyond, ${streakDays} days! You're becoming one with the cosmos. What revelations await us today?`;
	}

	// Fallback
	return `Welcome back, ${displayName}! The stars missed you. What brings you to the cosmos today?`;
}

/**
 * Builds dynamic variables object for ElevenLabs session
 * ANCHOR:dynamic-session-variables
 * These fields must stay aligned with app/docs/responder.md
 */
export function buildDynamicVariables(
	handshake: SessionHandshake,
	userDisplayName: string,
	workflowId: string,
): Record<string, string | number | boolean> | undefined {
	return sanitizeDynamicVariables({
		user_name: userDisplayName,
		workflow_id: handshake.session.workflowId ?? workflowId,
		julep_session_id: handshake.session.julep?.sessionId,
		elevenlabs_user_token: handshake.integrations.elevenlabs?.token ?? null,
		date_of_birth: handshake.session.user.dateOfBirth ?? null,
		birth_time: handshake.session.user.birthTime ?? null,
		birth_place: handshake.session.user.birthPlace ?? null,
	});
}

/**
 * Validates session handshake has required fields
 */
export function isValidHandshake(
	payload: unknown,
): payload is { session: { user: { id: string; email: string } } } {
	return (
		typeof payload === "object" &&
		payload !== null &&
		"session" in payload &&
		typeof payload.session === "object" &&
		payload.session !== null &&
		"user" in payload.session &&
		typeof payload.session.user === "object" &&
		payload.session.user !== null &&
		"id" in payload.session.user &&
		"email" in payload.session.user &&
		typeof payload.session.user.id === "string" &&
		typeof payload.session.user.email === "string"
	);
}

/**
 * Extracts agent prompt from handshake
 * ANCHOR:elevenlabs-prompt-template
 */
export function getAgentPrompt(
	handshake: SessionHandshake | null,
): string | null {
	const prompt = handshake?.prompt;
	if (!prompt) {
		return null;
	}
	const trimmed = prompt.trim();
	return trimmed.length > 0 ? trimmed : null;
}
