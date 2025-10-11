import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { ObjectId } from "mongodb";
import { env, googlePrompt, googleScopes } from "@/lib/env";
import { fetchGoogleProfileDetails } from "@/lib/google-people";
import { createJulepUser, seedUserDocs } from "@/lib/julep-docs";
import { getMongoClient, getMongoDb, getUsers } from "@/lib/mongo";

console.info("Configured Google OAuth scopes:", googleScopes());

const mongoClient = getMongoClient();
const mongoDb = getMongoDb();

export const auth = betterAuth({
	secret: env.betterAuthSecret,
	baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
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
			scope: googleScopes(),
		},
	},
	plugins: [nextCookies()],
	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					try {
						console.log(`Syncing new user to Julep: ${user.email}`);

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

						console.log(
							`Successfully synced user ${user.email} with Julep ID: ${julepUser.id}`,
						);
					} catch (error) {
						console.error("Failed to sync user to Julep:", error);
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
							console.warn(
								`Unable to locate user record for Google account ${account.accountId}`,
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
						console.error("Failed to enrich Google account profile:", error);
					}
				},
			},
		},
	},
});
