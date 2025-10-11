# Astra Documentation

Complete documentation for the Astra astrology platform.

---

## 📚 Documentation Index

### Getting Started
- **[RUNNING_THE_APP.md](./RUNNING_THE_APP.md)** - Complete setup and run guide
  - Prerequisites, environment setup, creating agents, testing

### Architecture & Design
- **[SHARED_MEMORY_ARCHITECTURE.md](./SHARED_MEMORY_ARCHITECTURE.md)** - How agents share memory via Julep documents
  - User onboarding flow, birth data collection, Vedic chart generation
  - Document types, memory search, TTS integration, MCP tools

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - High-level system architecture
  - Component overview, data flow

- **[WORKFLOWS.md](./WORKFLOWS.md)** - Key workflows and processes
  - Authentication flow, responder patterns

### Implementation Guides
- **[JULEP_IMPLEMENTATION.md](./JULEP_IMPLEMENTATION.md)** - Julep multi-agent setup
  - Step-by-step Julep configuration, sessions, documents

- **[AGENT_MANAGEMENT.md](./AGENT_MANAGEMENT.md)** - Managing agents via YAML
  - Creating agents, updating configurations, tools, best practices

- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - What was built
  - File changes, new features, data flow

### Reference
- **[COMPONENTS.md](./COMPONENTS.md)** - Module and component reference
  - File structure, key modules

- **[PERSONA.md](./PERSONA.md)** - Astra's personality and behavior
  - Voice, tone, operating rules

- **[SESSION_TRACKING.md](./SESSION_TRACKING.md)** - Development session logging
  - How to use `.sessions/` for tracking work

---

## 🚀 Quick Start Path

**New to the project?** Follow this reading order:

1. **[RUNNING_THE_APP.md](./RUNNING_THE_APP.md)** - Get the app running
2. **[SHARED_MEMORY_ARCHITECTURE.md](./SHARED_MEMORY_ARCHITECTURE.md)** - Understand how it works
3. **[AGENT_MANAGEMENT.md](./AGENT_MANAGEMENT.md)** - Learn to manage agents
4. **[JULEP_IMPLEMENTATION.md](./JULEP_IMPLEMENTATION.md)** - Deep dive into Julep

---

## 🎯 Current Implementation Status

### ✅ Complete
- YAML-based agent configuration
- OpenRouter LLM integration (Claude Sonnet 4.5)
- Bun native WebSocket
- ElevenLabs TTS streaming
- Shared document memory system
- User authentication (Better Auth + Google OAuth)
- MongoDB integration

### 🔄 In Progress
- Agent creation (run `bun run sync:agents`)
- Testing complete flow

### 📋 Planned
- Birth data collection UI
- Vedic chart calculation
- Background task scheduling
- MCP tool integration for astrology calculations

---

## 🏗️ System Architecture Summary

```
User → Next.js App (Bun) → Julep Platform
                              ↓
                    ┌─────────────────────┐
                    │  Astra Agent        │
                    │  (Responder)        │
                    └──────────┬──────────┘
                               ↓
                    ┌─────────────────────┐
                    │ Shared Memory Layer │
                    │ (User Documents)    │
                    └──────────┬──────────┘
                               ↓
                    ┌─────────────────────┐
                    │ Background Worker   │
                    │ Agent               │
                    └─────────────────────┘
```

**Key Concept**: Both agents read/write to the same user documents, enabling:
- Asynchronous data enrichment
- Context-aware conversations
- Long-term memory persistence

---

## 🛠️ Key Technologies

- **Next.js 15**: App Router, React 18
- **Bun**: JavaScript runtime + native WebSocket
- **Julep**: Multi-agent orchestration + RAG memory
- **OpenRouter**: LLM provider (Claude, GPT, Gemini, etc.)
- **Better Auth**: Authentication with Google OAuth
- **MongoDB Atlas**: User data persistence
- **ElevenLabs**: Text-to-speech streaming
- **TypeScript + Biome**: Type safety + code quality

---

## 📖 Documentation Maintenance

### Adding New Documentation

1. Create Markdown file in `docs/`
2. Follow existing structure (clear headings, code examples)
3. Add to this README's index
4. Link from related docs

### Updating Existing Docs

- Keep docs in sync with code changes
- Use clear examples
- Include troubleshooting sections
- Update last modified date at bottom

### Style Guide

- Use **bold** for emphasis
- Use `code` for commands, variables, filenames
- Use ```blocks``` for code examples with language tags
- Include emojis for visual scanning (✅ ❌ 🔄 📋)
- Link between related docs

---

## 🔗 External Resources

- [Julep Documentation](https://docs.julep.ai)
- [OpenRouter Models](https://openrouter.ai/models)
- [Better Auth Docs](https://www.better-auth.com/docs)
- [ElevenLabs API](https://elevenlabs.io/docs)
- [Bun Documentation](https://bun.sh/docs)

---

## 💬 Getting Help

- Check [RUNNING_THE_APP.md](./RUNNING_THE_APP.md) troubleshooting section
- Review session logs in `.sessions/`
- Check GitHub Issues
- Join Discord community (if applicable)

---

**Last Updated**: 2025-01-15  
**Status**: ✅ Implementation Complete, Ready for Agent Creation
