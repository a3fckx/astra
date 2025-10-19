#!/usr/bin/env bun
/**
 * Sync Existing Users to Julep
 *
 * ANCHOR:julep-user-migration
 *
 * This script creates Julep users for all MongoDB users that don't have a julep_user_id.
 * Run this once to migrate existing users after implementing Julep integration.
 *
 * Usage:
 *   bun run scripts/sync-existing-users.ts
 *   bun run scripts/sync-existing-users.ts --dry-run
 */

import { logger } from "@/lib/logger";
import { getUsers } from "@/lib/mongo";
import { syncUserToJulep } from "@/lib/julep-user-sync";

const migrationLogger = logger.child("migration:julep-users");

async function syncExistingUsers(dryRun = false) {
	migrationLogger.info(
		dryRun ? "🔍 DRY RUN - No changes will be made" : "🚀 Starting user migration to Julep",
	);

	const users = getUsers();

	// Find all users without julep_user_id
	const usersToSync = await users
		.find({ julep_user_id: { $exists: false } })
		.toArray();

	migrationLogger.info(`Found ${usersToSync.length} users to sync`);

	if (usersToSync.length === 0) {
		migrationLogger.info("✅ All users already synced to Julep");
		return;
	}

	if (dryRun) {
		migrationLogger.info("Users that would be synced:");
		for (const user of usersToSync) {
			console.log(
				`  - ${user.name} (${user.email}) [MongoDB ID: ${user.id}]`,
			);
		}
		migrationLogger.info(
			"\nRun without --dry-run flag to perform actual sync",
		);
		return;
	}

	const stats = {
		total: usersToSync.length,
		success: 0,
		failed: 0,
		errors: [] as Array<{ userId: string; email: string; error: string }>,
	};

	// Sync users one by one
	for (const user of usersToSync) {
		try {
			migrationLogger.info(`Syncing user: ${user.email}`);

			const julepUserId = await syncUserToJulep(user.id);

			migrationLogger.info(`✅ Successfully synced user: ${user.email}`, {
				mongoId: user.id,
				julepId: julepUserId,
			});

			stats.success++;
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			migrationLogger.error(`❌ Failed to sync user: ${user.email}`, {
				mongoId: user.id,
				error: errorMessage,
			});

			stats.failed++;
			stats.errors.push({
				userId: user.id,
				email: user.email,
				error: errorMessage,
			});
		}
	}

	// Print summary
	migrationLogger.info("\n📊 Migration Summary:");
	migrationLogger.info(`  Total users: ${stats.total}`);
	migrationLogger.info(`  ✅ Successfully synced: ${stats.success}`);
	migrationLogger.info(`  ❌ Failed: ${stats.failed}`);

	if (stats.errors.length > 0) {
		migrationLogger.error("\nErrors:");
		for (const err of stats.errors) {
			console.error(`  - ${err.email}: ${err.error}`);
		}
	}

	if (stats.failed > 0) {
		throw new Error(
			`Migration completed with ${stats.failed} failures. See logs above.`,
		);
	}

	migrationLogger.info("\n✅ All users successfully synced to Julep!");
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

// Run migration
syncExistingUsers(dryRun)
	.then(() => {
		process.exit(0);
	})
	.catch((error) => {
		migrationLogger.error("Migration failed", error);
		process.exit(1);
	});
