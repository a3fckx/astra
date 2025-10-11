"use client";

import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ColorScheme, useColorScheme } from "@/hooks/use-color-scheme";
import {
	GREETING,
	PLACEHOLDER_INPUT,
	STARTER_PROMPTS,
	WORKFLOW_ID,
} from "@/lib/chatkit-config";
import styles from "./responder-console.module.css";

export type ResponderMessage = {
	id: string;
	workflowId?: string;
	role: "user" | "assistant" | "system";
	content: string;
	createdAt: string;
	metadata?: Record<string, unknown> | null;
};

export type ResponderConsoleProps = {
	userId: string;
	workflowId?: string;
	initialTheme?: ColorScheme;
};

type SocketPayload =
	| {
			type: "messages:init";
			data: ResponderMessage[];
	  }
	| {
			type: "messages:append";
			data: ResponderMessage;
	  }
	| {
			type: "connected";
			data: Record<string, unknown>;
	  }
	| {
			type: "error";
			error: unknown;
	  }
	| Record<string, unknown>;

type MessageStatus =
	| "queued"
	| "processing"
	| "delivered"
	| "failed"
	| undefined;

function coerceISO(value: string | Date) {
	if (value instanceof Date) {
		return value.toISOString();
	}
	return new Date(value).toISOString();
}

function getStatus(metadata?: Record<string, unknown> | null): MessageStatus {
	if (!metadata || typeof metadata !== "object") {
		return undefined;
	}
	const candidate =
		typeof (metadata as { status?: unknown }).status === "string"
			? ((metadata as { status: string }).status as MessageStatus)
			: undefined;
	if (
		candidate === "queued" ||
		candidate === "processing" ||
		candidate === "delivered" ||
		candidate === "failed"
	) {
		return candidate;
	}
	return undefined;
}

function isAudioEvent(message: ResponderMessage) {
	return (
		message.metadata &&
		typeof message.metadata === "object" &&
		"kind" in message.metadata &&
		message.metadata.kind === "audio:chunk"
	);
}

function getWorkflowId(metadata?: Record<string, unknown> | null) {
	if (!metadata || typeof metadata !== "object") {
		return undefined;
	}
	const candidate = (metadata as { workflowId?: unknown }).workflowId;
	return typeof candidate === "string" ? candidate : undefined;
}

/**
 * ANCHOR:chatkit-shell
 * ResponderConsole reproduces the ChatKit artifact so users get the exact UX
 * they expect while our backend talks to Mongo + Julep instead of Agent Builder.
 * Workflow-aware filtering lets us surface multiple personas through the same UI.
 */
