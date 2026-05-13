# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import os

from plane.db.models import Profile, Workspace, WorkspaceMember, WorkspaceMemberInvite

# Per-Odoo-DB tenancy means one Plane install == one Odoo company == one workspace.
# Hide Plane's workspace concept by funnelling every login through a single
# auto-provisioned workspace named in DEFAULT_WORKSPACE_SLUG.
DEFAULT_WORKSPACE_SLUG = "default"
DEFAULT_WORKSPACE_NAME = "Default"
ROLE_ADMIN = 20


def _ensure_default_workspace(user):
    workspace, _ = Workspace.objects.get_or_create(
        slug=DEFAULT_WORKSPACE_SLUG,
        defaults={"name": DEFAULT_WORKSPACE_NAME, "owner": user},
    )
    WorkspaceMember.objects.update_or_create(
        workspace=workspace,
        member=user,
        defaults={"role": ROLE_ADMIN, "is_active": True},
    )
    return workspace


def get_redirection_path(user):
    profile, _ = Profile.objects.get_or_create(user=user)

    # Odoo-backed tenancy: one workspace per install, no onboarding wizard.
    if os.environ.get("ODOO_AUTH_ENABLED", "0") == "1":
        workspace = _ensure_default_workspace(user)
        if not profile.is_onboarded or profile.last_workspace_id != workspace.id:
            profile.is_onboarded = True
            profile.last_workspace_id = workspace.id
            profile.save(update_fields=["is_onboarded", "last_workspace_id"])
        return workspace.slug

    # Redirect to onboarding if the user is not onboarded yet
    if not profile.is_onboarded:
        return "onboarding"

    # Redirect to the last workspace if the user has last workspace
    if (
        profile.last_workspace_id
        and Workspace.objects.filter(
            pk=profile.last_workspace_id,
            workspace_member__member_id=user.id,
            workspace_member__is_active=True,
        ).exists()
    ):
        workspace = Workspace.objects.filter(
            pk=profile.last_workspace_id,
            workspace_member__member_id=user.id,
            workspace_member__is_active=True,
        ).first()
        return f"{workspace.slug}"

    fallback_workspace = (
        Workspace.objects.filter(workspace_member__member_id=user.id, workspace_member__is_active=True)
        .order_by("created_at")
        .first()
    )
    # Redirect to fallback workspace
    if fallback_workspace:
        return f"{fallback_workspace.slug}"

    # Redirect to invitations if the user has unaccepted invitations
    if WorkspaceMemberInvite.objects.filter(email=user.email).count():
        return "invitations"

    # Redirect the user to create workspace
    return "create-workspace"
