import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { ObjectId } from "mongodb";
import { env, googlePrompt, googleScopes } from "@/lib/env";
import { fetchGoogleProfileDetails } from "@/lib/google-people";
import { createJulepUser, seedUserDocs } from "@/lib/julep-docs";
import { logger } from "@/lib/logger";
import { getMongoClient, getMongoDb, getUsers } from "@/lib/mongo";

const authLogger = logger.child("auth");
const configuredScopes = googleScopes();
authLogger.debug("Configured Google OAuth scopes", {
	scopes: configuredScopes,
});

const mongoClient = getMongoClient();
const mongoDb = getMongoDb();

const resolveAuthBaseUrl = () => {
	const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
	// ANCHOR: better-auth-base-path — Better Auth mounts routes under /api/auth, so baseURL must include the API segment.
	return new URL("/api/auth", appUrl).toString().replace(/\/$/, "");
};

export const auth = betterAuth({
	secret: env.betterAuthSecret,
	baseURL: resolveAuthBaseUrl(),
	database: mongodbAdapter(mongoDb, { client: mongoClient }),
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 60,
		},
		expiresIn: 60 * 60 * 24 * 7,
		updateAge: 60 * 60 * 12,
	},
	socialProviders: {
		google: {
			clientId: env.googleClientId,
			clientSecret: env.googleClientSecret,
			redirectUri: env.googleRedirectUri,
			accessType: "offline",
			prompt: googlePrompt,
			scope: configuredScopes,
		},
	},
	plugins: [nextCookies()],
	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					try {
						authLogger.info(`Syncing new user to Julep: ${user.email}`);

						const julepUser = await createJulepUser({
							name: user.name,
							email: user.email,
							about: `User email: ${user.email}`,
						});

						const usersCollection = getUsers();
						await usersCollection.updateOne(
							{ email: user.email },
							{
								$set: {
									id: user.id,
									julep_user_id: julepUser.id,
									julep_project: "astra" as const,
								},
							},
							{ upsert: true },
						);

						await seedUserDocs(julepUser.id, {
							name: user.name,
							email: user.email,
						});

						authLogger.info("Successfully synced user with Julep", {
							email: user.email,
							julepUserId: julepUser.id,
						});
					} catch (error) {
						authLogger.error("Failed to sync user to Julep", error as Error);
					}
				},
			},
		},
		account: {
			create: {
				after: async (account) => {
					if (account.providerId !== "google" || !account.accessToken) {
						return;
					}

					try {
						const profileDetails = await fetchGoogleProfileDetails(
							account.accessToken,
						);
						if (!profileDetails) {
							return;
						}

						const usersCollection = getUsers();
						let userRecord = await usersCollection.findOne({
							id: account.userId,
						});

						if (!userRecord && ObjectId.isValid(account.userId)) {
							userRecord = await usersCollection.findOne({
								_id: new ObjectId(account.userId),
							});
						}

						if (!userRecord) {
							authLogger.warn(
								"Unable to locate user record for Google account",
								{ accountId: account.accountId },
							);
							return;
						}

						const updates: Record<string, unknown> = {};

						if (
							profileDetails.photoUrl &&
							profileDetails.photoUrl !== userRecord.image
						) {
							updates.image = profileDetails.photoUrl;
						}

						if (profileDetails.birthday) {
							updates.birth_day = profileDetails.birthday.day;
							updates.birth_month = profileDetails.birthday.month;

							if (profileDetails.birthday.year) {
								const birthDate = new Date(
									Date.UTC(
										profileDetails.birthday.year,
										profileDetails.birthday.month - 1,
										profileDetails.birthday.day,
									),
								);
								updates.date_of_birth = birthDate;
							}
						}

						if (!Object.keys(updates).length) {
							return;
						}

						updates.updatedAt = new Date();

						const updateFilter = userRecord._id
							? { _id: userRecord._id }
							: { id: userRecord.id };

						await usersCollection.updateOne(updateFilter, {
							$set: updates,
						});
					} catch (error) {
						authLogger.error(
							"Failed to enrich Google account profile",
							error as Error,
						);
					}
				},
			},
		},
	},
});
