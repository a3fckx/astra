import { julepClient } from "@/lib/julep-client";
import { logger } from "@/lib/logger";
import { getUsers } from "@/lib/mongo";

const syncLogger = logger.child("julep:user-sync");

/**
 * Create a Julep user for a MongoDB user
 *
 * @param mongoUserId - MongoDB user ID
 * @param email - User email address
 * @param metadata - Optional metadata to attach to Julep user
 * @returns Julep user ID
 */
export async function createJulepUser(
	mongoUserId: string,
	email: string,
	metadata?: Record<string, unknown>,
): Promise<string> {
	syncLogger.info("Creating Julep user", { mongoUserId, email });

	try {
		const julepUser = await julepClient.createUser(email, {
			mongo_user_id: mongoUserId,
			created_at: new Date().toISOString(),
			...metadata,
		});

		syncLogger.info("Julep user created", {
			mongoUserId,
			julepUserId: julepUser.id,
		});

		return julepUser.id;
	} catch (error) {
		syncLogger.error("Failed to create Julep user", {
			mongoUserId,
			email,
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

/**
 * Sync MongoDB user to Julep
 *
 * Creates a Julep user and updates MongoDB with the Julep user ID
 *
 * @param mongoUserId - MongoDB user ID
 * @returns Julep user ID
 */
export async function syncUserToJulep(mongoUserId: string): Promise<string> {
	syncLogger.info("Syncing user to Julep", { mongoUserId });

	const users = getUsers();
	const user = await users.findOne({ id: mongoUserId });

	if (!user) {
		throw new Error(`User not found: ${mongoUserId}`);
	}

	// Check if user already has Julep ID
	if (user.julep_user_id) {
		syncLogger.info("User already synced to Julep", {
			mongoUserId,
			julepUserId: user.julep_user_id,
		});
		return user.julep_user_id;
	}

	// Create Julep user
	const julepUserId = await createJulepUser(mongoUserId, user.email, {
		name: user.name,
		date_of_birth: user.date_of_birth?.toISOString(),
		birth_time: user.birth_time,
		birth_location: user.birth_location,
	});

	// Update MongoDB with Julep user ID
	await users.updateOne(
		{ id: mongoUserId },
		{
			$set: {
				julep_user_id: julepUserId,
				updated_at: new Date(),
			},
		},
	);

	syncLogger.info("User synced to Julep successfully", {
		mongoUserId,
		julepUserId,
	});

	return julepUserId;
}

/**
 * Ensure user has a Julep ID
 *
 * If user doesn't have a Julep ID, creates one and syncs to MongoDB
 *
 * @param mongoUserId - MongoDB user ID
 * @returns Julep user ID
 */
export async function ensureJulepUser(mongoUserId: string): Promise<string> {
	const users = getUsers();
	const user = await users.findOne({ id: mongoUserId });

	if (!user) {
		throw new Error(`User not found: ${mongoUserId}`);
	}

	// Return existing Julep ID if available
	if (user.julep_user_id) {
		return user.julep_user_id;
	}

	// Create and sync new Julep user
	return await syncUserToJulep(mongoUserId);
}

/**
 * Sync all MongoDB users to Julep
 *
 * Creates Julep users for all MongoDB users that don't have one
 *
 * @returns Object with success and error counts
 */
export async function syncAllUsersToJulep(): Promise<{
	total: number;
	synced: number;
	skipped: number;
	errors: number;
}> {
	syncLogger.info("Syncing all users to Julep");

	const users = getUsers();
	const allUsers = await users.find({}).toArray();

	const stats = {
		total: allUsers.length,
		synced: 0,
		skipped: 0,
		errors: 0,
	};

	for (const user of allUsers) {
		try {
			if (user.julep_user_id) {
				stats.skipped++;
				syncLogger.debug("User already synced, skipping", { userId: user.id });
				continue;
			}

			await syncUserToJulep(user.id);
			stats.synced++;
		} catch (error) {
			stats.errors++;
			syncLogger.error("Failed to sync user", {
				userId: user.id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	syncLogger.info("Bulk sync completed", stats);

	return stats;
}

/**
 * Create initial Julep user docs for a user
 *
 * Creates basic profile and preferences documents in Julep
 *
 * @param julepUserId - Julep user ID
 * @param mongoUser - MongoDB user object
 */
export async function createInitialUserDocs(
	julepUserId: string,
	mongoUser: {
		name: string;
		email: string;
		date_of_birth?: Date;
		birth_time?: string;
		birth_location?: string;
	},
): Promise<void> {
	syncLogger.info("Creating initial Julep docs", { julepUserId });

	try {
		// Create profile doc
		await julepClient.createUserDoc(
			julepUserId,
			"profile",
			{
				name: mongoUser.name,
				email: mongoUser.email,
				date_of_birth: mongoUser.date_of_birth?.toISOString(),
				birth_time: mongoUser.birth_time,
				birth_location: mongoUser.birth_location,
			},
			{
				scope: "background",
				shared: true,
				source: "initial_sync",
			},
		);

		// Create empty preferences doc
		await julepClient.createUserDoc(
			julepUserId,
			"preferences",
			{
				communication_style: null,
				hinglish_level: "medium", // default
				topics_of_interest: [],
				astrology_system: null,
				emotional_tone: null,
				flirt_opt_in: false, // default
			},
			{
				scope: "background",
				shared: true,
				source: "initial_sync",
			},
		);

		syncLogger.info("Initial Julep docs created", { julepUserId });
	} catch (error) {
		syncLogger.error("Failed to create initial docs", {
			julepUserId,
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}
