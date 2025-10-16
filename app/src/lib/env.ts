import { logger } from "@/lib/logger";

const envLogger = logger.child("env");

export const DEFAULT_ELEVENLABS_AGENT_ID = "agent_9501k3xm7f8bfvysgym9sd8e1fdb";

const boolFromEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
};

const required = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const buildMongoUri = (): string => {
  const directUri = process.env.MONGODB_URI?.trim();
  if (directUri) {
    return directUri;
  }

  const username = process.env.MONGODB_USERNAME;
  const password = process.env.MONGODB_PASSWORD;
  const cluster = process.env.MONGODB_CLUSTER ?? "astra.ethgite";

  if (!username || !password) {
    throw new Error(
      "Set MONGODB_URI or MONGODB_USERNAME/MONGODB_PASSWORD for the app service.",
    );
  }

  const encodedUser = encodeURIComponent(username);
  const encodedPass = encodeURIComponent(password);

  return `mongodb+srv://${encodedUser}:${encodedPass}@${cluster}.mongodb.net/?retryWrites=true&w=majority&appName=astra`;
};

export const env = {
  mongodbUri: buildMongoUri(),
  mongodbDb: process.env.MONGODB_DB ?? "astra",
  betterAuthSecret: required(
    "BETTER_AUTH_SECRET",
    process.env.BETTER_AUTH_SECRET,
  ),
  memoryStoreDefaultToken: process.env.MEMORY_STORE_DEFAULT_TOKEN ?? undefined,
  googleClientId: required("GOOGLE_CLIENT_ID", process.env.GOOGLE_CLIENT_ID),
  googleClientSecret: required(
    "GOOGLE_CLIENT_SECRET",
    process.env.GOOGLE_CLIENT_SECRET,
  ),
  googleRedirectUri: required(
    "GOOGLE_REDIRECT_URI",
    process.env.GOOGLE_REDIRECT_URI,
  ),
  enableBirthdayScope: boolFromEnv(
    process.env.GOOGLE_ENABLE_BIRTHDAY_SCOPE,
    true,
  ),
  enableGmailReadScope: boolFromEnv(
    process.env.GOOGLE_ENABLE_GMAIL_READ_SCOPE,
    false,
  ),
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY ?? undefined,
  julepApiKey: process.env.JULEP_API_KEY ?? undefined,
  astraAgentId: process.env.ASTRA_AGENT_ID ?? undefined,
  backgroundWorkerAgentId: process.env.BACKGROUND_WORKER_AGENT_ID ?? undefined,
};

const BASE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

const BIRTHDAY_SCOPE = "https://www.googleapis.com/auth/user.birthday.read";
const GMAIL_READ_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export const googleScopes = () => {
  const scopes = new Set(BASE_SCOPES);
  if (env.enableBirthdayScope) {
    scopes.add(BIRTHDAY_SCOPE);
  }
  if (env.enableGmailReadScope) {
    scopes.add(GMAIL_READ_SCOPE);
  }
  return Array.from(scopes);
};

const GOOGLE_PROMPT_VALUES = new Set([
  "select_account",
  "consent",
  "login",
  "none",
  "select_account consent",
]);

type GooglePromptOption =
  | "select_account"
  | "consent"
  | "login"
  | "none"
  | "select_account consent";

const resolvedGooglePrompt = GOOGLE_PROMPT_VALUES.has(env.googlePromptRaw)
  ? (env.googlePromptRaw as GooglePromptOption)
  : undefined;

if (!resolvedGooglePrompt) {
  envLogger.warn(
    `GOOGLE_OAUTH_PROMPT value "${env.googlePromptRaw}" is not recognized. Falling back to provider default.`,
  );
}

if (!process.env.ELEVENLABS_AGENT_ID) {
  envLogger.info(
    `ELEVENLABS_AGENT_ID not set. Falling back to default agent ${DEFAULT_ELEVENLABS_AGENT_ID}.`,
  );
}

export const googlePrompt = resolvedGooglePrompt;
