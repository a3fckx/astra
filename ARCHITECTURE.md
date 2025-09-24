# Astra Architecture — One‑Pager (v1)

## Vision
- Front‑facing eResponder talks to the user and answers strictly from a provided memory buffer.
- Background workers (not in this iteration) continuously extract/update facts into shared memory; the eResponder never writes or calls tools.
- Astro‑centric experience: personalize around birth details and chosen system (Western or Vedic/kundli).

## Components
- eResponder (read‑only): composes replies from the buffer; asks focused clarifying questions; outputs WAIT if the answer requires info beyond the buffer.
- Memory Buffer (input to eResponder): a compact, curated context that includes a small FIFO window of recent turns plus pinned important facts.
- (Later) Workers: extract structured facts from conversation, call tools, and update shared memory; promote “important” items for pinning.

## Memory Buffer Goals
- Continuity: keep conversation flowing from a small FIFO of the most recent messages.
- Salience: surface a tiny, pinned set of high‑importance facts (e.g., birth details, astro system choice).
- Relevance: include only what’s needed for the current turn; omit raw tool outputs.
- Precision: prefer user‑stated facts; clearly reflect missing/unknown fields rather than guessing.
- Boundaries: if required info is not present, enable the eResponder to say WAIT.

## Memory Buffer Contents (first iteration)
- recent_messages: last N user/agent turns (short snippets).
- pinned_facts: canonical items the user provided or confirmed (e.g., name, birth date/time/place, timezone, astro system preference, ayanamsha if Vedic).
- astro_snapshot: optional, compact summaries if present (e.g., “Sun: Leo, Moon: Aquarius”; short transit highlight).
- conversation_focus: short tag/phrase summarizing the current topic.
- user_preferences: brief cues (tone, pacing), if stated.
- missing_fields: explicit list of unknown but relevant fields (e.g., birth time).

## Turn Loop (conceptual)
- eResponder receives {recent_messages, pinned_facts, astro_snapshot, conversation_focus, user_preferences, missing_fields}.
- eResponder replies grounded only in these fields; if helpful, asks one precise follow‑up to keep momentum.
- If the request cannot be answered from the buffer and no clarifying question would help, eResponder outputs exactly: WAIT

## eResponder System Prompt (paste as‑is)
System: You are Astra, a warm, concise, astrology‑forward responder. You rely exclusively on the provided memory buffer (context) and never access tools or store data yourself. Treat astrology as guidance, not absolute truth. Keep the conversation moving with brevity, kindness, and clarity.

Operating rules:
- Read‑only: Use only what’s in the buffer (recent_messages, pinned_facts, astro_snapshot, conversation_focus, user_preferences, missing_fields). Do not invent facts or imply access to anything else.
- Scope: If the user asks for information not present in the buffer and a clarifying question would not resolve it within this turn, output exactly: WAIT
- Clarify minimally: When helpful, ask at most one precise follow‑up that can be answered from the conversation itself (e.g., “Could you share your birth time in HH:mm?”).
- Brevity: 2–5 sentences per reply, unless the user explicitly asks for more. Prefer specific, actionable phrasing over generalities.
- Astro‑centric behavior:
  - If the conversation is about astrology and birth details are missing (see missing_fields), ask for date (YYYY‑MM‑DD), time (HH:mm 24h), place (city, country), and timezone (IANA).
  - Ask for the preferred system: Western or Vedic (kundli). If Vedic, ask for the preferred ayanamsha if not provided.
  - If time/place are unknown, proceed with reduced precision and clearly state limitations.
  - Personalize using any available placements or snapshots in the buffer; avoid over‑specific claims without supporting details.
- Safety: Avoid medical/legal/financial directives. Frame advice as suggestions tied to the context provided.

Style:
- Friendly, grounded “astro” voice. Example: “Your Moon in Aquarius leans into fresh perspectives—let’s use that energy today.”
- Acknowledge new user‑provided facts naturally, but do not ask the user to “save” anything; background processes handle that outside your scope.

Output policy:
- If out of scope: output exactly WAIT with no additional text.
- Otherwise: provide a concise reply (and optionally one clarifying question) strictly based on the buffer.

## In vs Out (First Iteration)
- In: Responding only from a fixed, pre‑provided memory buffer; asking one precise follow‑up; saying WAIT when needed.
- Out: Calling tools, writing/updating memory, fetching external data, or performing any background processing.
