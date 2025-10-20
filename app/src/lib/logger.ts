const LEVEL_WEIGHTS = {
	error: 0,
	warn: 1,
	info: 2,
	debug: 3,
	trace: 4,
} as const;

type LogLevel = keyof typeof LEVEL_WEIGHTS;

type LogPayload =
	| string
	| Error
	| Record<string, unknown>
	| Array<
			Record<string, unknown> | string | number | boolean | null | undefined
	  >;

const isBrowser = typeof window !== "undefined";

const resolveLogLevel = (): LogLevel => {
	const env =
		(typeof process !== "undefined" && process.env) ||
		({} as NodeJS.ProcessEnv);
	const raw =
		env.LOG_LEVEL ??
		env.NEXT_PUBLIC_LOG_LEVEL ??
		(isBrowser ? undefined : env.NODE_ENV === "production" ? "warn" : "info");

	if (!raw) {
		return "info";
	}

	const normalized = raw.toLowerCase();
	if (normalized in LEVEL_WEIGHTS) {
		return normalized as LogLevel;
	}

	return "info";
};

const LOG_LEVEL = resolveLogLevel();
const THRESHOLD = LEVEL_WEIGHTS[LOG_LEVEL];

const formatMessage = (
	scope: string | undefined,
	level: LogLevel,
	input: LogPayload,
) => {
	const timestamp = !isBrowser ? new Date().toISOString() : undefined;
	const baseParts = [timestamp, scope, level.toUpperCase()].filter(Boolean);
	const prefix = baseParts.length ? `[${baseParts.join(" ")}]` : "";

	if (input instanceof Error) {
		return [
			prefix,
			input.message,
			!isBrowser && input.stack ? `\n${input.stack}` : undefined,
		]
			.filter(Boolean)
			.join(" ");
	}

	if (typeof input === "string") {
		return prefix ? `${prefix} ${input}` : input;
	}

	if (Array.isArray(input)) {
		return `${prefix} ${input
			.map((item) =>
				typeof item === "object" ? JSON.stringify(item) : String(item),
			)
			.join(" ")}`.trim();
	}

	return `${prefix} ${JSON.stringify(input)}`.trim();
};

const consoleMethodForLevel = (level: LogLevel) => {
	if (level === "error") {
		return console.error;
	}
	if (level === "warn") {
		return console.warn;
	}
	if (level === "info") {
		return console.info;
	}
	return console.debug;
};

const shouldLog = (level: LogLevel) => LEVEL_WEIGHTS[level] <= THRESHOLD;

export type Logger = {
	trace: (message: LogPayload, meta?: LogPayload) => void;
	debug: (message: LogPayload, meta?: LogPayload) => void;
	info: (message: LogPayload, meta?: LogPayload) => void;
	warn: (message: LogPayload, meta?: LogPayload) => void;
	error: (message: LogPayload, meta?: LogPayload) => void;
	child: (namespace: string) => Logger;
};

function emit(level: LogLevel, scope: string | undefined, message: LogPayload) {
	if (!shouldLog(level)) {
		return;
	}

	// Skip non-error client logging to avoid polluting the browser console.
	if (isBrowser && level !== "error") {
		return;
	}

	const method = consoleMethodForLevel(level);
	method(formatMessage(scope, level, message));
}

export function createLogger(namespace?: string): Logger {
	const scopedNamespace = namespace;

	return {
		trace: (message, meta) => {
			emit("trace", scopedNamespace, message);
			if (meta !== undefined) {
				emit("trace", scopedNamespace, meta);
			}
		},
		debug: (message, meta) => {
			emit("debug", scopedNamespace, message);
			if (meta !== undefined) {
				emit("debug", scopedNamespace, meta);
			}
		},
		info: (message, meta) => {
			emit("info", scopedNamespace, message);
			if (meta !== undefined) {
				emit("info", scopedNamespace, meta);
			}
		},
		warn: (message, meta) => {
			emit("warn", scopedNamespace, message);
			if (meta !== undefined) {
				emit("warn", scopedNamespace, meta);
			}
		},
		error: (message, meta) => {
			emit("error", scopedNamespace, message);
			if (meta !== undefined) {
				emit("error", scopedNamespace, meta);
			}
		},
		child: (childNamespace: string) =>
			createLogger(
				scopedNamespace
					? `${scopedNamespace}:${childNamespace}`
					: childNamespace,
			),
	};
}

export const logger = createLogger("astra");
