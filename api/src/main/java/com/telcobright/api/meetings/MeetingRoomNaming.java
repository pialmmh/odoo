package com.telcobright.api.meetings;

/**
 * Canonical LiveKit room-naming helper. Centralises the pattern so any code
 * that needs to identify a room for a given meeting + tenant uses the exact
 * same string. Keeping this pure (no Spring, no deps) lets it be inlined into
 * controllers, services and tests.
 *
 * Shape: {@code meeting-<tenant>-<meetingId>} when tenant is present,
 * otherwise {@code meeting-<meetingId>} (backwards-compatible with the
 * original MeetingsController behaviour).
 */
public final class MeetingRoomNaming {
    private MeetingRoomNaming() {}

    public static String roomName(String tenantSlug, String meetingId) {
        if (tenantSlug == null || tenantSlug.isBlank()) {
            return "meeting-" + meetingId;
        }
        return "meeting-" + tenantSlug.trim().toLowerCase() + "-" + meetingId;
    }

    /** Tenant subdir under recordings dir — empty string when no tenant. */
    public static String tenantPathSegment(String tenantSlug) {
        return (tenantSlug == null || tenantSlug.isBlank())
                ? ""
                : tenantSlug.trim().toLowerCase();
    }
}
