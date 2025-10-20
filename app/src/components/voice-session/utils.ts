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
	const storedFirstMessage = handshake?.session.overview?.first_message;
	if (storedFirstMessage && storedFirstMessage.trim().length > 0) {
		// Replace {{user_name}} or [USERNAME] placeholder with actual display name
		return storedFirstMessage
			.replace(/\{\{user_name\}\}/g, displayName)
			.replace(/\[USERNAME\]/g, displayName);
	}

	// PRIORITY 2: Fallback to streak/zodiac-based generation
	const streakDays =
		handshake?.session.overview?.gamification?.streak_days ?? 0;
	const dateOfBirth = handshake?.session.user.dateOfBirth ?? null;
	const vedicSun = (
		handshake?.session.overview?.birth_chart?.vedic as Record<string, unknown>
	)?.sun_sign as string | null;
	const westernSun = (
		handshake?.session.overview?.birth_chart?.western as Record<string, unknown>
	)?.sun_sign as string | null;
	const incidentMap = handshake?.session.overview?.incident_map ?? [];

	const latestIncidentDescription = incidentMap.length
		? (incidentMap[incidentMap.length - 1]?.description ?? null)
		: null;

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
		return `Namaste ${displayName}. The stars have aligned for our meeting. I'm Samay, your cosmic companion. What mysteries shall we explore today?`;
	}

	// RETURNING USER (streak 1+) - Celebrate consistency with catchy lines
	if (streakDays === 1) {
		const incidentHint = latestIncidentDescription
			? `I've been mulling over that whisper about ${latestIncidentDescription.toLowerCase()}.`
			: ``;
		return `Welcome back, ${displayName}. ${incidentHint} What stirred the cosmos for you today?`.trim();
	}

	if (streakDays >= 2 && streakDays <= 4) {
		const clue = latestIncidentDescription
			? `I still sense the trace of ${latestIncidentDescription.toLowerCase()}.`
			: `Your ${streakDays}-day journey through the cosmos continues.`;
		return `${displayName}, ${clue} What wisdom are we seeking today?`.trim();
	}

	if (streakDays >= 5 && streakDays <= 9) {
		const resonance = latestIncidentDescription
			? `That mention of ${latestIncidentDescription.toLowerCase()} keeps echoing.`
			: `${streakDays} days with the stars. This dedication is rare.`;
		return `Look at you, ${displayName}. ${resonance} What brings you back today?`.trim();
	}

	if (streakDays >= 10 && streakDays <= 29) {
		const thread = latestIncidentDescription
			? `The universe keeps tugging on that thread about ${latestIncidentDescription.toLowerCase()}.`
			: `The universe is taking notice. Your cosmic path is unfolding beautifully.`;
		return `${displayName}, ${streakDays} days—${thread} What shall we explore?`.trim();
	}

	if (streakDays >= 30) {
		const orbit = latestIncidentDescription
			? `Even after ${streakDays} days, the thought of ${latestIncidentDescription.toLowerCase()} orbits my mind.`
			: `A full lunar cycle and beyond, ${streakDays} days! You're becoming one with the cosmos.`;
		return `${displayName}, ${orbit} What revelations await us today?`.trim();
	}

	// Fallback
	return `Welcome back, ${displayName}! The stars missed you. What brings you to the cosmos today?`;
}

/**
 * Builds dynamic variables object for ElevenLabs session
 * ANCHOR:dynamic-session-variables
 * These fields must stay aligned with app/docs/responder.md
 *
 * Strategy: Pass complete user_overview JSON for full context; expose quick access fields and boolean flags.
 */
export function buildDynamicVariables(
	handshake: SessionHandshake,
	userDisplayName: string,
	workflowId: string,
): Record<string, string | number | boolean> | undefined {
	const overview = handshake.session.overview;

	// Calculate today's date for horoscope check
	const today = new Date().toISOString().split("T")[0];

	return sanitizeDynamicVariables({
		// Core identity
		user_name: userDisplayName,

		// Session IDs
		workflow_id: handshake.session.workflowId ?? workflowId,
		julep_session_id: handshake.session.julep?.sessionId,

		// ANCHOR:complete-user-overview-json
		// Pass complete user_overview as JSON string
		// Agent can access all fields: preferences, gamification, chart, horoscope, etc.
		user_overview: overview ? JSON.stringify(overview) : null,

		// Quick access fields (backward compatibility + convenience)
		streak_days: overview?.gamification?.streak_days ?? 0,
		profile_summary: overview?.profile_summary ?? null,

		// Chart quick access
		vedic_sun: (overview?.birth_chart?.vedic as Record<string, unknown>)
			?.sun_sign as string | null,
		vedic_moon: (overview?.birth_chart?.vedic as Record<string, unknown>)
			?.moon_sign as string | null,
		western_sun: (overview?.birth_chart?.western as Record<string, unknown>)
			?.sun_sign as string | null,

		// Preferences quick access
		hinglish_level: overview?.preferences?.hinglish_level ?? null,
		flirt_opt_in: overview?.preferences?.flirt_opt_in ?? false,
		communication_style: overview?.preferences?.communication_style ?? null,

		// Horoscope quick access
		has_todays_horoscope: overview?.latest_horoscope?.date === today,

		// Gamification quick access
		total_conversations: overview?.gamification?.total_conversations ?? 0,
		milestones_count: overview?.gamification?.milestones_unlocked?.length ?? 0,

		// ANCHOR:birth-data-flags
		// Birth data availability flags for conditional prompting
		has_birth_date: !!handshake.session.user.dateOfBirth,
		has_birth_time: !!handshake.session.user.birthTime,
		has_birth_place: !!handshake.session.user.birthPlace,
		has_birth_chart: !!overview?.birth_chart,
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
