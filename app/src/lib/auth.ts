import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { env, googlePrompt, googleScopes } from "@/lib/env";
import { createJulepUser, seedUserDocs } from "@/lib/julep-docs";
import { getMongoClient, getMongoDb, getUsers } from "@/lib/mongo";

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
			scopes: googleScopes(),
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
	},
});
