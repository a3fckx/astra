import type { Server as HttpServer, IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { parse } from "node:url";
import type { NextApiRequest, NextApiResponse } from "next";
import { type WebSocket, WebSocketServer } from "ws";
import { auth } from "@/lib/auth";
import { textToSpeechStream } from "@/lib/elevenlabs";
import { julepClient } from "@/lib/julep";
import { writeConversationSummary } from "@/lib/julep-docs";
import { getOrCreateJulepSession, getUserByEmail } from "@/lib/websocket-utils";

export const config = {
	api: {
		bodyParser: false,
	},
};

type ResolverServer = HttpServer & {
	responderWss?: WebSocketServer;
};

type SocketResponse = NextApiResponse & {
	socket: NextApiResponse["socket"] & {
		server?: ResolverServer;
	};
};

type ResponderSocket = WebSocket & {
	session?: {
		userId: string;
		email: string;
		julepUserId?: string;
		julepSessionId?: string;
	};
};

const sendJSON = (ws: ResponderSocket, payload: unknown) => {
	if (ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(payload));
	}
};

const sendError = (ws: ResponderSocket, message: string, code?: string) => {
	sendJSON(ws, {
		type: "error",
		error: {
			message,
			code,
		},
	});
};

async function initializeResponderSession(ws: ResponderSocket) {
	if (!ws.session) {
		throw new Error("Missing session context");
	}

	const mongoUser = await getUserByEmail(ws.session.email);

	if (!mongoUser?.julep_user_id) {
		throw Object.assign(new Error("User not synced with Julep"), {
			code: "NO_JULEP_USER",
		});
	}

	ws.session.julepUserId = mongoUser.julep_user_id;

	const sessionId = await getOrCreateJulepSession(mongoUser.julep_user_id);
	ws.session.julepSessionId = sessionId;

	sendJSON(ws, {
		type: "connected",
		data: {
			userId: ws.session.userId,
			sessionId,
		},
	});
}

async function handleChatMessage(ws: ResponderSocket, text: string) {
	if (!ws.session?.julepSessionId || !ws.session?.julepUserId) {
		throw Object.assign(new Error("Session not initialized"), {
			code: "NO_SESSION",
		});
	}

	sendJSON(ws, {
		type: "message:user",
		data: {
			id: `user-${Date.now()}`,
			role: "user",
			content: text,
			timestamp: new Date().toISOString(),
		},
	});

	const chatResponse = await getResponderReply(ws.session.julepSessionId, text);

	sendJSON(ws, {
		type: "message:assistant",
		data: {
			id: `assistant-${Date.now()}`,
			role: "assistant",
			content: chatResponse,
			timestamp: new Date().toISOString(),
		},
	});

	try {
		const audioStream = await textToSpeechStream(chatResponse);
		for await (const chunk of audioStream) {
			sendJSON(ws, {
				type: "audio:chunk",
				data: Buffer.from(chunk).toString("base64"),
			});
		}
		sendJSON(ws, { type: "audio:end" });
	} catch (audioError) {
		console.error("TTS error (non-blocking):", audioError);
		sendJSON(ws, {
			type: "audio:error",
			error: "Failed to generate audio",
		});
	}

	writeConversationSummary(
		ws.session.julepUserId,
		`User: ${text}\nAssistant: ${chatResponse}`,
		ws.session.julepSessionId,
	).catch((error) => {
		console.error("Failed to write summary:", error);
	});
}

async function getResponderReply(sessionId: string, text: string) {
	const response = await getResponderSessionResponse(sessionId, text);
	const assistantMessage = response?.response?.[0]?.content?.[0]?.text ?? "";

	if (!assistantMessage) {
		throw new Error("No response from agent");
	}

	return assistantMessage;
}

async function getResponderSessionResponse(sessionId: string, text: string) {
	return julepClient.sessions.chat({
		sessionId,
		messages: [
			{
				role: "user",
				content: text,
			},
		],
		stream: false,
	});
}

export default async function handler(
	req: NextApiRequest,
	res: SocketResponse,
) {
	if (req.method !== "GET") {
		res.status(405).end();
		return;
	}

	const { socket } = res;
	const server = socket?.server as ResolverServer | undefined;

	if (!server) {
		res.status(500).json({ error: "Server instance unavailable" });
		return;
	}

	if (!server.responderWss) {
		const wss = new WebSocketServer({ noServer: true });

		server.on(
			"upgrade",
			async (
				upgradeRequest: IncomingMessage,
				upgradeSocket: Socket,
				head: Buffer,
			) => {
				const { pathname } = parse(upgradeRequest.url ?? "");
				if (pathname !== "/api/responder/socket") {
					return;
				}

				try {
					const headers = new Headers();
					for (const [name, value] of Object.entries(upgradeRequest.headers)) {
						if (!value) continue;
						if (Array.isArray(value)) {
							headers.set(name, value.join(","));
						} else {
							headers.set(name, value);
						}
					}

					const session = await auth.api.getSession({ headers });

					if (!session?.user) {
						upgradeSocket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
						upgradeSocket.destroy();
						return;
					}

					wss.handleUpgrade(upgradeRequest, upgradeSocket, head, (ws) => {
						const responderSocket = ws as ResponderSocket;
						responderSocket.session = {
							userId: session.user.id,
							email: session.user.email ?? "",
						};
						wss.emit("connection", responderSocket, upgradeRequest);
					});
				} catch (error) {
					console.error("Failed to authorize websocket", error);
					upgradeSocket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
					upgradeSocket.destroy();
				}
			},
		);

		wss.on("connection", async (socket) => {
			const ws = socket as ResponderSocket;
			const email = ws.session?.email ?? "unknown";

			console.log(`Responder websocket connected: ${email}`);

			try {
				await initializeResponderSession(ws);
			} catch (error) {
				const err = error as Error & { code?: string };
				console.error("Responder session init error:", err);
				sendError(ws, err.message, err.code);
				ws.close(1011, err.message);
				return;
			}

			ws.on("message", async (raw) => {
				try {
					const decoded = JSON.parse(raw.toString());
					if (decoded?.type === "heartbeat") {
						sendJSON(ws, { type: "heartbeat", ts: Date.now() });
						return;
					}
					if (decoded?.type === "chat" && typeof decoded.text === "string") {
						await handleChatMessage(ws, decoded.text);
					}
				} catch (error) {
					console.error("Responder websocket message error:", error);
					sendError(ws, "Failed to process message", "MESSAGE_ERROR");
				}
			});

			ws.on("close", () => {
				console.log(`Responder websocket disconnected: ${email}`);
			});
		});

		server.responderWss = wss;
		console.info("Responder websocket server initialized (Node runtime)");
	}

	res.status(200).json({ ok: true });
}
