#!/usr/bin/env bun
import { upsertIntegrationToken } from "@/lib/integration-tokens";
import { getUsers } from "@/lib/mongo";
import { logger } from "@/lib/logger";

const scriptLogger = logger.child("set-memory-token");

type CliArgs = {
	email?: string;
	token?: string;
	integration: "memory-store" | "elevenlabs";
};

const parseArgs = (): CliArgs => {
	const args = process.argv.slice(2);
	const result: CliArgs = { integration: "memory-store" };

	for (let index = 0; index < args.length; index += 1) {
		const current = args[index];
		if (!current || !current.startsWith("--")) {
			continue;
		}

		const value = args[index + 1];
		switch (current) {
			case "--email":
				result.email = value;
				index += 1;
				break;
			case "--token":
				result.token = value;
				index += 1;
				break;
			case "--integration":
				if (value === "memory-store" || value === "elevenlabs") {
					result.integration = value;
					index += 1;
				}
				break;
			default:
				break;
		}
	}

	return result;
};

const requireValue = (value: string | undefined, label: string) => {
	if (!value) {
		throw new Error(`Missing required argument: ${label}`);
	}
	return value;
};

async function main() {
	const args = parseArgs();

	const email = requireValue(args.email, "--email <user-email>");
	const token = requireValue(args.token, "--token <integration-token>");

	const users = getUsers();
	const user = await users.findOne({ email });

	if (!user) {
		throw new Error(`User with email ${email} not found in database.`);
	}

	const record = await upsertIntegrationToken({
		userId: user.id,
		integration: args.integration,
		token,
	});

	scriptLogger.info("Stored integration token", {
		userId: user.id,
		email,
		integration: args.integration,
		expiresAt: record.expiresAt ?? null,
	});
}

main()
	.then(() => {
		scriptLogger.info("Memory token seed completed");
		process.exit(0);
	})
	.catch((error: unknown) => {
		scriptLogger.error("Failed to seed memory token", error as Error);
		process.exit(1);
	});
