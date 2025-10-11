import type { Server as HttpServer, IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { parse } from "node:url";
import type { ChangeStream } from "mongodb";
import type { NextApiRequest, NextApiResponse } from "next";
import { type WebSocket, WebSocketServer } from "ws";
import { WORKFLOW_ID } from "@/lib/chatkit-config";
import { getResponderEvents, getResponderOutbox } from "@/lib/mongo";
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
		workflowId?: string;
	};
	changeStream?: ChangeStream;
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
	ws.session.workflowId = ws.session.workflowId ?? WORKFLOW_ID;
	const workflowId = ws.session.workflowId ?? WORKFLOW_ID;

	const events = getResponderEvents();
	const recentEvents = await events
		.find({
			userId: ws.session.userId,
			$or: [
				{ workflowId: { $exists: false } },
				{ workflowId },
			],
		})
		.sort({ createdAt: -1 })
		.limit(100)
		.toArray();

	sendJSON(ws, {
		type: "messages:init",
		data: recentEvents
			.map((event) => ({
				id: event._id?.toString() ?? `event-${event.createdAt.getTime()}`,
				role: event.role,
				content: event.content,
				createdAt: event.createdAt.toISOString(),
				metadata: event.metadata ?? null,
			}))
			.reverse(),
	});

	sendJSON(ws, {
		type: "connected",
		data: {
			userId: ws.session.userId,
			sessionId,
			workflowId,
		},
	});
}

async function subscribeToResponderEvents(ws: ResponderSocket) {
	if (!ws.session) {
		throw new Error("Missing session context for change stream");
	}

	const events = getResponderEvents();
	const workflowId = ws.session.workflowId ?? WORKFLOW_ID;

	try {
		const changeStream = events.watch(
			[
				{
					$match: {
						"fullDocument.userId": ws.session.userId,
						...(workflowId
							? {
								$or: [
									{ "fullDocument.workflowId": workflowId },
									{ "fullDocument.workflowId": { $exists: false } },
								],
							}
							: {}),
						operationType: { $in: ["insert", "update", "replace"] },
					},
				},
			],
			{ fullDocument: "updateLookup" },
		);

		ws.changeStream = changeStream;

		changeStream.on("change", (change) => {
			const doc = change.fullDocument;
			if (!doc) {
				return;
			}

			sendJSON(ws, {
				type: "messages:append",
				data: {
					id:
						doc._id?.toString() ??
						`event-${doc.createdAt instanceof Date ? doc.createdAt.getTime() : Date.now()}`,
					workflowId: doc.workflowId ?? workflowId,
					role: doc.role,
					content: doc.content,
					createdAt:
						doc.createdAt instanceof Date
							? doc.createdAt.toISOString()
							: new Date(doc.createdAt).toISOString(),
					metadata: doc.metadata ?? null,
				},
			});
		});

		changeStream.on("error", (error) => {
			console.error("Responder change stream error:", error);
			sendError(ws, "Change stream error", "CHANGE_STREAM_ERROR");
		});
	} catch (error) {
		console.error("Failed to start responder change stream:", error);
		sendError(ws, "Streaming not available", "CHANGE_STREAM_UNAVAILABLE");
	}
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
					const baseUrl =
						process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
					const sessionResponse = await fetch(
						`${baseUrl}/api/auth/get-session`,
						{
							headers: {
								cookie: upgradeRequest.headers.cookie ?? "",
							},
							method: "GET",
						},
					);

					if (!sessionResponse.ok) {
						upgradeSocket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
						upgradeSocket.destroy();
						return;
					}

					const session = (await sessionResponse.json()) as {
						session?: {
							userId: string;
						};
						user?: {
							id: string;
							email?: string | null;
						};
					};

					if (!session?.user?.id) {
						upgradeSocket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
						upgradeSocket.destroy();
						return;
					}

				wss.handleUpgrade(upgradeRequest, upgradeSocket, head, (ws) => {
					const responderSocket = ws as ResponderSocket;
					responderSocket.session = {
						userId: session.user.id,
						email: session.user.email ?? "",
						workflowId: WORKFLOW_ID,
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
				if (ws.session) {
					ws.session.workflowId = ws.session.workflowId ?? WORKFLOW_ID;
				}

				console.log(`Responder websocket connected: ${email}`);

				try {
					await initializeResponderSession(ws);
				await subscribeToResponderEvents(ws);
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
						if (decoded?.type === "hello") {
							const incomingWorkflow =
								typeof decoded.workflowId === "string" && decoded.workflowId.trim().length > 0
									? decoded.workflowId.trim()
									: WORKFLOW_ID;
							if (!ws.session) {
								ws.session = {
									userId: "unknown",
									email: "unknown",
									workflowId: incomingWorkflow,
								};
							} else if (ws.session.workflowId !== incomingWorkflow) {
								ws.session.workflowId = incomingWorkflow;
								if (ws.changeStream) {
									try {
										await ws.changeStream.close();
									} catch (closeError) {
										console.error("Failed to close existing change stream:", closeError);
									}
								}
								await subscribeToResponderEvents(ws);
							}
							return;
						}
						if (decoded?.type === "chat" && typeof decoded.text === "string") {
							const text = decoded.text.trim();
							if (!text) {
								return;
							}

							const now = new Date();
							const outbox = getResponderOutbox();
							const events = getResponderEvents();
							const incomingMetadata =
								decoded.metadata && typeof decoded.metadata === "object"
									? (decoded.metadata as Record<string, unknown>)
									: undefined;
							const workflowId =
								typeof decoded.workflowId === "string" && decoded.workflowId.trim().length > 0
									? decoded.workflowId.trim()
									: ws.session?.workflowId ?? WORKFLOW_ID;
							if (ws.session) {
								ws.session.workflowId = workflowId;
							}

							const insertResult = await outbox.insertOne({
								userId: ws.session?.userId ?? "unknown",
								workflowId,
								content: text,
								createdAt: now,
								status: "pending" as const,
								metadata: incomingMetadata ?? null,
							});

							await events.insertOne({
								userId: ws.session?.userId ?? "unknown",
								workflowId,
								role: "user" as const,
								content: text,
								createdAt: now,
								metadata: {
									outboxId: insertResult.insertedId?.toString(),
									status: "queued",
									source: "socket",
									workflowId,
									payload: incomingMetadata,
								},
							});
						}
				} catch (error) {
					console.error("Responder websocket message error:", error);
					sendError(ws, "Failed to process message", "MESSAGE_ERROR");
				}
			});

			ws.on("close", () => {
				console.log(`Responder websocket disconnected: ${email}`);
				void (async () => {
					try {
						await ws.changeStream?.close();
					} catch (streamError) {
						console.error(
							"Failed to close responder change stream:",
							streamError,
						);
					}
				})();
			});
		});

		server.responderWss = wss;
		console.info("Responder websocket server initialized (Node runtime)");
	}

	res.status(200).json({ ok: true });
}
