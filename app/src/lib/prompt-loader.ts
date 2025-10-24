import { readFile } from "node:fs/promises";
import { join } from "node:path";

let cachedResponderPrompt: string | null = null;

const candidateRoots = [process.cwd(), join(process.cwd(), "..")];

/**
 * Load the responder prompt template from disk and cache its trimmed content.
 *
 * Attempts to read "docs/responder.md" from a set of candidate roots; on first successful read the file's trimmed contents are cached and returned.
 *
 * @returns The trimmed responder prompt template as a string.
 * @throws Error if the template is not found in any checked locations or if a filesystem error other than `ENOENT` occurs.
 */
export async function getResponderPromptTemplate(): Promise<string> {
	if (cachedResponderPrompt) {
		return cachedResponderPrompt;
	}

	const errors: Error[] = [];

	for (const root of candidateRoots) {
		const filePath = join(root, "docs", "responder.md");
		try {
			// Read the entire file as the system prompt
			// The file now contains just the prompt content without fence blocks
			const source = await readFile(filePath, "utf-8");

			cachedResponderPrompt = source.trim();
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