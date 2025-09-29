#!/usr/bin/env python3
"""
Minimal ElevenLabs Agent WebSocket runner

What this does
- Opens a WebSocket connection to the ElevenLabs Conversational AI endpoint
  and starts a session for an existing Agent.
- Sends a single personalization payload (conversation_initiation_client_data)
  that overrides the system prompt with your responder.md and injects
  dynamic variables from buffer/memory_buffer.json.
- Prints user transcripts and agent responses for visibility. Audio events are
  typically handled by your frontend player, so they are ignored here.

Why this exists
- Keep orchestration simple: one config, one memory JSON, one prompt file.
- Avoids extra SDK layers and custom tools unless you need them. You can still
  add client-to-server events later (e.g., contextual_update) if desired.

Prerequisites
- Python 3.9+
- websockets: pip install websockets
- An existing ElevenLabs Agent (public agent_id or a signed URL) and API key.

Files
- config.json — runtime configuration (agent_id or signed_url, voice_id, etc.).
- responder.md — your Jadugar system prompt with {{placeholders}}.
- buffer/memory_buffer.json — structured memory object; keys become
  dynamic_variables (values stringified). Example keys that your prompt expects:
  pinned_facts, astro_snapshot, user_preferences, conversation_focus,
  recent_messages, missing_fields, latest_user_message, prefilled_response.

Config fields (relevant subset)
- elevenlabs_api_key: API key (or use ELEVENLABS_API_KEY env var)
- agent_id: public agent ID; ignored if signed_url is provided
- signed_url: pre-authenticated WSS URL (for private agents)
- voice_id: TTS voice
- language: agent language (e.g., "en")
- responder_template_path: prompt file (responder.md)
- prompt_override: true to override agent prompt each session
- custom_llm_extra_body: optional LLM knobs (temperature, max_tokens, ...)
- memory_buffer_source.path: buffer/memory_buffer.json path

Flow
1) Load config and memory JSON, convert the memory object to a string map.
2) Read responder.md and replace {{var}} placeholders with values from memory.
3) Connect to WSS and send conversation_initiation_client_data with:
   - conversation_config_override.agent.prompt.prompt = rendered responder.md
   - dynamic_variables = memory JSON as strings
   - tts.voice_id, agent.language, optional first_message
4) Handle ping->pong, log user_transcript and agent_response to stdout.

Notes
- This runner does not persist transcripts or refresh dynamic variables. If you
  want continuity or a recap feature, capture events on your frontend or add a
  lightweight store around this script. ElevenLabs can also maintain state by
  conversation_id/user_id depending on your setup.
- For non-interrupting updates mid-session, see "contextual_update" in docs.

References
- WebSocket endpoint: /docs/conversational-ai/libraries/web-sockets
- Personalization payload: /docs/agents-platform/customization/personalization
- Client events: /docs/agents-platform/customization/events/client-events
"""

import argparse
import asyncio
import json
import logging
import os
import re
from typing import Any, Dict, Optional

try:
    import requests
except ModuleNotFoundError as exc:
    raise SystemExit("The 'requests' package is required. Install it inside your virtualenv first.") from exc


logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")


WSS_BASE = "wss://api.elevenlabs.io/v1/convai/conversation"


def load_config(path: str) -> Dict[str, Any]:
    """Load config.json.

    Required: agent_id or signed_url, elevenlabs_api_key (or env var).
    """
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def read_text(path: str) -> str:
    """Read a UTF-8 text file (responder.md)."""
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def load_memory_buffer(cfg: Dict[str, Any]) -> Dict[str, Any]:
    """Load structured memory JSON. Keys are passed as dynamic variables.

    Example keys: pinned_facts, astro_snapshot, user_preferences, etc.
    """
    src = cfg.get("memory_buffer_source", {})
    p = src.get("path")
    if not p or not os.path.exists(p):
        return {}
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def to_string_map(d: Dict[str, Any]) -> Dict[str, str]:
    """Convert a dict to string values for dynamic_variables.

    - dict/list values are JSON-stringified to preserve structure.
    - None becomes empty string.
    - Everything else is str(value).
    """
    out: Dict[str, str] = {}
    for k, v in d.items():
        if isinstance(v, (dict, list)):
            out[k] = json.dumps(v, ensure_ascii=False)
        elif v is None:
            out[k] = ""
        else:
            out[k] = str(v)
    return out


