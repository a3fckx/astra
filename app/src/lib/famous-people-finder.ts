import type { Collection } from "mongodb";
import { getBackgroundWorkerAgentId, julepClient } from "@/lib/julep";
import { logger } from "@/lib/logger";
import { loadTaskDefinition } from "@/lib/tasks/loader";

const famousLogger = logger.child("famous-people-finder");

export interface FamousPerson {
	name: string;
	category: string;
	known_for: string;
	birth_year: number;
	personality_trait: string;
}

export interface PersonalityAnalysis {
	dominant_categories: string[];
	common_traits: string[];
	animal_spirit: string;
	life_path_prediction: string;
	energy_description: string;
}

export interface FamousPeopleResult {
	famous_people: FamousPerson[];
	personality_analysis: PersonalityAnalysis;
	calculated_at: string;
}

/**
 * Find famous people born on same date and analyze personality patterns
 * This runs EARLY - as soon as we have birth date from OAuth
 * Used to create engagement and predict user's "animal spirit"
 */
export async function findFamousPeopleForUser(
	userId: string,
	julepUserId: string,
	birthDate: Date,
	usersCollection: Collection,
): Promise<FamousPeopleResult | null> {
	try {
		famousLogger.info("Finding famous people", {
			userId,
			birthDate: birthDate.toISOString().split("T")[0],
		});

		const taskDef = loadTaskDefinition("FAMOUS_PEOPLE_FINDER");
		const agentId = getBackgroundWorkerAgentId();

		const result = await julepClient.createAndExecuteTask(
			agentId,
			taskDef,
			{
				julep_user_id: julepUserId,
				birth_date: birthDate.toISOString().split("T")[0],
			},
			{
				maxAttempts: 30,
				intervalMs: 2000,
			},
		);

		if (result.status !== "succeeded") {
			famousLogger.error("Famous people task failed", {
				userId,
				error: result.error,
			});
			return null;
		}

		const output = result.output as FamousPeopleResult;

		// Save to MongoDB
		await usersCollection.updateOne(
			{ id: userId },
			{
				$set: {
					"user_overview.famous_people": output.famous_people,
					"user_overview.personality_analysis": output.personality_analysis,
					"user_overview.last_updated": new Date(),
				},
			},
		);

		famousLogger.info("Famous people saved", {
			userId,
			count: output.famous_people?.length || 0,
			animalSpirit: output.personality_analysis?.animal_spirit,
		});

		return output;
	} catch (error) {
		famousLogger.error("Famous people finder error", {
			userId,
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}
