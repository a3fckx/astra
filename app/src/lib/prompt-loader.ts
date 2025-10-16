import { readFile } from "node:fs/promises";
import { join } from "node:path";

let cachedResponderPrompt: string | null = null;

export async function getResponderPromptTemplate(): Promise<string> {
	if (cachedResponderPrompt) {
		return cachedResponderPrompt;
	}

	const filePath = join(process.cwd(), "docs", "responder.md");
	const source = await readFile(filePath, "utf-8");
	const match = source.match(/```md([\s\S]*?)```/);

	if (!match) {
		throw new Error(
			"Responder prompt template not found in docs/responder.md code block.",
		);
	}

	cachedResponderPrompt = match[1].trim();
	return cachedResponderPrompt;
}
