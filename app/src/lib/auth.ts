import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { env, googlePrompt, googleScopes } from "@/lib/env";
import { getMongoClient, getMongoDb } from "@/lib/mongo";

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
});
