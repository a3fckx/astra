import { describe, expect, it } from "bun:test";
import {
	buildDynamicVariables,
	generateFirstMessage,
} from "@/components/voice-session/utils";
import type { SessionHandshake } from "@/components/voice-session/types";

const baseHandshake = (override?: Partial<SessionHandshake>): SessionHandshake => ({
	session: {
		workflowId: "astra-responder",
		user: {
			id: "user_1",
			email: "user@example.com",
			name: "Ada",
			dateOfBirth: "2000-08-14",
			birthTime: "07:00",
			birthPlace: "Jhajjar, India",
		},
		overview: {
			streakDays: 3,
			profileSummary: "Creative technologist exploring astrology",
			firstMessage: null,
			vedicSun: "Leo",
			vedicMoon: "Taurus",
			westernSun: "Leo",
			incidentMap: [
				{
					title: "Creative spark",
					description: "Sudden inspiration for astro companion project",
					occurredAt: "2025-10-17",
					tags: ["creativity", "technology"],
				},
			],
		},
		julep: {
			sessionId: "session_123",
			userId: "julep_user_1",
		},
	},
	integrations: {
		elevenlabs: {
			token: "mock-token",
			expiresAt: null,
			metadata: null,
		},
	},
	...override,
});

describe("generateFirstMessage", () => {
	it("references most recent incident when streak >= 1", () => {
		const handshake = baseHandshake();
		const message = generateFirstMessage("Ada", handshake);
		expect(message.toLowerCase()).toContain("trace of sudden inspiration");
		expect(message.startsWith("Ada,")).toBeTrue();
	});

	it("falls back to zodiac intro when streak is 0 and no incident", () => {
		const base = baseHandshake().session;
		const handshake = baseHandshake({
			session: {
				...base,
				overview: {
					...base.overview!,
					streakDays: 0,
					incidentMap: [],
				},
			},
		});
		expect(generateFirstMessage("Ada", handshake)).toContain("Leo");
	});

	it("uses stored first message when provided", () => {
		const base = baseHandshake().session;
		const handshake = baseHandshake({
			session: {
				...base,
				overview: {
					...base.overview!,
					firstMessage: "Welcome back, {{user_name}}!",
				},
			},
		});
		expect(generateFirstMessage("Ada", handshake)).toBe("Welcome back, Ada!");
	});
});

describe("buildDynamicVariables", () => {
	it("serializes full overview JSON and sets birth flags", () => {
		const handshake = baseHandshake();
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");
		expect(variables).toBeDefined();
		expect(variables?.user_overview).toBeString();
		const parsed = JSON.parse(String(variables?.user_overview));
		expect(parsed.profileSummary).toBeDefined();
		expect(parsed.incidentMap).toBeArray();
		expect(variables?.has_birth_date).toBe(true);
		expect(variables?.has_birth_time).toBe(true);
		expect(variables?.has_birth_place).toBe(true);
	});

	it("handles missing birth fields gracefully", () => {
		const base = baseHandshake().session;
		const handshake = baseHandshake({
			session: {
				...base,
				user: {
					...base.user,
					dateOfBirth: null,
					birthTime: null,
					birthPlace: null,
				},
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");
		expect(variables?.has_birth_date).toBe(false);
		expect(variables?.has_birth_time).toBe(false);
		expect(variables?.has_birth_place).toBe(false);
	});
});
