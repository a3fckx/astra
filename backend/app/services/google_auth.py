"""
Google OAuth Service for Astra

What this does
- Provides a complete Google OAuth 2.0 flow implementation for authenticating users
  and fetching their profile data (name, email, date of birth).
- Handles authorization URL generation, authorization code exchange for tokens,
  token refresh, and profile data retrieval from Google People API.
- Optionally enables Gmail readonly access when configured.
- Supports DOB extraction which is critical for Astra's astrology features.

Why this exists
- Centralize OAuth configuration: environment variables override config.json for
  production flexibility without code changes.
- Enable astrology personalization: DOB from Google auth seeds birth charts,
  star signs, and transit predictions in MongoDB user context.
- Keep auth logic modular: FastAPI auth server can simply import and use this
  service without managing OAuth details.

Prerequisites
- Python 3.8+
- requests: pip install requests
- python-dotenv: pip install python-dotenv
- Google Cloud project with:
  - OAuth 2.0 credentials (Client ID, Client Secret)
  - People API enabled (for profile + birthday access)
  - Gmail API enabled (optional, for gmail.readonly scope)
  - OAuth consent screen configured with required scopes

Configuration Sources (priority order)
1. Environment variables (.env):
   - GOOGLE_CLIENT_ID (required)
   - GOOGLE_CLIENT_SECRET (required)
   - GOOGLE_REDIRECT_URI (required, e.g., http://localhost:8000/auth/google/callback)
   - GOOGLE_ENABLE_BIRTHDAY_SCOPE (default: true)
   - GOOGLE_ENABLE_GMAIL_READ_SCOPE (default: false)
   - GOOGLE_INCLUDE_GRANTED_SCOPES (default: true)
   - GOOGLE_ACCESS_TYPE (default: offline)
   - GOOGLE_PROMPT (default: consent)

2. config.json → google_auth:
   {
     "google_auth": {
       "client_id": "optional_if_env_set",
       "client_secret": "optional_if_env_set",
       "redirect_uri": "http://localhost:8000/auth/google/callback",
       "enable_birthday_scope": true,
       "enable_gmail_read_scope": false,
       "include_granted_scopes": true,
       "access_type": "offline",
       "prompt": "consent",
       "additional_scopes": []
     }
   }

Scopes Requested
- Base (always):
  - openid
  - https://www.googleapis.com/auth/userinfo.email
  - https://www.googleapis.com/auth/userinfo.profile
- Birthday (enabled by default):
  - https://www.googleapis.com/auth/user.birthday.read
- Gmail (disabled by default):
  - https://www.googleapis.com/auth/gmail.readonly

OAuth Flow
1. Generate authorization URL: authorization_url(state="random_state")
   - Redirects user to Google consent screen
2. User approves and Google redirects back with authorization code
3. Exchange code for tokens: exchange_code(code)
   - Returns: access_token, refresh_token, expires_in, token_type
4. Fetch user profile: fetch_user_profile(access_token)
   - Returns: {"name": str, "email": str, "birthday": str (YYYY-MM-DD or MM-DD)}
5. (Optional) Fetch Gmail profile: fetch_gmail_profile(access_token)
   - Returns: {"emailAddress": str, "messagesTotal": int, ...}
6. Refresh expired token: refresh_access_token(refresh_token)

Usage Example
    from services.google_auth_service import GoogleAuthService

    # Initialize (loads from .env + config.json)
    auth = GoogleAuthService()

    # Step 1: Generate authorization URL
    auth_url = auth.authorization_url(state="random_csrf_token")
    # Redirect user to auth_url

    # Step 2: Exchange authorization code (from callback) for tokens
    tokens = auth.exchange_code(code="authorization_code_from_google")
    access_token = tokens["access_token"]
    refresh_token = tokens.get("refresh_token")

    # Step 3: Fetch user profile (includes DOB if birthday scope enabled)
    profile = auth.fetch_user_profile(access_token)
    print(f"Name: {profile['name']}, DOB: {profile['birthday']}")

    # Step 4 (optional): Refresh expired token
    new_tokens = auth.refresh_access_token(refresh_token)

Notes
- Birthday scope requires Google People API enabled in Cloud project
- Gmail scope requires Gmail API enabled in Cloud project
- DOB format: "YYYY-MM-DD" if year available, "MM-DD" otherwise
- Tokens expire in ~1 hour; use refresh_token (valid for months) to get new access_token
- Environment variables always override config.json values

References
- Google OAuth 2.0: https://developers.google.com/identity/protocols/oauth2
- People API: https://developers.google.com/people/api/rest/v1/people/get
- Gmail API: https://developers.google.com/gmail/api/reference/rest
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from urllib.parse import urlencode

import requests
from dotenv import load_dotenv

load_dotenv()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
PEOPLE_ME_URL = "https://people.googleapis.com/v1/people/me"
GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile"
BASE_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
]
BIRTHDAY_SCOPE = "https://www.googleapis.com/auth/user.birthday.read"
GMAIL_READ_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"


def _load_config(path: str = "config.json") -> Dict[str, Dict[str, object]]:
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as stream:
        try:
            return json.load(stream)
        except json.JSONDecodeError:
            return {}


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class GoogleAuthSettings:
    """OAuth settings dataclass that loads from environment variables and config.json.

    Environment variables take precedence over config.json values.

    Attributes:
        client_id: Google OAuth 2.0 Client ID
        client_secret: Google OAuth 2.0 Client Secret
        redirect_uri: OAuth callback URL (e.g., http://localhost:8000/auth/google/callback)
        enable_birthday_scope: Enable People API birthday access (default: True)
        enable_gmail_read_scope: Enable Gmail readonly access (default: False)
        access_type: "offline" to get refresh token, "online" for short-lived access
        prompt: "consent" forces consent screen, "select_account" shows account picker
        include_granted_scopes: Enable incremental authorization
        additional_scopes: Custom scopes beyond base + birthday + gmail
    """

    client_id: str
    client_secret: str
    redirect_uri: str
    enable_birthday_scope: bool = True
    enable_gmail_read_scope: bool = False
    access_type: str = "offline"
    prompt: str = "consent"
    include_granted_scopes: bool = True
    additional_scopes: List[str] = field(default_factory=list)

    @classmethod
    def from_sources(cls, config_path: str = "config.json") -> "GoogleAuthSettings":
        """Load settings from environment variables and config.json.

        Priority: environment variables > config.json

        Args:
            config_path: Path to config.json file

        Returns:
            GoogleAuthSettings instance with resolved configuration

        Raises:
            RuntimeError: If required credentials (client_id, client_secret, redirect_uri) are missing
        """
        config = (
            _load_config(config_path).get("google_auth", {})
            if os.path.exists(config_path)
            else {}
        )
        client_id = os.getenv("GOOGLE_CLIENT_ID") or config.get("client_id")
        client_secret = os.getenv("GOOGLE_CLIENT_SECRET") or config.get("client_secret")
        redirect_uri = os.getenv("GOOGLE_REDIRECT_URI") or config.get("redirect_uri")
        if not client_id or not client_secret or not redirect_uri:
            missing = [
                name
                for name, value in (
                    ("GOOGLE_CLIENT_ID", client_id),
                    ("GOOGLE_CLIENT_SECRET", client_secret),
                    ("GOOGLE_REDIRECT_URI", redirect_uri),
                )
                if not value
            ]
            raise RuntimeError(
                "Missing Google OAuth configuration. Set env vars or provide google_auth entries: "
                + ", ".join(missing)
            )
        enable_birthday_scope = _env_bool(
            "GOOGLE_ENABLE_BIRTHDAY_SCOPE",
            bool(config.get("enable_birthday_scope", True)),
        )
        enable_gmail_read_scope = _env_bool(
            "GOOGLE_ENABLE_GMAIL_READ_SCOPE",
            bool(config.get("enable_gmail_read_scope", False)),
        )
        include_granted_scopes = _env_bool(
            "GOOGLE_INCLUDE_GRANTED_SCOPES",
            bool(config.get("include_granted_scopes", True)),
        )
        access_type = os.getenv(
            "GOOGLE_ACCESS_TYPE", str(config.get("access_type", "offline"))
        )
        prompt = os.getenv("GOOGLE_PROMPT", str(config.get("prompt", "consent")))
        configured_scopes = config.get("additional_scopes", []) or []
        additional_scopes = [
            scope for scope in configured_scopes if isinstance(scope, str)
        ]
        return cls(
            client_id=client_id,
            client_secret=client_secret,
            redirect_uri=redirect_uri,
            enable_birthday_scope=enable_birthday_scope,
            enable_gmail_read_scope=enable_gmail_read_scope,
            include_granted_scopes=include_granted_scopes,
            access_type=access_type,
            prompt=prompt,
            additional_scopes=additional_scopes,
        )


class GoogleAuthService:
    """Google OAuth 2.0 service for Astra.

    Handles complete OAuth flow: authorization URL generation, token exchange,
    profile fetching, and token refresh.

    Example:
        auth = GoogleAuthService()
        auth_url = auth.authorization_url(state="csrf_token")
        # ... user approves ...
        tokens = auth.exchange_code(code="auth_code")
        profile = auth.fetch_user_profile(tokens["access_token"])
    """

    def __init__(self, settings: Optional[GoogleAuthSettings] = None):
        """Initialize the Google Auth service.

        Args:
            settings: Optional GoogleAuthSettings. If None, loads from env/config.
        """
        self.settings = settings or GoogleAuthSettings.from_sources()

    def _scopes(self) -> List[str]:
        scopes = [*BASE_SCOPES]
        if self.settings.enable_birthday_scope:
            scopes.append(BIRTHDAY_SCOPE)
        if self.settings.enable_gmail_read_scope:
            scopes.append(GMAIL_READ_SCOPE)
        scopes.extend(self.settings.additional_scopes)
        return scopes

    def authorization_url(
        self,
        state: str,
        login_hint: Optional[str] = None,
        force_consent: bool = False,
        include_email_scope: bool = True,
    ) -> str:
        """Generate Google OAuth authorization URL.

        Args:
            state: CSRF protection token (verify this on callback)
            login_hint: Pre-fill email on Google consent screen
            force_consent: Force consent screen even if user previously approved
            include_email_scope: Include email scope (usually True)

        Returns:
            Full authorization URL to redirect user to Google consent screen
        """
        scopes = self._scopes()
        if not include_email_scope:
            scopes = [
                scope
                for scope in scopes
                if scope != "https://www.googleapis.com/auth/userinfo.email"
            ]
        params: Dict[str, str] = {
            "client_id": self.settings.client_id,
            "redirect_uri": self.settings.redirect_uri,
            "response_type": "code",
            "scope": " ".join(sorted(set(scopes))),
            "state": state,
            "access_type": self.settings.access_type,
        }
        if self.settings.include_granted_scopes:
            params["include_granted_scopes"] = "true"
        prompt = self.settings.prompt
        if force_consent:
            prompt = "consent"
        if prompt:
            params["prompt"] = prompt
        if login_hint:
            params["login_hint"] = login_hint
        return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    def exchange_code(self, code: str) -> Dict[str, object]:
        """Exchange authorization code for access and refresh tokens.

        Args:
            code: Authorization code from Google OAuth callback

        Returns:
            Dict with access_token, refresh_token (if access_type=offline),
            expires_in, token_type, scope

        Raises:
            requests.HTTPError: If token exchange fails
        """
        payload = {
            "code": code,
            "client_id": self.settings.client_id,
            "client_secret": self.settings.client_secret,
            "redirect_uri": self.settings.redirect_uri,
            "grant_type": "authorization_code",
        }
        response = requests.post(TOKEN_URL, data=payload, timeout=10)
        response.raise_for_status()
        return response.json()

    def refresh_access_token(self, refresh_token: str) -> Dict[str, object]:
        """Refresh an expired access token using refresh token.

        Args:
            refresh_token: Refresh token from initial authorization

        Returns:
            Dict with new access_token, expires_in, token_type, scope

        Raises:
            requests.HTTPError: If refresh fails (invalid or revoked token)
        """
        payload = {
            "refresh_token": refresh_token,
            "client_id": self.settings.client_id,
            "client_secret": self.settings.client_secret,
            "grant_type": "refresh_token",
        }
        response = requests.post(TOKEN_URL, data=payload, timeout=10)
        response.raise_for_status()
        return response.json()

    def fetch_user_profile(self, access_token: str) -> Dict[str, Optional[str]]:
        """Fetch user profile from Google People API.

        Requires birthday scope to be enabled for DOB extraction.

        Args:
            access_token: Valid OAuth access token

        Returns:
            Dict with keys:
                - name: Display name (str or None)
                - email: Email address (str or None)
                - birthday: DOB in YYYY-MM-DD or MM-DD format (str or None)

        Raises:
            requests.HTTPError: If API call fails
        """
        params = {
            "personFields": "names,emailAddresses,birthdays",
        }
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.get(
            PEOPLE_ME_URL, params=params, headers=headers, timeout=10
        )
        response.raise_for_status()
        data = response.json()
        primary_name = self._extract_primary(data.get("names", []), "displayName")
        primary_email = self._extract_primary(data.get("emailAddresses", []), "value")
        birthday = self._extract_birthday(data.get("birthdays", []))
        return {
            "name": primary_name,
            "email": primary_email,
            "birthday": birthday,
        }

    def fetch_gmail_profile(self, access_token: str) -> Dict[str, object]:
        """Fetch Gmail profile (email address, message counts).

        Requires gmail.readonly scope to be enabled.

        Args:
            access_token: Valid OAuth access token with Gmail scope

        Returns:
            Dict with emailAddress, messagesTotal, threadsTotal, historyId

        Raises:
            requests.HTTPError: If API call fails or scope not granted
        """
        headers = {"Authorization": f"Bearer {access_token}"}
        response = requests.get(GMAIL_PROFILE_URL, headers=headers, timeout=10)
        response.raise_for_status()
        return response.json()

    @staticmethod
    def _extract_primary(entries: List[Dict[str, object]], key: str) -> Optional[str]:
        for entry in entries:
            metadata = entry.get("metadata", {}) if isinstance(entry, dict) else {}
            if metadata.get("primary"):
                value = entry.get(key)
                return str(value) if value is not None else None
        if entries:
            value = entries[0].get(key)
            return str(value) if value is not None else None
        return None

    @staticmethod
    def _extract_birthday(entries: List[Dict[str, object]]) -> Optional[str]:
        for entry in entries:
            metadata = entry.get("metadata", {}) if isinstance(entry, dict) else {}
            if metadata.get("primary"):
                date = entry.get("date", {})
                return GoogleAuthService._format_birthdate(date)
        if entries:
            date = entries[0].get("date", {})
            return GoogleAuthService._format_birthdate(date)
        return None

    @staticmethod
    def _format_birthdate(date: Dict[str, object]) -> Optional[str]:
        year = date.get("year")
        month = date.get("month")
        day = date.get("day")
        if month and day:
            year_str = f"{int(year):04d}-" if year else ""
            return (
                f"{year_str}{int(month):02d}-{int(day):02d}"
                if year
                else f"{int(month):02d}-{int(day):02d}"
            )
        return None
