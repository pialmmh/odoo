# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Thin HTTP client for Odoo's web session API.

Only one endpoint is needed for auth: /web/session/authenticate. It accepts
{db, login, password} in JSON-RPC envelope and returns user info on success.
Failure surfaces as a `result: false` body or a non-200 status."""

import logging
import os
from typing import Optional

import requests

from .dto import OdooUserDTO

logger = logging.getLogger("plane.authentication")


class OdooConfig:
    """Reads ODOO_* env vars at call-time (not import-time) so changes don't
    require a restart of the api worker if the operator updates the env."""

    @staticmethod
    def is_enabled() -> bool:
        return os.environ.get("ODOO_AUTH_ENABLED", "0") == "1"

    @staticmethod
    def base_url() -> str:
        # From inside the api container, Odoo is reached via host.docker.internal
        # (or whatever the operator has set). No trailing slash.
        return os.environ.get("ODOO_BASE_URL", "http://host.docker.internal:7170").rstrip("/")

    @staticmethod
    def db() -> str:
        return os.environ.get("ODOO_DB", "")

    @staticmethod
    def http_timeout_s() -> float:
        try:
            return float(os.environ.get("ODOO_HTTP_TIMEOUT_S", "10"))
        except ValueError:
            return 10.0


class OdooClient:
    """Single-shot client used by the auth backend. Each call is a fresh
    requests.Session — we don't reuse cookies across logins because each
    login is for a different (browser) user."""

    def __init__(self) -> None:
        self.base_url = OdooConfig.base_url()
        self.db = OdooConfig.db()
        self.timeout = OdooConfig.http_timeout_s()

    def authenticate(self, login: str, password: str) -> Optional[OdooUserDTO]:
        """Verify (login, password) against Odoo. Returns DTO on success, None
        on rejection. Raises requests.RequestException for transport errors so
        the caller can distinguish 'wrong password' from 'Odoo unreachable'."""

        if not self.db:
            raise RuntimeError("ODOO_DB env var is not set; cannot authenticate")

        url = f"{self.base_url}/web/session/authenticate"
        payload = {
            "jsonrpc": "2.0",
            "method": "call",
            "params": {"db": self.db, "login": login, "password": password},
        }

        resp = requests.post(url, json=payload, timeout=self.timeout)
        resp.raise_for_status()
        body = resp.json() or {}

        # Odoo returns {jsonrpc, id, result: {...}} on success and
        # {jsonrpc, id, error: {...}} on transport-level errors. A WRONG
        # password is success-shaped with `result: {uid: false, ...}`.
        if "error" in body:
            err = body["error"]
            logger.warning("Odoo authenticate returned error: %s", err.get("message", err))
            return None

        result = body.get("result") or {}
        uid = result.get("uid")
        if not uid:
            # Bad credentials — Odoo signals this with uid=false / null.
            return None

        partner_id = result.get("partner_id") or 0
        avatar_url = (
            f"{self.base_url}/web/image/res.partner/{partner_id}/avatar_128"
            if partner_id
            else ""
        )

        return OdooUserDTO(
            odoo_uid=int(uid),
            email=str(result.get("username") or login).lower().strip(),
            name=str(result.get("name") or "").strip(),
            partner_id=int(partner_id) if partner_id else 0,
            avatar_url=avatar_url,
            is_admin=bool(result.get("is_admin")),
        )
