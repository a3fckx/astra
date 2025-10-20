/**
 * useMicrophoneAccess Hook
 * Manages microphone permission requests and status
 */

import { useCallback, useRef, useState } from "react";
import type { MicrophoneStatus } from "./types";

export function useMicrophoneAccess() {
	const [micStatus, setMicStatus] = useState<MicrophoneStatus>("idle");
	const micRequestRef = useRef<Promise<void> | null>(null);

	const requestAccess = useCallback(async () => {
		if (
			typeof navigator === "undefined" ||
			!navigator.mediaDevices ||
			!navigator.mediaDevices.getUserMedia
		) {
			setMicStatus("unsupported");
			throw new Error(
				"Microphone access is not supported in this environment.",
			);
		}

		if (micStatus === "granted") {
			return;
		}

		if (micRequestRef.current) {
			await micRequestRef.current;
			return;
		}

		setMicStatus("requesting");
		const request = navigator.mediaDevices
			.getUserMedia({ audio: true })
			.then((stream) => {
				stream.getTracks().forEach((track) => {
					track.stop();
				});
				setMicStatus("granted");
			})
			.catch((micError) => {
				setMicStatus("denied");
				throw micError instanceof Error
					? micError
					: new Error("Microphone access denied");
			})
			.finally(() => {
				micRequestRef.current = null;
			});

		micRequestRef.current = request;
		await request;
	}, [micStatus]);

	return {
		micStatus,
		requestAccess,
	};
}
