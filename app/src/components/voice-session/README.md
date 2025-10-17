# Voice Session Module

A clean, modular implementation of ElevenLabs voice session management for the Astra application.

## Architecture

This module has been refactored from a monolithic 800-line component into a well-structured, maintainable architecture following React best practices.

### File Structure

```
voice-session/
├── index.tsx                   # Main orchestration component
├── VoiceSessionUI.tsx          # Pure presentational component
├── types.ts                    # TypeScript type definitions
├── constants.ts                # Configuration values and messages
├── utils.ts                    # Helper functions
├── useSessionHandshake.ts      # Session data fetching hook
├── useMicrophoneAccess.ts      # Microphone permission management hook
├── useVoiceConnection.ts       # ElevenLabs connection management hook
└── README.md                   # This file
```

### Separation of Concerns

#### `index.tsx` - Main Component
- **Purpose**: Orchestrates all hooks and passes data to UI
- **Responsibilities**:
  - Composes custom hooks
  - Derives computed values (user display name, agent config)
  - Passes data to presentational component
- **Key Feature**: Clean, readable, focused on composition

#### `VoiceSessionUI.tsx` - Presentational Component
- **Purpose**: Pure UI rendering with no business logic
- **Responsibilities**:
  - Renders connection status
  - Displays control buttons
  - Shows status messages and errors
- **Key Feature**: Fully testable with simple props

#### `types.ts` - Type Definitions
- **Purpose**: Centralized TypeScript types
- **Contains**:
  - Connection and microphone status types
  - Session handshake types
  - Component props types
  - State types

#### `constants.ts` - Configuration
- **Purpose**: All static values in one place
- **Contains**:
  - Workflow ID
  - Timing intervals
  - UI labels and messages
  - Warning/error messages

#### `utils.ts` - Helper Functions
- **Purpose**: Pure utility functions
- **Contains**:
  - Dynamic variable sanitization
  - User display name extraction
  - First message generation
  - Agent configuration builders
  - Validation functions

#### `useSessionHandshake.ts` - Session Hook
- **Purpose**: Manages session data fetching
- **Responsibilities**:
  - Fetches session context from API
  - Validates handshake payload
  - Manages loading and warning states
- **ANCHOR**: Validates user information presence

#### `useMicrophoneAccess.ts` - Microphone Hook
- **Purpose**: Handles microphone permissions
- **Responsibilities**:
  - Requests browser mic access
  - Tracks permission status
  - Handles permission errors
- **Key Feature**: Prevents duplicate requests

#### `useVoiceConnection.ts` - Connection Hook
- **Purpose**: Manages ElevenLabs voice connection lifecycle
- **Responsibilities**:
  - ElevenLabs SDK integration via `useConversation`
  - Connection start/stop logic
  - Contextual updates
  - Conversation persistence
- **ANCHOR**: `conversation-ledger` for MongoDB persistence
- **ANCHOR**: `session-context-update` for metadata injection

## Key Features

### 1. Personalized Greeting
The agent greets users by name using dynamic variables:
```typescript
// Generated in utils.ts
`Namaste ${displayName}! I'm Jadugar, your cosmic companion...`
```

### 2. Dynamic Variables
Session-specific data injected into every conversation turn:
- User name
- Workflow ID
- Julep session ID
- Birth chart data (date, time, place)
- Integration tokens

### 3. Contextual Updates
Real-time session metadata sent to ElevenLabs upon connection:
- User identity
- Workflow context
- Memory availability

### 4. Conversation Persistence
Every conversation is logged to MongoDB for:
- Transcript retrieval
- Background processing
- Analytics

## Usage

Import and use the component:

```tsx
import { VoiceSession } from "@/components/voice-session";

