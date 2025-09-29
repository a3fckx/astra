#!/usr/bin/env python3
"""Minimal ElevenLabs Agents runner using the official Python SDK with audio.

This script now mirrors the capabilities of the WebSocket runner while still
leaning on the official SDK for convenience:

1. Load config.json for API key and agent id.
2. Load buffer/memory_buffer.json and stringify values for dynamic variables.
3. Render responder.md (Jadugar prompt) with placeholders replaced.
4. Fetch a signed URL automatically (you no longer need to store it).
5. Start an ElevenLabs Conversation with a default audio interface so you can
   speak to the agent and hear its replies.

Usage (after installing dependencies):

  source .venv/bin/activate
  uv pip install elevenlabs pyaudio
  python3 scripts/minimal_sdk_runner.py

Press Ctrl+C to end the session.
"""

import json
import os
import signal
import logging
import re
from typing import Any, Dict
logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")


ENVIRONMENT_OVERRIDES = {
    "elevenlabs_api_key": "ELEVENLABS_API_KEY",
    "agent_id": "ELEVENLABS_AGENT_ID",
    "signed_url": "ELEVENLABS_SIGNED_URL",
    "voice_id": "ELEVENLABS_VOICE_ID",
    "language": "ELEVENLABS_AGENT_LANGUAGE",
    "user_id": "ELEVENLABS_USER_ID",
}


def apply_env_overrides(cfg: Dict[str, Any]) -> Dict[str, Any]:
    resolved = dict(cfg)
    for key, env_name in ENVIRONMENT_OVERRIDES.items():
        if env_name in os.environ:
            resolved[key] = os.environ.get(env_name)
    if "ELEVENLABS_AUTH_MODE" in os.environ:
        resolved["auth_mode"] = os.environ.get("ELEVENLABS_AUTH_MODE")
    return resolved

def load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def to_string_map(data: Dict[str, Any]) -> Dict[str, str]:
    result: Dict[str, str] = {}
    for key, value in data.items():
        if isinstance(value, (dict, list)):
            result[key] = json.dumps(value, ensure_ascii=False)
        elif value is None:
            result[key] = ""
        else:
            result[key] = str(value)
    return result


def render_prompt(template_path: str, variables: Dict[str, str]) -> str:
    if not template_path or not os.path.exists(template_path):
        return ""
    with open(template_path, "r", encoding="utf-8") as f:
        prompt = f.read()
    for key, value in variables.items():
        prompt = prompt.replace("{{" + key + "}}", value)
    prompt = re.sub(r"{{[^{}]+}}", "", prompt)
    return prompt


def main() -> int:
    cfg = apply_env_overrides(load_json("config.json"))
    mem = load_json(cfg.get("memory_buffer_source", {}).get("path", "buffer/memory_buffer.json"))
    dyn_vars = to_string_map(mem)

    system_prompt = ""
    if cfg.get("prompt_override", True):
        system_prompt = render_prompt(cfg.get("responder_template_path", "responder.md"), dyn_vars)

    api_key = os.getenv("ELEVENLABS_API_KEY") or cfg.get("elevenlabs_api_key")
    if not api_key:
        raise SystemExit("ELEVENLABS_API_KEY is missing (env or config)")

    try:
        from elevenlabs.client import ElevenLabs
        from elevenlabs.conversational_ai.conversation import Conversation, ConversationInitiationData
    except ModuleNotFoundError as exc:
        raise SystemExit(
            "The 'elevenlabs' package is required. Install it inside your virtualenv first."
        ) from exc

    client = ElevenLabs(api_key=api_key)

    initiation = ConversationInitiationData(
        dynamic_variables=dyn_vars,
        conversation_config_override={
            "agent": {
                "prompt": {"prompt": system_prompt} if system_prompt else None,
            }
        },
    )

    # Clean up None values that ConversationInitiationData doesn’t accept
    if initiation.conversation_config_override["agent"]["prompt"] is None:
        initiation.conversation_config_override["agent"].pop("prompt")
    if not initiation.conversation_config_override["agent"]:
        initiation.conversation_config_override = None

    agent_id = cfg.get("agent_id")
    if not agent_id:
        raise SystemExit("Provide agent_id in config.json")

    enable_playback = cfg.get("sdk_audio_playback", True)
    enable_capture = cfg.get("sdk_microphone_capture", False)

    audio_interface = None
    if enable_playback or enable_capture:
        try:
            from elevenlabs.conversational_ai.default_audio_interface import DefaultAudioInterface
        except ModuleNotFoundError as exc:
            raise SystemExit(
                "Audio interface requested but DefaultAudioInterface is unavailable. "
                "Install required audio packages (e.g., pyaudio)."
            ) from exc

        audio_interface = DefaultAudioInterface()
        logging.info(
            "Audio interface enabled via DefaultAudioInterface (playback=%s, capture=%s)",
            enable_playback,
            enable_capture,
        )
        if not (enable_playback and enable_capture):
            logging.info(
                "DefaultAudioInterface streams both directions; set sdk_audio_playback and "
                "sdk_microphone_capture to false for text-only mode."
            )
    else:
        logging.info("Audio interface disabled; conversation will be text-only")

    conversation = Conversation(
        client,
        agent_id,
        config=initiation,
        requires_auth=bool(api_key),
        audio_interface=audio_interface,
        callback_user_transcript=lambda text: print(f"[user] {text}"),
        callback_agent_response=lambda text: print(f"[agent] {text}"),
    )

    def handle_exit(signum, frame):
        print("\nEnding session…")
        conversation.end_session()
        raise SystemExit(0)

    signal.signal(signal.SIGINT, handle_exit)

    conversation.start_session()

    # Keep the script alive; the SDK handles the event loop internally.
    signal.pause()


if __name__ == "__main__":
    raise SystemExit(main())
