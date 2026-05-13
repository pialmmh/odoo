# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""DTO returned by OdooClient.authenticate() — the shape of an Odoo user as
seen by the rest of Plane. Decoupled from Odoo's raw response so the auth
backend doesn't need to know the wire format."""

from dataclasses import dataclass


@dataclass
class OdooUserDTO:
    odoo_uid: int
    """res.users.id — stable Odoo user id."""

    email: str
    """res.users.login — used as the join key on the Plane side."""

    name: str
    """res.partner.name — full display name. Split for first_name/last_name."""

    partner_id: int
    """res.users.partner_id — handy for fetching avatar/contact details."""

    avatar_url: str
    """Absolute URL to the user's 128px avatar (Odoo's /web/image/...)."""

    is_admin: bool
    """Mirror of Odoo's is_admin flag — informational; Plane has its own roles."""

    @property
    def first_name(self) -> str:
        return (self.name or "").split(" ", 1)[0] if self.name else ""

    @property
    def last_name(self) -> str:
        parts = (self.name or "").split(" ", 1)
        return parts[1] if len(parts) > 1 else ""
