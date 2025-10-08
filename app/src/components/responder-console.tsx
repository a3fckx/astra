"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ResponderMessage = {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	createdAt: string;
	metadata?: Record<string, unknown> | null;
};

type ResponderConsoleProps = {
	userId: string;
};

export function ResponderConsole({ userId }: ResponderConsoleProps) {
	const [messages, setMessages] = useState<ResponderMessage[]>([]);
	const [pending, setPending] = useState(false);
	const [input, setInput] = useState("");
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const connect = () => {
			const protocol = window.location.protocol === "https:" ? "wss" : "ws";
			const ws = new WebSocket(
				`${protocol}://${window.location.host}/api/responder/socket`,
			);
			wsRef.current = ws;

			ws.addEventListener("open", () => {
				console.debug("Responder socket connected");
				ws.send(JSON.stringify({ type: "hello", userId }));
			});

			ws.addEventListener("message", (event) => {
				try {
					const payload = JSON.parse(event.data) as
						| { type: "messages:init"; data: ResponderMessage[] }
						| { type: "messages:append"; data: ResponderMessage }
						| { type: "error"; error: string };

					if (payload.type === "messages:init") {
						setMessages(payload.data);
					} else if (payload.type === "messages:append") {
						setMessages((prev) => {
							const exists = prev.some((msg) => msg.id === payload.data.id);
							if (exists) {
								return prev;
							}
							return [...prev, payload.data];
						});
					} else if (payload.type === "error") {
						console.error(payload.error);
					}
				} catch (error) {
					console.error("Failed to parse socket payload", error);
				}
			});

			ws.addEventListener("close", () => {
				console.debug("Responder socket disconnected, scheduling retry");
				if (reconnectRef.current) {
					clearTimeout(reconnectRef.current);
				}
				reconnectRef.current = setTimeout(() => connect(), 2500);
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
	}, [userId]);

	const sendMessage = useCallback(async () => {
		if (!input.trim()) {
			return;
		}
		try {
			setPending(true);
			const response = await fetch("/api/responder/messages", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ content: input.trim() }),
			});
			if (!response.ok) {
				const data = await response
					.json()
					.catch(() => ({ error: "Unable to send message" }));
				throw new Error(data.error ?? "Unable to send message");
			}
			setInput("");
		} catch (error) {
			console.error(error);
			alert(error instanceof Error ? error.message : "Failed to send message");
		} finally {
			setPending(false);
		}
	}, [input]);

	return (
		<section
			style={{
				display: "grid",
				gap: "1rem",
				padding: "1.75rem",
				borderRadius: "1.25rem",
				background: "rgba(15, 15, 16, 0.55)",
				border: "1px solid rgba(231,233,238,0.12)",
			}}
		>
			<header
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
				}}
			>
				<div>
					<h2 style={{ margin: 0, fontSize: "1.5rem" }}>
						Responder agent stream
					</h2>
					<p style={{ margin: "0.25rem 0", opacity: 0.65 }}>
						Real-time WebSocket bridge to the user-facing agent. Background
						agents push updates into this channel via MongoDB change streams.
					</p>
				</div>
				<span style={{ fontSize: "0.85rem", opacity: 0.6 }}>
					User ID: {userId}
				</span>
			</header>

			<div
				style={{
					maxHeight: "420px",
					overflowY: "auto",
					display: "flex",
					flexDirection: "column",
					gap: "0.75rem",
					paddingRight: "0.25rem",
				}}
			>
				{messages.map((message) => (
					<article
						key={message.id}
						style={{
							alignSelf:
								message.role === "assistant" ? "flex-start" : "flex-end",
							background:
								message.role === "assistant"
									? "rgba(102, 126, 234, 0.15)"
									: "rgba(234, 102, 153, 0.18)",
							border: "1px solid rgba(231,233,238,0.14)",
							padding: "0.85rem 1rem",
							borderRadius: "1rem",
							maxWidth: "75%",
							boxShadow: "0 8px 24px rgba(12, 24, 54, 0.18)",
						}}
					>
						<p style={{ margin: 0, lineHeight: 1.6 }}>{message.content}</p>
						<p
							style={{
								margin: "0.35rem 0 0",
								fontSize: "0.75rem",
								opacity: 0.55,
							}}
						>
							{new Date(message.createdAt).toLocaleTimeString()}
						</p>
					</article>
				))}
				{messages.length === 0 && (
					<p style={{ opacity: 0.6 }}>
						No responder events yet. Send a prompt to start the stream.
					</p>
				)}
			</div>

			<div style={{ display: "flex", gap: "0.75rem" }}>
				<textarea
					value={input}
					onChange={(event) => setInput(event.target.value)}
					placeholder="Ask the responder agent…"
					rows={3}
					style={{
						flex: 1,
						resize: "none",
						borderRadius: "0.85rem",
						border: "1px solid rgba(231,233,238,0.2)",
						padding: "0.85rem 1rem",
						background: "rgba(15, 15, 16, 0.7)",
						color: "#e7e9ee",
						fontSize: "1rem",
					}}
				/>
				<button
					onClick={sendMessage}
					disabled={pending}
					style={{
						alignSelf: "flex-end",
						padding: "0.85rem 1.5rem",
						borderRadius: "0.85rem",
						border: "none",
						fontWeight: 600,
						background: pending
							? "rgba(231,233,238,0.18)"
							: "rgba(72, 187, 120, 0.75)",
						color: pending ? "rgba(231,233,238,0.45)" : "#041c10",
						cursor: pending ? "not-allowed" : "pointer",
					}}
				>
					{pending ? "Sending…" : "Send"}
				</button>
			</div>
		</section>
	);
}
