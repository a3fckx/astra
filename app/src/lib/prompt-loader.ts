import { readFile } from "node:fs/promises";
import { join } from "node:path";

let cachedResponderPrompt: string | null = null;

const candidateRoots = [process.cwd(), join(process.cwd(), "..")];

export async function getResponderPromptTemplate(): Promise<string> {
	if (cachedResponderPrompt) {
		return cachedResponderPrompt;
	}

	const errors: Error[] = [];

	for (const root of candidateRoots) {
		const filePath = join(root, "docs", "responder.md");
		try {
			const source = await readFile(filePath, "utf-8");
			const match = source.match(/```md([\s\S]*?)```/);

			if (!match) {
				throw new Error(
					`Responder prompt template missing fenced block in ${filePath}.`,
				);
			}

			cachedResponderPrompt = match[1].trim();
			return cachedResponderPrompt;
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			const nodeErr = err as NodeJS.ErrnoException;
			// Only record missing-file errors and keep searching.
			if (nodeErr.code && nodeErr.code !== "ENOENT") {
				throw err;
			}
			errors.push(err);
		}
	}

	const locations = candidateRoots
		.map((root) => join(root, "docs", "responder.md"))
		.join(", ");

	throw new Error(
		`Responder prompt template not found. Checked: ${locations}. Last error: ${errors.at(-1)?.message}`,
	);
}
