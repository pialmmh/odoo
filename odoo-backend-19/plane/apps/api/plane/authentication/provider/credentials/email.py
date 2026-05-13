# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import os

import requests

# Module imports
from plane.authentication.adapter.credential import CredentialAdapter
from plane.authentication.adapter.error import (
    AUTHENTICATION_ERROR_CODES,
    AuthenticationException,
)
from plane.authentication.odoo.client import OdooClient, OdooConfig
from plane.authentication.odoo.sync import (
    refresh_existing_plane_user,
    user_data_for_create,
)
from plane.db.models import User
from plane.license.utils.instance_value import get_configuration_value


class EmailProvider(CredentialAdapter):
    provider = "email"

    def __init__(self, request, key=None, code=None, is_signup=False, callback=None):
        super().__init__(request=request, provider=self.provider, callback=callback)
        self.key = key
        self.code = code
        self.is_signup = is_signup

        (ENABLE_EMAIL_PASSWORD,) = get_configuration_value([
            {
                "key": "ENABLE_EMAIL_PASSWORD",
                "default": os.environ.get("ENABLE_EMAIL_PASSWORD"),
            }
        ])

        if ENABLE_EMAIL_PASSWORD == "0":
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["EMAIL_PASSWORD_AUTHENTICATION_DISABLED"],
                error_message="EMAIL_PASSWORD_AUTHENTICATION_DISABLED",
            )

    def set_user_data(self):
        # ── Odoo-backed credentials path ────────────────────────────────────
        # When ODOO_AUTH_ENABLED=1, password verification is delegated to
        # Odoo's /web/session/authenticate. Plane's `User` row is a
        # write-through cache: refreshed on every login from Odoo's response.
        # Signups are blocked here — users are provisioned in Odoo only.
        if OdooConfig.is_enabled():
            self._set_user_data_via_odoo()
            return

        if self.is_signup:
            # Check if the user already exists
            if User.objects.filter(email=self.key).exists():
                self.logger.warning("User already exists")
                raise AuthenticationException(
                    error_message="USER_ALREADY_EXIST",
                    error_code=AUTHENTICATION_ERROR_CODES["USER_ALREADY_EXIST"],
                )

            super().set_user_data({
                "email": self.key,
                "user": {
                    "avatar": "",
                    "first_name": "",
                    "last_name": "",
                    "provider_id": "",
                    "is_password_autoset": False,
                },
            })
            return
        else:
            user = User.objects.filter(email=self.key).first()

            # User does not exists
            if not user:
                self.logger.warning("User does not exist")
                raise AuthenticationException(
                    error_message="USER_DOES_NOT_EXIST",
                    error_code=AUTHENTICATION_ERROR_CODES["USER_DOES_NOT_EXIST"],
                    payload={"email": self.key},
                )

            # Check user password
            if not user.check_password(self.code):
                self.logger.warning("Authentication failed - invalid credentials")
                raise AuthenticationException(
                    error_message=(
                        "AUTHENTICATION_FAILED_SIGN_UP" if self.is_signup else "AUTHENTICATION_FAILED_SIGN_IN"
                    ),
                    error_code=AUTHENTICATION_ERROR_CODES[
                        ("AUTHENTICATION_FAILED_SIGN_UP" if self.is_signup else "AUTHENTICATION_FAILED_SIGN_IN")
                    ],
                    payload={"email": self.key},
                )

            super().set_user_data({
                "email": self.key,
                "user": {
                    "avatar": "",
                    "first_name": "",
                    "last_name": "",
                    "provider_id": "",
                    "is_password_autoset": False,
                },
            })
            return

    def _set_user_data_via_odoo(self):
        """Odoo-backed credential check.

        Delegates password verification to Odoo's /web/session/authenticate
        and treats Plane's User row as a write-through cache.

        Signups are rejected — users must be provisioned in Odoo only.
        """
        if self.is_signup:
            self.logger.warning("Signup blocked: ODOO_AUTH_ENABLED=1, users are managed in Odoo")
            raise AuthenticationException(
                error_message="SIGNUP_DISABLED",
                error_code=AUTHENTICATION_ERROR_CODES["SIGNUP_DISABLED"],
                payload={"email": self.key},
            )

        client = OdooClient()
        try:
            dto = client.authenticate(self.key, self.code)
        except (requests.RequestException, RuntimeError) as exc:
            # Transport-level failure (network, DB misconfig). Don't fall
            # through to Plane local password — that would mask outages.
            self.logger.error("Odoo authenticate transport failure: %s", exc)
            raise AuthenticationException(
                error_message="AUTHENTICATION_FAILED_SIGN_IN",
                error_code=AUTHENTICATION_ERROR_CODES["AUTHENTICATION_FAILED_SIGN_IN"],
                payload={"email": self.key},
            )

        if dto is None:
            # Odoo rejected the credentials.
            self.logger.warning("Odoo rejected credentials for %s", self.key)
            raise AuthenticationException(
                error_message="AUTHENTICATION_FAILED_SIGN_IN",
                error_code=AUTHENTICATION_ERROR_CODES["AUTHENTICATION_FAILED_SIGN_IN"],
                payload={"email": self.key},
            )

        # Refresh existing Plane row from Odoo (write-through cache). If no
        # row yet (first login), let complete_login_or_signup() create it
        # from the dict we hand it next.
        refresh_existing_plane_user(dto)
        super().set_user_data(user_data_for_create(dto))
        return
