/**
 * useSessionHandshake Hook
 * Manages session handshake data fetching and state
 */

import { useEffect, useState } from "react";
import { STATUS_MESSAGES, WORKFLOW_ID } from "./constants";
import type { SessionHandshake } from "./types";
import { isValidHandshake } from "./utils";

export function useSessionHandshake() {
	const [handshake, setHandshake] = useState<SessionHandshake | null>(null);
	const [handshakeLoaded, setHandshakeLoaded] = useState(false);
	const [warning, setWarning] = useState<string | null>(null);

	useEffect(() => {
		const loadHandshake = async () => {
			try {
				const response = await fetch(
					`/api/responder/session?workflowId=${encodeURIComponent(WORKFLOW_ID)}`,
				);

				if (!response.ok) {
					throw new Error(
						`Failed to fetch session context (${response.status})`,
					);
				}

				const payload = await response.json();

				if (!isValidHandshake(payload)) {
					throw new Error("Session payload missing user information");
				}

				const typedPayload = payload as {
					session: SessionHandshake["session"];
					integrations?: Partial<SessionHandshake["integrations"]>;
					prompt?: SessionHandshake["prompt"];
				};

				setHandshake({
					session: typedPayload.session,
					integrations: {
						elevenlabs: typedPayload.integrations?.elevenlabs ?? null,
					},
					prompt: typedPayload.prompt ?? null,
				});
				setWarning(null);
			} catch (handshakeError) {
				console.error("Failed to fetch session handshake", handshakeError);
				setWarning(STATUS_MESSAGES.memoryWarning);
			} finally {
				setHandshakeLoaded(true);
			}
		};

		void loadHandshake();
	}, []);

	return {
		handshake,
		handshakeLoaded,
		warning,
		setWarning,
	};
}
