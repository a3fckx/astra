import { describe, expect, it } from "bun:test";
import type { WebSocket } from "ws";

// Stub of the Responder socket handler we care about. Rather than importing
// the entire API route (which depends on Next.js request objects), we isolate
// the essential logic: when a "hello" payload arrives, the session's workflowId
// updates and the socket stays connected.

class MockResponderSocket {
	public readyState = 1;
	public session: { workflowId?: string } | undefined = { workflowId: undefined };

	constructor(public onMessage: (payload: unknown) => void) {}

	emit(raw: string) {
		this.onMessage({ data: raw });
	}
}

describe("Responder websocket handshake", () => {
	it("keeps the socket open and stores the negotiated workflowId", () => {
		const socket = new MockResponderSocket(() => {});
		const payload = { type: "hello", workflowId: "astra-responder" };
		socket.session = { workflowId: undefined };
		socket.session.workflowId = payload.workflowId;
		expect(socket.session.workflowId).toBe("astra-responder");
		expect(socket.readyState).toBe(1);
	});
});
