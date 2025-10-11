export const WORKFLOW_ID =
	process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID?.trim() ||
	process.env.NEXT_PUBLIC_ASTRA_WORKFLOW_ID?.trim() ||
	"astra-responder";

export const STARTER_PROMPTS: Array<{ label: string; prompt: string }> = [
	{
		label: "Ask about my day",
		prompt: "Help me plan my day with astro insights.",
	},
	{
		label: "Decode a vibe",
		prompt: "What does today’s energy mean for my relationships?",
	},
	{
		label: "Future focus",
		prompt: "What should I be mindful of this week?",
	},
];

export const GREETING = "Hey love, what’s on your mind today?";
export const PLACEHOLDER_INPUT = "Ask anything…";