export function ResponderConsole({
	userId,
	workflowId,
	initialTheme = "light",
}: ResponderConsoleProps) {
	const [messages, setMessages] = useState<ResponderMessage[]>([]);
	const [input, setInput] = useState("");
	const [pending, setPending] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const listRef = useRef<HTMLDivElement | null>(null);
	const { scheme, setScheme } = useColorScheme(initialTheme);

	const activeWorkflowId = workflowId ?? WORKFLOW_ID;
	const isDark = scheme === "dark";

	const sortedMessages = useMemo(() => {
		return [...messages]
			.filter((message) => !isAudioEvent(message))
			.sort(
				(a, b) =>
					new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
			);
	}, [messages]);

	// ANCHOR:workflow-filter
	// Chat timelines stay in sync with Agent Builder semantics by filtering
	// on workflowId. Empty workflowId entries cover legacy data and bootstrap cases.
	const workflowMessages = useMemo(
		() =>
			sortedMessages.filter((message) => {
				const messageWorkflow =
					message.workflowId ?? getWorkflowId(message.metadata);
				if (!messageWorkflow) {
					return true;
				}
				return messageWorkflow === activeWorkflowId;
			}),
		[sortedMessages, activeWorkflowId],
	);

	const scrollToBottom = useCallback(() => {
		if (!listRef.current) {
			return;
		}
		listRef.current.scrollTo({
			top: listRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, []);

	const upsertMessages = useCallback(
		(incoming: ResponderMessage | ResponderMessage[]) => {
			setMessages((prev) => {
				const next = Array.isArray(incoming) ? incoming : [incoming];
				const merged = new Map<string, ResponderMessage>();
				for (const message of prev) {
					merged.set(message.id, message);
				}
				for (const message of next) {
					if (!message.id) {
						continue;
					}
					const payload: ResponderMessage = {
						...message,
						metadata:
							message.metadata && typeof message.metadata === "object"
								? (message.metadata as Record<string, unknown>)
								: null,
						createdAt: coerceISO(message.createdAt),
						workflowId: message.workflowId ?? getWorkflowId(message.metadata),
					};
					merged.set(payload.id, payload);
				}
				return Array.from(merged.values());
			});
		},
		[],
	);

	useEffect(() => {
		const loadHistory = async () => {
			try {
				const response = await fetch(
					`/api/responder/messages?workflowId=${encodeURIComponent(activeWorkflowId)}`,
				);
				if (!response.ok) {
					throw new Error(`Failed to load messages: ${response.statusText}`);
				}
				const data = (await response.json()) as {
					messages?: ResponderMessage[];
				};
				if (Array.isArray(data.messages)) {
					upsertMessages(
						data.messages.map((message) => ({
							...message,
							createdAt: coerceISO(message.createdAt),
						})),
					);
				}
			} catch (error) {
				console.error("Failed to load responder history", error);
			}
		};

		void loadHistory();
	}, [upsertMessages, activeWorkflowId]);

	useEffect(() => {
		const connect = () => {
			const protocol = window.location.protocol === "https:" ? "wss" : "ws";
			const ws = new WebSocket(
				`${protocol}://${window.location.host}/api/responder/socket`,
			);

			wsRef.current = ws;

			ws.addEventListener("open", () => {
				ws.send(
					JSON.stringify({
						type: "hello",
						userId,
						workflowId: activeWorkflowId,
					}),
				);
			});

			ws.addEventListener("message", (event) => {
				try {
					const payload = JSON.parse(event.data) as SocketPayload;
					if (!payload || typeof payload !== "object") {
						return;
					}

					if (payload.type === "messages:init" && Array.isArray(payload.data)) {
						upsertMessages(
							payload.data.map((message) => ({
								...message,
								createdAt: coerceISO(message.createdAt),
							})),
						);
						return;
					}

					if (payload.type === "messages:append" && payload.data) {
						upsertMessages({
							...payload.data,
							createdAt: coerceISO(payload.data.createdAt),
						});
						return;
					}

					if (payload.type === "error") {
						console.error("Responder socket server error", payload.error);
					}
				} catch (error) {
					console.error("Failed to parse socket payload", error);
				}
			});

			ws.addEventListener("close", () => {
				if (reconnectRef.current) {
					clearTimeout(reconnectRef.current);
				}
				reconnectRef.current = setTimeout(connect, 2000);
			});

			ws.addEventListener("error", (error) => {
				console.error("Responder socket error", error);
				ws.close();
			});
		};

		connect();

		return () => {
			if (reconnectRef.current) {
				clearTimeout(reconnectRef.current);
			}
			wsRef.current?.close();
		};
	}, [upsertMessages, userId, activeWorkflowId]);

	useEffect(() => {
		if (workflowMessages.length === 0) {
			return;
		}
		scrollToBottom();
	}, [workflowMessages, scrollToBottom]);

	const sendMessage = useCallback(async () => {
		const trimmed = input.trim();
		if (!trimmed) {
			return;
		}

		try {
			setPending(true);
			if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
				// ANCHOR:socket-send
				// Emit workflowId on every socket send so we stay compatible with
				// ChatKit's transport contract where the client decides which agent lane
				// the message belongs to.
				wsRef.current.send(
					JSON.stringify({
						type: "chat",
						text: trimmed,
						workflowId: activeWorkflowId,
					}),
				);
			} else {
				const response = await fetch("/api/responder/messages", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						content: trimmed,
						workflowId: activeWorkflowId,
					}),
				});
				if (!response.ok) {
					const data = await response
						.json()
						.catch(() => ({ error: "Unable to send message" }));
					throw new Error(data.error ?? "Unable to send message");
				}
			}
			setInput("");
		} catch (error) {
			console.error("Failed to send responder message", error);
			alert(
				error instanceof Error
					? error.message
					: "Something went wrong while sending the message.",
			);
		} finally {
			setPending(false);
		}
	}, [input, activeWorkflowId]);

	const handlePrompt = useCallback((prompt: string) => {
		setInput(prompt);
	}, []);

	return (
		<div
			className={clsx(styles.container, isDark && styles.containerDark)}
			data-testid="responder-console"
		>
			<header className={clsx(styles.header, isDark && styles.headerDark)}>
				<div className={styles.titleBlock}>
					<h2 className={clsx(styles.title, isDark && styles.titleDark)}>
						Jadugar responder
					</h2>
					<p className={clsx(styles.subtitle, isDark && styles.subtitleDark)}>
						Live session · Memory recall powered by Julep
					</p>
				</div>
				<div className={styles.headerActions}>
					<span
						className={clsx(
							styles.workflowTag,
							isDark && styles.workflowTagDark,
						)}
					>
						workflow: {activeWorkflowId}
					</span>
					<button
						type="button"
						className={clsx(
							styles.themeButton,
							isDark && styles.themeButtonDark,
						)}
						onClick={() => setScheme(isDark ? "light" : "dark")}
					>
						{isDark ? "Light mode" : "Dark mode"}
					</button>
				</div>
			</header>

			<div
				ref={listRef}
				className={clsx(styles.messagePane, isDark && styles.messagePaneDark)}
			>
				{workflowMessages.length === 0 ? (
					<div
						className={clsx(
							styles.startScreen,
							isDark && styles.startScreenDark,
						)}
					>
						<h3
							className={clsx(styles.greeting, isDark && styles.greetingDark)}
						>
							{GREETING}
						</h3>
						<p className={clsx(styles.subtitle, isDark && styles.subtitleDark)}>
							Pick a starter prompt or write your own question to begin.
						</p>
						<div className={styles.promptList}>
							{STARTER_PROMPTS.map((prompt) => (
								<button
									type="button"
									key={prompt.prompt}
									className={clsx(
										styles.promptButton,
										isDark && styles.promptButtonDark,
									)}
									onClick={() => handlePrompt(prompt.prompt)}
								>
									{prompt.label}
								</button>
							))}
						</div>
					</div>
				) : null}
				{workflowMessages.map((message) => {
					const status = getStatus(message.metadata);
					const isAssistant = message.role === "assistant";
					const isUser = message.role === "user";
					const isSystem = message.role === "system";
					return (
						<div
							key={message.id}
							className={clsx(
								styles.message,
								isAssistant && styles.assistant,
								isAssistant && isDark && styles.assistantDark,
								isUser && styles.user,
								isSystem && styles.system,
								isSystem && isDark && styles.systemDark,
							)}
						>
							<div>{message.content}</div>
							<div className={styles.timestamp}>
								{new Date(message.createdAt).toLocaleTimeString()}
							</div>
							{status && (
								<span
									className={clsx(
										styles.statusBadge,
										status === "queued" && styles.statusQueued,
										status === "processing" && styles.statusProcessing,
										status === "delivered" && styles.statusDelivered,
										status === "failed" && styles.statusFailed,
									)}
								>
									{status === "queued" && "Queued"}
									{status === "processing" && "Processing"}
									{status === "delivered" && "Delivered"}
									{status === "failed" && "Failed"}
								</span>
							)}
						</div>
					);
				})}
				<div className={styles.scrollAnchor} />
			</div>

			<div className={clsx(styles.composer, isDark && styles.composerDark)}>
				<textarea
					className={clsx(styles.textarea, isDark && styles.textareaDark)}
					value={input}
					onChange={(event) => setInput(event.target.value)}
					placeholder={PLACEHOLDER_INPUT}
					disabled={pending}
				/>
				<button
					type="button"
					className={styles.sendButton}
					disabled={pending || !input.trim()}
					onClick={() => void sendMessage()}
				>
					{pending ? "Sending…" : "Send"}
				</button>
			</div>
		</div>
	);
}