def render_prompt(template_text: str, variables: Dict[str, str]) -> str:
    """Naive {{var}} replacement for responder.md.

    This does not parse Markdown; it simply replaces placeholders.
    """
    out = template_text or ""
    for k, v in variables.items():
        out = out.replace("{{" + k + "}}", v)
    out = re.sub(r"{{[^{}]+}}", "", out)
    return out


def build_init_client_data(cfg: Dict[str, Any], system_prompt: str, dyn_vars: Dict[str, str]) -> Dict[str, Any]:
    """Build the conversation_initiation_client_data payload.

    Minimal by default: only override the system prompt and pass dynamic variables.
    Optional overrides (enabled via flags): language, first_message, and tts.voice_id.
    See: /docs/agents-platform/customization/personalization
    """
    agent_override: Dict[str, Any] = {"prompt": {"prompt": system_prompt}}
    if cfg.get("override_language") and cfg.get("language"):
        agent_override["language"] = cfg.get("language")
    if cfg.get("override_first_message") and cfg.get("first_message"):
        agent_override["first_message"] = cfg.get("first_message")

    convo_override: Dict[str, Any] = {"agent": agent_override}
    if cfg.get("override_tts") and cfg.get("voice_id"):
        convo_override["tts"] = {"voice_id": cfg.get("voice_id")}

    return {
        "type": "conversation_initiation_client_data",
        "conversation_config_override": convo_override,
        "custom_llm_extra_body": cfg.get("custom_llm_extra_body", {}),
        "dynamic_variables": dyn_vars,
        "user_id": cfg.get("user_id") or None,
    }


