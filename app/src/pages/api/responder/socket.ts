import type { Server as HttpServer, IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { parse } from "node:url";
import type { ChangeStream } from "mongodb";
import type { NextApiRequest, NextApiResponse } from "next";
import { type WebSocket, WebSocketServer } from "ws";
import { auth } from "@/lib/auth";
import { getResponderEvents } from "@/lib/mongo";

export const config = {
	api: {
		bodyParser: false,
	},
};

type ResolverServer = HttpServer & {
	resolverWss?: WebSocketServer;
};

type SocketResponse = NextApiResponse & {
	socket: NextApiResponse["socket"] & {
		server?: ResolverServer;
	};
};

type AuthenticatedRequest = IncomingMessage & {
	sessionUserId?: string;
};

const attachChangeStream = async ({
	userId,
	ws,
}: {
	userId: string;
	ws: WebSocket;
}) => {
	const events = getResponderEvents();
	try {
		const existing = await events
			.find({ userId })
			.sort({ createdAt: -1 })
			.limit(25)
			.toArray();

		ws.send(
			JSON.stringify({
				type: "messages:init",
				data: existing.reverse().map((event) => ({
					id: event._id?.toString() ?? `event-${event.createdAt.getTime()}`,
					role: event.role,
					content: event.content,
					createdAt: event.createdAt.toISOString(),
					metadata: event.metadata ?? null,
				})),
			}),
		);
	} catch (error) {
		console.error("Failed to seed responder events", error);
		ws.send(
			JSON.stringify({
				type: "error",
				error: "Unable to load previous events",
			}),
		);
	}

	let closed = false;
	let changeStream: ChangeStream | undefined;
	try {
		changeStream = events.watch(
			[
				{
					$match: {
						"fullDocument.userId": userId,
						operationType: { $in: ["insert", "update", "replace"] },
					},
				},
			],
			{ fullDocument: "updateLookup" },
		);
	} catch (error) {
		console.error("Change streams are not available", error);
		ws.send(
			JSON.stringify({
				type: "error",
				error:
					"Change streams are unavailable on this MongoDB deployment. Realtime updates disabled.",
			}),
		);
		return;
	}

	changeStream.on("change", (change) => {
		if (closed) {
			return;
		}
		if (!("fullDocument" in change) || !change.fullDocument) {
			return;
		}
		const fullDocument = change.fullDocument;
		ws.send(
			JSON.stringify({
				type: "messages:append",
				data: {
					id: fullDocument._id?.toString() ?? `event-${Date.now()}`,
					role: fullDocument.role,
					content: fullDocument.content,
					createdAt: (fullDocument.createdAt instanceof Date
						? fullDocument.createdAt
						: new Date(fullDocument.createdAt)
					).toISOString(),
					metadata: fullDocument.metadata ?? null,
				},
			}),
		);
	});

	changeStream.on("error", (error) => {
		console.error("Responder change stream error", error);
		if (!closed) {
			ws.send(
				JSON.stringify({
					type: "error",
					error: "Responder stream disconnected. Please retry shortly.",
				}),
			);
		}
	});

	ws.on("close", () => {
		closed = true;
		if (changeStream) {
			changeStream.close().catch((streamError) => {
				console.error("Failed to close responder change stream", streamError);
			});
		}
	});
};

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

	if (!server.resolverWss) {
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
					const headerMap = new Headers();
					for (const [name, value] of Object.entries(upgradeRequest.headers)) {
						if (!value) continue;
						if (Array.isArray(value)) {
							headerMap.set(name, value.join(","));
						} else {
							headerMap.set(name, value);
						}
					}

					const session = await auth.api.getSession({
						headers: headerMap,
					});

					if (!session) {
						upgradeSocket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
						upgradeSocket.destroy();
						return;
					}

					wss.handleUpgrade(upgradeRequest, upgradeSocket, head, (ws) => {
						const trackedRequest = upgradeRequest as AuthenticatedRequest;
						trackedRequest.sessionUserId = session.user.id;
						wss.emit("connection", ws, trackedRequest);
					});
				} catch (error) {
					console.error("Failed to authorize websocket", error);
					upgradeSocket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
					upgradeSocket.destroy();
				}
			},
		);

		wss.on("connection", (ws, connectionRequest: AuthenticatedRequest) => {
			const userId = connectionRequest.sessionUserId;
			if (!userId) {
				ws.close(1008, "Unauthorized");
				return;
			}

			attachChangeStream({ userId, ws }).catch((error) => {
				console.error("Failed to attach responder stream", error);
				ws.send(
					JSON.stringify({
						type: "error",
						error: "Unable to attach change stream",
					}),
				);
			});

			ws.on("message", (raw) => {
				try {
					const decoded = JSON.parse(raw.toString());
					if (decoded?.type === "heartbeat") {
						ws.send(JSON.stringify({ type: "heartbeat", ts: Date.now() }));
					}
				} catch (error) {
					console.error("Responder socket message error", error);
				}
			});
		});

		server.resolverWss = wss;
		console.info("Responder websocket server initialized");
	}

	res.status(200).json({ ok: true });
}
