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

/**
 * EXTENDED TESTS FOR ENHANCED DYNAMIC VARIABLES
 * ==============================================
 * 
 * Tests for new chart status detection, birth time in conversations,
 * and engagement metrics added to buildDynamicVariables
 */

const createHandshakeWithBirthChart = (
	overrides?: any,
): SessionHandshake => ({
	session: {
		workflowId: "astra-responder",
		user: {
			id: "user_1",
			email: "user@example.com",
			name: "Ada",
			dateOfBirth: "2000-08-14",
			birthTime: "07:15",
			birthPlace: "Mumbai, India",
			...overrides?.user,
		},
		overview: {
			streakDays: 3,
			profileSummary: "User with complete birth chart",
			firstMessage: null,
			vedicSun: "Leo",
			vedicMoon: "Taurus",
			westernSun: "Leo",
			birth_chart: {
				vedic: {
					sun_sign: "Leo",
					moon_sign: "Taurus",
					ascendant: "Aries",
					planets: [],
				},
				western: {
					sun_sign: "Leo",
					moon_sign: "Gemini",
					rising_sign: "Virgo",
					planets: [],
				},
				famous_people: [
					{
						name: "Barack Obama",
						category: "Politics",
						known_for: "44th US President",
						birth_year: 1961,
					},
				],
			},
			incidentMap: [],
			...overrides?.overview,
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
});

describe("buildDynamicVariables - Chart Status Detection", () => {
	it("should set chart_status to 'ready' when both charts exist", () => {
		const handshake = createHandshakeWithBirthChart();
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.chart_status).toBe("ready");
		expect(variables?.has_birth_chart).toBe(true);
		expect(variables?.has_vedic_chart).toBe(true);
		expect(variables?.has_western_chart).toBe(true);
	});

	it("should set chart_status to 'pending' when birth data exists but no charts", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {
				birth_chart: null,
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.chart_status).toBe("pending");
		expect(variables?.has_birth_chart).toBe(false);
	});

	it("should set chart_status to 'none' when no birth data available", () => {
		const handshake = createHandshakeWithBirthChart({
			user: {
				dateOfBirth: null,
				birthTime: null,
				birthPlace: null,
			},
			overview: {
				birth_chart: null,
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.chart_status).toBe("none");
	});

	it("should expose vedic and western chart details", () => {
		const handshake = createHandshakeWithBirthChart();
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.vedic_sun).toBe("Leo");
		expect(variables?.vedic_moon).toBe("Taurus");
		expect(variables?.vedic_ascendant).toBe("Aries");
		expect(variables?.western_sun).toBe("Leo");
		expect(variables?.western_moon).toBe("Gemini");
		expect(variables?.western_rising).toBe("Virgo");
	});
});

describe("buildDynamicVariables - Famous People Detection", () => {
	it("should detect famous people matches", () => {
		const handshake = createHandshakeWithBirthChart();
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.has_famous_people).toBe(true);
		expect(variables?.famous_people_count).toBe(1);
	});

	it("should handle empty famous people array", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {
				birth_chart: {
					vedic: { sun_sign: "Leo" },
					western: { sun_sign: "Leo" },
					famous_people: [],
				},
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.has_famous_people).toBe(false);
		expect(variables?.famous_people_count).toBe(0);
	});
});

describe("buildDynamicVariables - Birth Time Detection in Conversations", () => {
	it("should detect birth time mentioned in conversation summary", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {
				recent_conversations: [
					{
						summary: "User mentioned their birth time was 7:15 AM",
						topics: ["birth data"],
					},
				],
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.birth_time_in_recent_conversations).toBe(true);
	});

	it("should detect 'birth time' phrase in topics", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {
				recent_conversations: [
					{
						summary: "General conversation",
						topics: ["birth time", "chart calculation"],
					},
				],
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.birth_time_in_recent_conversations).toBe(true);
	});

	it("should return false when no birth time mention", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {
				recent_conversations: [
					{
						summary: "Discussed daily horoscope",
						topics: ["horoscope"],
					},
				],
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.birth_time_in_recent_conversations).toBe(false);
	});
});

describe("buildDynamicVariables - Engagement Metrics", () => {
	it("should count incidents, insights, and conversations", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {
				incident_map: [
					{ title: "Event 1" },
					{ title: "Event 2" },
				],
				insights: [
					{ text: "Insight 1" },
				],
				recent_conversations: [
					{ summary: "Conv 1" },
					{ summary: "Conv 2" },
					{ summary: "Conv 3" },
				],
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.incident_count).toBe(2);
		expect(variables?.insights_count).toBe(1);
		expect(variables?.recent_conversations_count).toBe(3);
	});

	it("should handle missing arrays gracefully", () => {
		const minimalHandshake: SessionHandshake = {
			session: {
				workflowId: "astra-responder",
				user: {
					id: "user_1",
					email: "user@example.com",
					name: "Ada",
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
		};

		const variables = buildDynamicVariables(minimalHandshake, "Ada", "astra-responder");

		expect(variables?.incident_count).toBe(0);
		expect(variables?.insights_count).toBe(0);
		expect(variables?.recent_conversations_count).toBe(0);
	});
});

describe("buildDynamicVariables - Birth Data Exposure", () => {
	it("should expose birth data fields directly", () => {
		const handshake = createHandshakeWithBirthChart();
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.date_of_birth).toBe("2000-08-14");
		expect(variables?.birth_time).toBe("07:15");
		expect(variables?.birth_place).toBe("Mumbai, India");
	});

	it("should handle missing birth data", () => {
		const handshake = createHandshakeWithBirthChart({
			user: {
				dateOfBirth: null,
				birthTime: null,
				birthPlace: null,
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.date_of_birth).toBeNull();
		expect(variables?.birth_time).toBeNull();
		expect(variables?.birth_place).toBeNull();
	});
});