export default function Page() {
  return <VoiceSession agentId={process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!} />;
}
```

## Benefits of This Architecture

### Maintainability
- Each file has a single, clear responsibility
- Logic is isolated and easy to locate
- Changes to one concern don't affect others

### Testability
- Pure functions can be tested in isolation
- Hooks can be tested with React Testing Library
- UI component is a pure function of props

### Readability
- Main component is ~90 lines vs 800
- File names clearly indicate purpose
- Business logic is documented with ANCHOR comments

### Reusability
- Hooks can be used in other components
- Utilities are framework-agnostic
- Types are shared across the module

### Type Safety
- Centralized types ensure consistency
- Proper type narrowing in validation
- No `any` types

## Important Anchors

These ANCHOR comments mark business-critical logic:

### `ANCHOR:dynamic-session-variables` (utils.ts)
Documents which fields are exposed to ElevenLabs. Must stay aligned with `app/docs/responder.md`.

### `ANCHOR:elevenlabs-first-message` (utils.ts)
Personalized greeting generation logic. Update here to change welcome message.

### `ANCHOR:elevenlabs-prompt-template` (utils.ts)
Agent prompt extraction. Server-side template is injected here.

### `ANCHOR:conversation-ledger` (useVoiceConnection.ts)
Conversation persistence to MongoDB. Required for transcript retrieval by background agents.

### `ANCHOR:session-context-update` (useVoiceConnection.ts)
Session metadata injection on connection. Enables agent to access user context.

## Integration Points

### APIs Used
- `GET /api/responder/session` - Fetches session handshake
- `POST /api/elevenlabs/signed-url` - Gets WebSocket URL
- `POST /api/responder/conversations` - Persists conversation metadata

### External Dependencies
- `@elevenlabs/react` - ElevenLabs React SDK
- MongoDB - Session and conversation storage
- Julep - User memory and session management

## Removed Features

### User Activity Heartbeat (Removed)
The original implementation included a 15-second interval that sent `sendUserActivity()` signals to ElevenLabs. This was **removed** because:

- **Incorrect use case**: `sendUserActivity()` is meant for text-based interactions (typing in chat) to prevent the agent from interrupting
- **Voice-only interface**: Astra uses voice exclusively, so there's no typing activity to detect
- **Negative impact**: Sending activity signals every 15 seconds caused the agent to pause for 2 seconds, disrupting conversation flow
- **No benefit**: The heartbeat provided no value in a pure voice conversation context

If you need `sendUserActivity()` in the future, use it only when there's actual user interaction:
```typescript
// ✅ Only if you add text chat alongside voice
<input onChange={() => sendUserActivity()} />

// ❌ Don't use automatic intervals
setInterval(() => sendUserActivity(), 15000); // REMOVED
```

## Future Enhancements

Potential improvements to consider:

1. **Error Boundaries**: Add React error boundaries for graceful failures
2. **Loading States**: Add skeleton loaders during handshake
3. **Offline Support**: Queue messages when connection drops
4. **Audio Visualization**: Add waveform display for input/output
5. **Transcript Display**: Show conversation history in real-time
6. **Session Recording**: Add ability to download conversation audio
7. **Multi-language**: Support greeting in user's preferred language
8. **Text Chat Input**: Add optional text input (would require `sendUserActivity()` on typing)

## Development Guidelines

### Adding New Features

1. **State Management**: Add state to the appropriate hook
2. **UI Changes**: Update `VoiceSessionUI.tsx` only
3. **Business Logic**: Add utilities to `utils.ts`
4. **Constants**: Define messages in `constants.ts`
5. **Types**: Update `types.ts` for new data structures

### Testing Strategy

1. **Unit Tests**: Test pure functions in `utils.ts`
2. **Hook Tests**: Test hooks with `@testing-library/react-hooks`
3. **Component Tests**: Test UI with `@testing-library/react`
4. **Integration Tests**: Test full flow end-to-end

### Code Style

- Use descriptive function names
- Add JSDoc comments for public functions
- Use ANCHOR comments for business logic
- Keep functions small and focused
- Prefer functional programming patterns

## Troubleshooting

### Common Issues

**"Microphone access denied"**
- User needs to grant browser permissions
- Check browser compatibility
- Verify HTTPS in production

**"Session context unavailable"**
- Verify user is authenticated
- Check `/api/responder/session` response
- Ensure MongoDB connection is active

**"Failed to get signed URL"**
- Verify `ELEVENLABS_API_KEY` is set
- Check ElevenLabs agent ID is correct
- Review API rate limits

## Related Documentation

- [Main Architecture](../../../docs/ARCHITECTURE.md)
- [Persona Details](../../../docs/PERSONA.md)
- [ElevenLabs React SDK](../../../docs/react-sdk.mdx)