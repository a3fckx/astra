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
 * Generates personalized first message for the agent
 * ANCHOR:elevenlabs-first-message
 */
export function generateFirstMessage(displayName: string): string {
	return `Namaste ${displayName}! I'm Jadugar, your cosmic companion. How can I guide you through the stars today?`;
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
