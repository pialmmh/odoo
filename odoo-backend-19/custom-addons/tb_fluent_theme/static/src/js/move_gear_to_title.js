/** @odoo-module **/

import { registry } from "@web/core/registry";

// Move the breadcrumb's action-menu gear into the form's .oe_title
// (just before the favorite-star, if present; otherwise at the end
// of the title block). Pure CSS can't reparent DOM, hence this JS.
//
// Registered as a service to guarantee Odoo's loader instantiates
// it at app boot (a side-effect-only module wouldn't auto-start).

function moveGearOnce() {
    const controllers = document.querySelectorAll(
        ".o_view_controller.o_form_view"
    );
    for (const controller of controllers) {
        const title = controller.querySelector(".o_form_sheet .oe_title");
        if (!title) continue;

        // ── Gear (action menu) ────────────────────────────────────
        // Odoo 19: gear lives in `.o_cp_action_menus` inside the
        // breadcrumbs strip — a sibling of the breadcrumb item, not
        // inside it. Move it next to the favorite star (or, if there
        // is no star, at the end of the title block).
        const gear = controller.querySelector(
            ".o_control_panel_breadcrumbs .o_cp_action_menus button.o-dropdown.dropdown-toggle"
        );
        if (gear && !title.contains(gear)) {
            const star = title.querySelector(
                ".o_field_boolean_favorite, .o_priority"
            );
            gear.classList.add("tb-relocated-gear");
            if (star) {
                star.parentElement.insertBefore(gear, star);
            } else {
                title.appendChild(gear);
            }
        }

        // ── Avatar / record image (.oe_avatar) ────────────────────
        // Odoo applies float-right + a fixed avatar size, so the
        // image floats at the top-right of the form sheet OUTSIDE
        // .oe_title. With a slim header strip in place, this leaves
        // a tall blank gap above the title. Pull the avatar inside
        // .oe_title so it sits at the right edge of the header row.
        const avatar = controller.querySelector(
            ".o_form_sheet > .oe_avatar, .o_form_sheet > .o_field_widget.oe_avatar"
        );
        if (avatar && !title.contains(avatar)) {
            avatar.classList.add("tb-relocated-avatar");
            title.appendChild(avatar);
        }
    }
}

const moveGearService = {
    dependencies: [],
    start() {
        const tick = () => requestAnimationFrame(moveGearOnce);

        if (document.body) {
            const observer = new MutationObserver(tick);
            observer.observe(document.body, { childList: true, subtree: true });
            moveGearOnce();
        } else {
            document.addEventListener(
                "DOMContentLoaded",
                () => {
                    const observer = new MutationObserver(tick);
                    observer.observe(document.body, {
                        childList: true,
                        subtree: true,
                    });
                    moveGearOnce();
                },
                { once: true }
            );
        }
        return {};
    },
};

registry.category("services").add("tb_fluent_theme.move_gear", moveGearService);
