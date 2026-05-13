# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Write-through cache from Odoo → Plane User row.

Called from EmailProvider after Odoo verifies the password. Either updates
the existing Plane row (cache refresh) or, on first login, prepares the data
dict that complete_login_or_signup() in the base adapter consumes to create
the new row."""

import logging
from typing import Optional

from plane.db.models import User

from .dto import OdooUserDTO

logger = logging.getLogger("plane.authentication")


def refresh_existing_plane_user(dto: OdooUserDTO) -> Optional[User]:
    """Find Plane user by email and update their cached fields from Odoo.

    Returns the User if it existed (and was refreshed); None if no Plane row
    exists yet (caller should let complete_login_or_signup create one)."""

    user = User.objects.filter(email=dto.email).first()
    if user is None:
        return None

    update_fields = []

    if dto.first_name and user.first_name != dto.first_name:
        user.first_name = dto.first_name
        update_fields.append("first_name")
    if dto.last_name and user.last_name != dto.last_name:
        user.last_name = dto.last_name
        update_fields.append("last_name")

    desired_display = dto.name.strip() if dto.name else ""
    if desired_display and user.display_name != desired_display:
        user.display_name = desired_display
        update_fields.append("display_name")

    if dto.avatar_url and user.avatar != dto.avatar_url:
        user.avatar = dto.avatar_url
        update_fields.append("avatar")

    # Make sure Plane's local password can never authenticate this user —
    # Odoo is now the only credential source.
    if user.has_usable_password():
        user.set_unusable_password()
        update_fields.append("password")

    if not user.is_email_verified:
        user.is_email_verified = True
        update_fields.append("is_email_verified")

    if update_fields:
        user.save(update_fields=update_fields)
        logger.info(
            "Refreshed Plane user %s from Odoo uid=%s (fields=%s)",
            user.email, dto.odoo_uid, update_fields,
        )

    return user


def user_data_for_create(dto: OdooUserDTO) -> dict:
    """Shape for set_user_data() consumed by complete_login_or_signup() to
    create a new Plane user. is_password_autoset=True is critical — it tells
    the base adapter to skip zxcvbn validation and assign a random local
    password (so the Plane-local password check can never succeed)."""
    return {
        "email": dto.email,
        "user": {
            "avatar": dto.avatar_url,
            "first_name": dto.first_name,
            "last_name": dto.last_name,
            "provider_id": str(dto.odoo_uid),
            # Tells base adapter to assign uuid4 password + email_verified=True.
            "is_password_autoset": True,
        },
    }
