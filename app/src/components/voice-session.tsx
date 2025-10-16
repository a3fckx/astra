/**
 * VoiceSession Component
 * Clean re-export from modular structure
 *
 * The voice session logic has been refactored into a clean, maintainable structure:
 * - voice-session/index.tsx - Main orchestration component
 * - voice-session/types.ts - Type definitions
 * - voice-session/constants.ts - Configuration and messages
 * - voice-session/utils.ts - Helper functions
 * - voice-session/useSessionHandshake.ts - Session data fetching hook
 * - voice-session/useMicrophoneAccess.ts - Microphone permission hook
 * - voice-session/useVoiceConnection.ts - ElevenLabs connection hook
 * - voice-session/VoiceSessionUI.tsx - Pure presentational component
 */

export { VoiceSession, type VoiceSessionProps } from "./voice-session/index";
