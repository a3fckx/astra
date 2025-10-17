"use client";

/**
 * VoiceSession Component
 * Clean orchestration of ElevenLabs voice session management
 */

import { useMemo } from "react";
import { WORKFLOW_ID } from "./constants";
import type { VoiceSessionProps } from "./types";
import { useMicrophoneAccess } from "./useMicrophoneAccess";
import { useSessionHandshake } from "./useSessionHandshake";
import { useVoiceConnection } from "./useVoiceConnection";
import {
	buildDynamicVariables,
	generateFirstMessage,
	getAgentPrompt,
	getUserDisplayName,
} from "./utils";
import { VoiceSessionUI } from "./VoiceSessionUI";

export function VoiceSession({ agentId }: VoiceSessionProps) {
	// Fetch session handshake data
	const { handshake, handshakeLoaded, warning } = useSessionHandshake();

	// Manage microphone permissions
	const { micStatus, requestAccess: requestMicAccess } = useMicrophoneAccess();

	// Derive user information and agent configuration
	const userDisplayName = useMemo(
		() => getUserDisplayName(handshake),
		[handshake],
	);

	const agentPrompt = useMemo(() => getAgentPrompt(handshake), [handshake]);

	const agentFirstMessage = useMemo(
		() => generateFirstMessage(userDisplayName, handshake),
		[userDisplayName, handshake],
	);

	const dynamicVariables = useMemo(() => {
		if (!handshake) {
			return undefined;
		}
		return buildDynamicVariables(handshake, userDisplayName, WORKFLOW_ID);
	}, [handshake, userDisplayName]);

	// Manage voice connection and session lifecycle
	const {
		status,
		error,
		micMuted,
		isStarting,
		handleStart,
		handleStop,
		toggleMute,
	} = useVoiceConnection({
		agentId,
		handshake,
		handshakeLoaded,
		micStatus,
		requestMicAccess,
		agentPrompt,
		agentFirstMessage,
		dynamicVariables,
	});

	const handshakeReady = handshakeLoaded && Boolean(handshake);

	return (
		<VoiceSessionUI
			status={status}
			micStatus={micStatus}
			micMuted={micMuted}
			isStarting={isStarting}
			userDisplayName={userDisplayName}
			error={error}
			warning={warning}
			handshakeReady={handshakeReady}
			onStart={handleStart}
			onStop={handleStop}
			onToggleMute={toggleMute}
		/>
	);
}

export type { VoiceSessionProps } from "./types";
