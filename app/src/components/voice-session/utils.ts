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
 * Returns different greetings:
 * - First time (streak 0-1): Zodiac-based intro
 * - Returning user (streak 2+): Welcome back with streak celebration
 */
export function generateFirstMessage(
	displayName: string,
	handshake: SessionHandshake | null,
): string {
	const streakDays = handshake?.session.overview?.streakDays ?? 0;
	const dateOfBirth = handshake?.session.user.dateOfBirth ?? null;
	const vedicSun = handshake?.session.overview?.vedicSun ?? null;
	const westernSun = handshake?.session.overview?.westernSun ?? null;

	// Returning user with streak
	if (streakDays >= 2) {
		const fireEmoji = streakDays >= 5 ? " 🔥" : "";
		return `Welcome back, ${displayName}!${fireEmoji} Your ${streakDays}-day streak is inspiring. What cosmic wisdom are you seeking today?`;
	}

	// First-time or second-time user - create zodiac intro
	const zodiacSign =
		westernSun || vedicSun || getZodiacSign(dateOfBirth) || null;

	if (zodiacSign) {
		return `Namaste ${displayName}! Ah, a ${zodiacSign}—the stars have been waiting for you. I'm Samay, your cosmic companion. What brings you to the heavens today?`;
	}

	// Fallback if no birth data
	return `Namaste ${displayName}! I'm Samay, your cosmic companion. How can I guide you through the stars today?`;
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
