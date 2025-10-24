import { describe, expect, it } from "bun:test";
import { buildDynamicVariables } from "@/components/voice-session/utils";
import type { SessionHandshake } from "@/components/voice-session/types";

/**
 * VOICE SESSION UTILS - EXTENDED TESTS
 * ====================================
 * 
 * BUSINESS CONTEXT:
 * Tests the new dynamic variables and chart status detection logic added to utils.ts.
 * These features enable the AI agent to have better context about user's chart availability
 * and birth data status.
 * 
 * CRITICAL FEATURES TESTED:
 * - Chart status detection (none/pending/ready)
 * - Birth time detection from recent conversations
 * - Famous people matching availability
 * - Enhanced dynamic variables for agent context
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
					{
						name: "Jennifer Lopez",
						category: "Entertainment",
						known_for: "Singer and actress",
						birth_year: 1969,
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
	it("should set chart_status to 'ready' when both vedic and western charts exist", () => {
		const handshake = createHandshakeWithBirthChart();
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.chart_status).toBe("ready");
		expect(variables?.has_birth_chart).toBe(true);
		expect(variables?.has_vedic_chart).toBe(true);
		expect(variables?.has_western_chart).toBe(true);
	});

	it("should set chart_status to 'pending' when birth data exists but charts are missing", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {
				birth_chart: null,
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.chart_status).toBe("pending");
		expect(variables?.has_birth_chart).toBe(false);
		expect(variables?.has_vedic_chart).toBe(false);
		expect(variables?.has_western_chart).toBe(false);
	});

	it("should set chart_status to 'none' when no birth data is available", () => {
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
		expect(variables?.has_birth_chart).toBe(false);
	});

	it("should detect partial chart availability (vedic only)", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {
				birth_chart: {
					vedic: {
						sun_sign: "Leo",
						moon_sign: "Taurus",
					},
					western: null,
					famous_people: [],
				},
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.has_vedic_chart).toBe(true);
		expect(variables?.has_western_chart).toBe(false);
		expect(variables?.has_birth_chart).toBe(true);
	});

	it("should detect partial chart availability (western only)", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {
				birth_chart: {
					vedic: null,
					western: {
						sun_sign: "Leo",
						moon_sign: "Gemini",
					},
					famous_people: [],
				},
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.has_vedic_chart).toBe(false);
		expect(variables?.has_western_chart).toBe(true);
		expect(variables?.has_birth_chart).toBe(true);
	});
});

describe("buildDynamicVariables - Famous People Detection", () => {
	it("should detect famous people matches correctly", () => {
		const handshake = createHandshakeWithBirthChart();
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.has_famous_people).toBe(true);
		expect(variables?.famous_people_count).toBe(2);
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

	it("should handle missing famous people field", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {
				birth_chart: {
					vedic: { sun_sign: "Leo" },
					western: { sun_sign: "Leo" },
				},
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.has_famous_people).toBe(false);
		expect(variables?.famous_people_count).toBe(0);
	});
});

describe("buildDynamicVariables - Birth Time in Recent Conversations", () => {
	it("should detect birth time mentioned in conversation summary", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {
				recent_conversations: [
					{
						summary: "User mentioned their birth time was 7:15 AM",
						topics: ["birth data"],
						timestamp: "2025-10-23T10:00:00Z",
					},
				],
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.birth_time_in_recent_conversations).toBe(true);
	});

	it("should detect 'birth time' phrase in summary", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {
				recent_conversations: [
					{
						summary: "Discussed birth time and location",
						topics: ["astrology"],
						timestamp: "2025-10-23T10:00:00Z",
					},
				],
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.birth_time_in_recent_conversations).toBe(true);
	});

	it("should detect birth time in topics array", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {
				recent_conversations: [
					{
						summary: "General conversation",
						topics: ["birth time", "chart calculation"],
						timestamp: "2025-10-23T10:00:00Z",
					},
				],
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.birth_time_in_recent_conversations).toBe(true);
	});

	it("should handle conversations without birth time mention", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {
				recent_conversations: [
					{
						summary: "Discussed daily horoscope",
						topics: ["horoscope"],
						timestamp: "2025-10-23T10:00:00Z",
					},
				],
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.birth_time_in_recent_conversations).toBe(false);
	});

	it("should handle empty recent conversations", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {
				recent_conversations: [],
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.birth_time_in_recent_conversations).toBe(false);
	});

	it("should handle missing recent conversations field", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.birth_time_in_recent_conversations).toBe(false);
	});
});

describe("buildDynamicVariables - Chart Details Exposure", () => {
	it("should expose vedic chart details", () => {
		const handshake = createHandshakeWithBirthChart();
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.vedic_sun).toBe("Leo");
		expect(variables?.vedic_moon).toBe("Taurus");
		expect(variables?.vedic_ascendant).toBe("Aries");
	});

	it("should expose western chart details", () => {
		const handshake = createHandshakeWithBirthChart();
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.western_sun).toBe("Leo");
		expect(variables?.western_moon).toBe("Gemini");
		expect(variables?.western_rising).toBe("Virgo");
	});

	it("should handle missing chart details gracefully", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {
				birth_chart: {
					vedic: {},
					western: {},
				},
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.vedic_sun).toBeNull();
		expect(variables?.vedic_moon).toBeNull();
		expect(variables?.vedic_ascendant).toBeNull();
		expect(variables?.western_sun).toBeNull();
		expect(variables?.western_moon).toBeNull();
		expect(variables?.western_rising).toBeNull();
	});
});

describe("buildDynamicVariables - Engagement Metrics", () => {
	it("should count incidents correctly", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {
				incident_map: [
					{ title: "Event 1", description: "First event" },
					{ title: "Event 2", description: "Second event" },
					{ title: "Event 3", description: "Third event" },
				],
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.incident_count).toBe(3);
	});

	it("should count insights correctly", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {
				insights: [
					{ text: "Insight 1", category: "career" },
					{ text: "Insight 2", category: "relationships" },
				],
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.insights_count).toBe(2);
	});

	it("should count recent conversations correctly", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {
				recent_conversations: [
					{ summary: "Conv 1" },
					{ summary: "Conv 2" },
					{ summary: "Conv 3" },
					{ summary: "Conv 4" },
				],
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.recent_conversations_count).toBe(4);
	});

	it("should handle empty arrays gracefully", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {
				incident_map: [],
				insights: [],
				recent_conversations: [],
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

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

describe("buildDynamicVariables - Complex Scenarios", () => {
	it("should handle complete profile with all features", () => {
		const handshake = createHandshakeWithBirthChart({
			overview: {
				recent_conversations: [
					{
						summary: "Discussed birth time 7:15",
						topics: ["birth data"],
					},
				],
				incident_map: [{ title: "Event" }],
				insights: [{ text: "Insight" }],
			},
		});
		const variables = buildDynamicVariables(handshake, "Ada", "astra-responder");

		expect(variables?.chart_status).toBe("ready");
		expect(variables?.has_famous_people).toBe(true);
		expect(variables?.birth_time_in_recent_conversations).toBe(true);
		expect(variables?.incident_count).toBe(1);
		expect(variables?.insights_count).toBe(1);
	});

	it("should handle minimal profile gracefully", () => {
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

		const variables = buildDynamicVariables(
			minimalHandshake,
			"Ada",
			"astra-responder",
		);

		expect(variables?.chart_status).toBe("none");
		expect(variables?.has_birth_chart).toBe(false);
		expect(variables?.has_famous_people).toBe(false);
		expect(variables?.incident_count).toBe(0);
		expect(variables?.insights_count).toBe(0);
		expect(variables?.recent_conversations_count).toBe(0);
	});
});