def resolve_wss_url(cfg: Dict[str, Any], api_key: Optional[str]) -> str:
    """Resolve the websocket URL based on config and auth mode."""

    signed_url = (cfg.get("signed_url") or "").strip()
    if signed_url:
        return signed_url

    agent_id = (cfg.get("agent_id") or "").strip()
    auth_mode = (cfg.get("auth_mode") or "auto").lower()

    if auth_mode == "public":
        if not agent_id:
            raise SystemExit("Missing agent_id in config.json")
        if api_key:
            print("[warn] auth_mode=public ignores ELEVENLABS_API_KEY; connection will assume a public agent.")
        return f"{WSS_BASE}?agent_id={agent_id}"

    # All other modes require a signed URL
    if not agent_id:
        raise SystemExit("Missing agent_id in config.json")
    if not api_key:
        raise SystemExit("API key required to fetch signed URL. Set ELEVENLABS_API_KEY or elevenlabs_api_key in config.")

    try:
        resp = requests.get(
            "https://api.elevenlabs.io/v1/convai/conversation/get_signed_url",
            params={"agent_id": agent_id},
            headers={"xi-api-key": api_key},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        signed = (data or {}).get("signed_url")
        if not signed:
            raise ValueError("signed_url missing in ElevenLabs response")
        print("[info] Obtained signed URL for conversation.")
        return signed
    except Exception as exc:
        raise SystemExit(f"Failed to fetch signed URL: {exc}")


async def run_websocket(cfg: Dict[str, Any], init_msg: Dict[str, Any]) -> None:
    """Connect to ElevenLabs ConvAI WebSocket and stream events.

    Handles ping/pong, prints user and agent text events. Audio is ignored here.
    """
    try:
        import websockets  # type: ignore
    except Exception as e:
        raise SystemExit("Please install websockets: pip install websockets") from e

    api_key = os.getenv("ELEVENLABS_API_KEY") or cfg.get("elevenlabs_api_key")
    if not api_key:
        raise SystemExit("Missing ELEVENLABS_API_KEY (env or config)")

    wss_url = resolve_wss_url(cfg, api_key)
    logging.info("Connecting to %s", wss_url)

    async with websockets.connect(
        wss_url,
        max_size=16 * 1024 * 1024,
    ) as ws:
        logging.info("WebSocket connection established")
        await ws.send(json.dumps(init_msg))
        logging.info("Sent conversation_initiation_client_data")
        active_conversation_id = None

        async def watch_memory_and_send_contextual_updates():
            """Optionally watch memory_buffer.json for changes and push contextual_update.

            This does NOT mutate the system prompt or re-inject dynamic_variables.
            It simply provides non-interrupting context as per docs.
            """
            path = (cfg.get("memory_buffer_source", {}) or {}).get("path")
            if not path:
                return
            interval = int(cfg.get("watch_interval_ms", 1500)) / 1000.0
            send_updates = bool(cfg.get("send_contextual_updates", True))
            if not send_updates:
                return

            last_mtime = os.path.getmtime(path) if os.path.exists(path) else 0.0
            last_vars = to_string_map(load_memory_buffer(cfg))
            while True:
                await asyncio.sleep(interval)
                try:
                    if not os.path.exists(path):
                        continue
                    mtime = os.path.getmtime(path)
                    if mtime <= last_mtime:
                        continue
                    last_mtime = mtime
                    current_mem = load_memory_buffer(cfg)
                    curr_vars = to_string_map(current_mem)
                    # Compute a small text diff of changed keys
                    changed = [k for k in curr_vars.keys() if curr_vars.get(k, "") != last_vars.get(k, "")]
                    if not changed:
                        last_vars = curr_vars
                        continue
                    if not active_conversation_id:
                        last_vars = curr_vars
                        continue
                    summary = "Context update: " + ", ".join(changed[:8])
                    if len(changed) > 8:
                        summary += f" (+{len(changed)-8} more)"
                    logging.info("Contextual update (watcher): %s", summary)
                    payload = {
                        "type": "contextual_update",
                        "text": summary,
                    }
                    if active_conversation_id:
                        payload["conversation_id"] = active_conversation_id
                    await ws.send(json.dumps(payload))
                    last_vars = curr_vars
                except Exception:
                    # Keep watching even if a read or send fails transiently
                    continue

        async def watch_updates_queue():
            """Watch an append-only NDJSON file and forward lines as contextual_update.

            Each line: { "text": "...", "conversation_id": "optional" }
            If conversation_id is present, only forward when it matches the active session.
            """
            if not cfg.get("enable_updates_queue", True):
                return
            path = cfg.get("updates_queue_path") or "buffer/updates.ndjson"
            interval = int(cfg.get("watch_interval_ms", 1500)) / 1000.0
            offset = 0
            while True:
                await asyncio.sleep(interval)
                try:
                    if not os.path.exists(path):
                        continue
                    size = os.path.getsize(path)
                    if size <= offset:
                        continue
                    with open(path, "r", encoding="utf-8") as f:
                        f.seek(offset)
                        for line in f:
                            line = line.strip()
                            if not line:
                                continue
                            try:
                                rec = json.loads(line)
                            except Exception:
                                continue
                            target = rec.get("conversation_id")
                            text = rec.get("text") or rec.get("message")
                            if not text:
                                continue
                            if target and active_conversation_id and target != active_conversation_id:
                                continue
                            if not active_conversation_id:
                                continue
                            logging.info("Contextual update (queue): %s", text)
                            payload = {
                                "type": "contextual_update",
                                "text": str(text),
                            }
                            if active_conversation_id:
                                payload["conversation_id"] = active_conversation_id
                            await ws.send(json.dumps(payload))
                    offset = size
                except Exception:
                    continue

        # Local transcript buffer (for optional tool support)
        transcript: list[dict] = []

        # Start background watchers (optional, configurable)
        if cfg.get("watch_memory_updates", True):
            asyncio.create_task(watch_memory_and_send_contextual_updates())
        if cfg.get("enable_updates_queue", True):
            asyncio.create_task(watch_updates_queue())

        try:
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                except Exception:
                    logging.exception("Failed to decode message")
                    continue

                logging.debug("Received message: %s", msg)
                mtype = msg.get("type")
                if mtype == "ping":
                    ping = msg.get("ping_event", {})
                    event_id = ping.get("event_id")
                    if event_id is not None:
                        await ws.send(json.dumps({"type": "pong", "event_id": event_id}))
                elif mtype == "conversation_initiation_metadata":
                    meta = msg.get("conversation_initiation_metadata_event", {})
                    conv_id = meta.get("conversation_id")
                    if conv_id:
                        active_conversation_id = conv_id
                        logging.info("Conversation ready (id=%s)", conv_id)
                    if conv_id and cfg.get("log_transcripts_to_file"):
                        os.makedirs(os.path.dirname(cfg["log_transcripts_to_file"]), exist_ok=True)
                elif mtype == "user_transcript":
                    ut = msg.get("user_transcription_event", {})
                    text = ut.get("user_transcript")
                    if text:
                        print(f"[user] {text}")
                        transcript.append({"role": "user", "text": text})
                        log_path = cfg.get("log_transcripts_to_file")
                        if log_path:
                            with open(log_path, "a", encoding="utf-8") as f:
                                f.write(f"U: {text}\n")
                elif mtype == "agent_response":
                    ar = msg.get("agent_response_event", {})
                    text = ar.get("agent_response")
                    if text:
                        print(f"[agent] {text}")
                        transcript.append({"role": "assistant", "text": text})
                        log_path = cfg.get("log_transcripts_to_file")
                        if log_path:
                            with open(log_path, "a", encoding="utf-8") as f:
                                f.write(f"A: {text}\n")
                elif mtype == "audio":
                    pass
                elif mtype == "interruption":
                    pass
                elif mtype == "client_tool_call":
                    call = msg.get("client_tool_call", {})
                    tool = (call.get("tool_name") or "").strip()
                    call_id = call.get("tool_call_id")
                    try:
                        result: Any
                        if tool == "getMemoryBuffer":
                            result = to_string_map(load_memory_buffer(cfg))
                        elif tool == "getConversationHistory":
                            n = int(cfg.get("recent_max", 10) or 10)
                            result = {"messages": transcript[-n:]}
                        else:
                            raise ValueError(f"Unsupported tool: {tool}")
                        await ws.send(json.dumps({
                            "type": "client_tool_result",
                            "tool_call_id": call_id,
                            "result": result,
                            "is_error": False,
                        }))
                    except Exception as e:
                        await ws.send(json.dumps({
                            "type": "client_tool_result",
                            "tool_call_id": call_id,
                            "result": str(e),
                            "is_error": True,
                        }))
        except websockets.ConnectionClosedError as exc:
            logging.error("WebSocket closed: code=%s reason=%s", exc.code, exc.reason)
            raise


def main() -> int:
    """Entry point.

    --dry prints the init payload instead of opening a WebSocket.
    """
    parser = argparse.ArgumentParser(description="Minimal ElevenLabs Agent runner (WebSocket)")
    parser.add_argument("-c", "--config", default="config.json", help="Path to config.json")
    parser.add_argument("--dry", action="store_true", help="Print init payload and exit")
    parser.add_argument("--enqueue-update", help="Append a contextual_update to the updates queue and exit")
    parser.add_argument("--conversation-id", help="Target conversation_id for the enqueued update")
    args = parser.parse_args()

    cfg = load_config(args.config)

    # Fast path: enqueue a contextual_update without opening a WebSocket
    if args.enqueue_update is not None:
        path = cfg.get("updates_queue_path") or "buffer/updates.ndjson"
        os.makedirs(os.path.dirname(path), exist_ok=True)
        record = {"text": args.enqueue_update}
        if args.conversation_id:
            record["conversation_id"] = args.conversation_id
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
        print(f"Enqueued contextual_update to {path}")
        return 0
    mem = load_memory_buffer(cfg)
    dyn_vars = to_string_map(mem)

    prompt_text = read_text(cfg.get("responder_template_path", "responder.md")) if cfg.get("prompt_override", True) else ""
    system_prompt = render_prompt(prompt_text, dyn_vars) if prompt_text else ""

    init_msg = build_init_client_data(cfg, system_prompt, dyn_vars)

    if args.dry:
        print(json.dumps({"wss": WSS_BASE, "init": init_msg}, indent=2, ensure_ascii=False))
        return 0

    asyncio.run(run_websocket(cfg, init_msg))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
