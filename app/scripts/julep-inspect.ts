#!/usr/bin/env bun
import Julep from "@julep/sdk";
import { logger } from "@/lib/logger";

const scriptLogger = logger.child("scripts:julep-inspect");

async function main() {
	const apiKey = process.env.JULEP_API_KEY;
	if (!apiKey) {
		throw new Error("JULEP_API_KEY is not set. Add it to .env before running this script.");
	}

	const environment = process.env.JULEP_ENVIRONMENT ?? "production";
	const client = new Julep({ apiKey, environment });

	scriptLogger.info("Listing agents for project=astra");
	const agents: Array<{ id: string; name?: string | null; model?: string | null }> = [];
	for await (const agent of client.agents.list({ project: "astra", limit: 20 })) {
		agents.push({ id: agent.id, name: agent.name, model: agent.model });
	}
	if (agents.length === 0) {
		scriptLogger.warn("No agents found for project astra.");
	} else {
		agents.forEach((agent, index) => {
			console.log(
				`${index + 1}. ${agent.id} :: ${agent.name ?? "unnamed"} (model=${agent.model ?? "n/a"})`,
			);
		});
	}

	const agentId = process.env.BACKGROUND_WORKER_AGENT_ID;
	if (agentId) {
		scriptLogger.info(`Listing tasks for agent ${agentId}`);
		const tasks: Array<{ id: string; name?: string | null; description?: string | null }> = [];
		for await (const task of client.tasks.list(agentId, { limit: 20 })) {
			tasks.push({ id: task.id, name: task.name, description: task.description });
		}
		if (tasks.length === 0) {
			scriptLogger.warn("No tasks found for the configured background agent.");
		} else {
			tasks.forEach((task, index) => {
				console.log(
					`${index + 1}. ${task.id} :: ${task.name ?? "unnamed"} — ${task.description ?? "no description"}`,
				);
			});
		}
	} else {
		scriptLogger.warn(
			"BACKGROUND_WORKER_AGENT_ID not set. Export it or add it to .env to inspect agent tasks.",
		);
	}

	scriptLogger.info("Listing users for project=astra");
	const users: Array<{ id: string; name?: string | null; updated_at: string }> = [];
	for await (const user of client.users.list({ limit: 50 })) {
		if (user.project === "astra") {
			users.push({ id: user.id, name: user.name, updated_at: user.updated_at });
		}
	}
	if (users.length === 0) {
		scriptLogger.warn("No users found for project astra.");
	} else {
		users.forEach((user, index) => {
			console.log(
				`${index + 1}. ${user.id} :: ${user.name ?? "unnamed"} (updated ${user.updated_at})`,
			);
		});
	}

	if (users.length > 0) {
		const targetUserId = users[0]!.id;
		scriptLogger.info(`Listing latest docs for user ${targetUserId}`);
		const docs: Array<{ id: string; title: string; updated_at: string }> = [];
		try {
			for await (const doc of client.users.docs.list(targetUserId, {
				limit: 5,
				sort_by: "updated_at",
				direction: "desc",
			})) {
				docs.push({
					id: doc.id,
					title: doc.title,
					updated_at: doc.updated_at,
				});
			}
			if (docs.length === 0) {
				scriptLogger.warn(`No docs found for user ${targetUserId}`);
			} else {
				docs.forEach((doc, index) => {
					console.log(
						`${index + 1}. ${doc.id} :: ${doc.title} (updated ${doc.updated_at})`,
					);
				});
			}
		} catch (error) {
			scriptLogger.error("Failed to list user docs", error as Error);
		}
	}
}

main()
	.then(() => {
		scriptLogger.info("Julep inspection complete");
		process.exit(0);
	})
	.catch((error: unknown) => {
		scriptLogger.error("Failed to inspect Julep assets", error as Error);
		process.exit(1);
	});
