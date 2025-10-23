import { Julep } from "@julep/sdk";

const required = (name: string, value: string | undefined): string => {
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
};

export const julepEnv = {
	apiKey: required("JULEP_API_KEY", process.env.JULEP_API_KEY),
	project: process.env.JULEP_PROJECT ?? "astra",
	backgroundWorkerAgentId: process.env.BACKGROUND_WORKER_AGENT_ID,
};

export const julepClient = new Julep({
	apiKey: julepEnv.apiKey,
	environment: process.env.JULEP_ENVIRONMENT ?? "production",
});

export type JulepDocMetadata = {
	type: "profile" | "preferences" | "horoscope" | "notes" | "analysis";
	scope: "frontline" | "background";
	updated_by: string;
	timestamp_iso: string;
	shared: boolean;
	source?: string;
};

export type UserProfile = {
	name: string;
	email: string;
	date_of_birth?: Date;
	birth_time?: string;
	birth_location?: string;
};
