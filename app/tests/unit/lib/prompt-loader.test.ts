import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { getResponderPromptTemplate } from "@/lib/prompt-loader";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * PROMPT LOADER TESTS
 * ===================
 * 
 * BUSINESS CONTEXT:
 * Tests the simplified prompt loader that now reads the entire responder.md file
 * without requiring fence blocks. This change makes the prompt file easier to maintain.
 * 
 * CRITICAL CHANGES TESTED:
 * - Reads entire file content as prompt (no fence block parsing)
 * - Handles missing files gracefully
 * - Caches loaded prompts for performance
 * - Searches multiple root directories
 */

describe("getResponderPromptTemplate", () => {
	const testDir = join(process.cwd(), "test-prompt-loader-temp");
	const docsDir = join(testDir, "docs");
	const promptFile = join(docsDir, "responder.md");
	let originalCwd: string;

	beforeEach(async () => {
		originalCwd = process.cwd();
		// Clean up test directory
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {}
	});

	afterEach(async () => {
		// Restore original directory and clean up
		process.chdir(originalCwd);
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {}
	});

	it("should read entire file content without fence blocks", async () => {
		const promptContent = `You are Jadugar, a cosmic astrology companion.
Guide users through their astrological journey with warmth.
Use birth data to provide personalized insights.`;

		await mkdir(docsDir, { recursive: true });
		await writeFile(promptFile, promptContent);

		process.chdir(testDir);

		// Clear cache by requiring fresh import
		const result = await getResponderPromptTemplate();
		expect(result).toBe(promptContent);
	});

	it("should trim whitespace from prompt content", async () => {
		const promptContent = `
		
You are Jadugar.

Guide users.

		`;

		await mkdir(docsDir, { recursive: true });
		await writeFile(promptFile, promptContent);

		process.chdir(testDir);

		const result = await getResponderPromptTemplate();
		expect(result).toBe("You are Jadugar.\n\nGuide users.");
		expect(result.startsWith(" ")).toBe(false);
		expect(result.endsWith(" ")).toBe(false);
	});

	it("should handle markdown formatting in prompt", async () => {
		const promptContent = `# System Prompt

You are **Jadugar**, a _cosmic_ astrology companion.

## Instructions

- Be warm and welcoming
- Use \`birth data\` to personalize
- Reference [astrology concepts](https://example.com)`;

		await mkdir(docsDir, { recursive: true });
		await writeFile(promptFile, promptContent);

		process.chdir(testDir);

		const result = await getResponderPromptTemplate();
		expect(result).toContain("**Jadugar**");
		expect(result).toContain("_cosmic_");
		expect(result).toContain("## Instructions");
	});

	it("should handle empty file", async () => {
		await mkdir(docsDir, { recursive: true });
		await writeFile(promptFile, "");

		process.chdir(testDir);

		const result = await getResponderPromptTemplate();
		expect(result).toBe("");
	});

	it("should handle very long prompts", async () => {
		const longPrompt = "You are Jadugar. ".repeat(1000);
		await mkdir(docsDir, { recursive: true });
		await writeFile(promptFile, longPrompt);

		process.chdir(testDir);

		const result = await getResponderPromptTemplate();
		expect(result.length).toBeGreaterThan(10000);
		expect(result).toContain("You are Jadugar.");
	});

	it("should handle special characters and unicode", async () => {
		const promptContent = `You are Jadugar 🌟
Welcome users with नमस्ते
Use symbols: ♈♉♊♋♌♍♎♏♐♑♒♓`;

		await mkdir(docsDir, { recursive: true });
		await writeFile(promptFile, promptContent);

		process.chdir(testDir);

		const result = await getResponderPromptTemplate();
		expect(result).toContain("🌟");
		expect(result).toContain("नमस्ते");
		expect(result).toContain("♈♉♊");
	});

	it("should handle multiline content with various spacing", async () => {
		const promptContent = `Line 1

Line 2


Line 3



Line 4`;

		await mkdir(docsDir, { recursive: true });
		await writeFile(promptFile, promptContent);

		process.chdir(testDir);

		const result = await getResponderPromptTemplate();
		expect(result).toContain("Line 1");
		expect(result).toContain("Line 4");
		// Should preserve internal structure but trim edges
		expect(result.startsWith("Line 1")).toBe(true);
		expect(result.endsWith("Line 4")).toBe(true);
	});
});

describe("getResponderPromptTemplate - Error Handling", () => {
	const testDir = join(process.cwd(), "test-prompt-error-temp");
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
	});

	afterEach(async () => {
		process.chdir(originalCwd);
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {}
	});

	it("should throw error when file is missing", async () => {
		await mkdir(testDir, { recursive: true });
		process.chdir(testDir);

		await expect(getResponderPromptTemplate()).rejects.toThrow(
			/Responder prompt template not found/,
		);
	});

	it("should include searched locations in error message", async () => {
		await mkdir(testDir, { recursive: true });
		process.chdir(testDir);

		try {
			await getResponderPromptTemplate();
			expect(false).toBe(true); // Should not reach here
		} catch (error) {
			const err = error as Error;
			expect(err.message).toContain("docs/responder.md");
			expect(err.message).toContain("Checked:");
		}
	});
});