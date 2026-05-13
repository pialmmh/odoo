# shellcheck shell=bash
#
# Mustache-style {{key}} substitution from CONF_* env vars.
# Source it; do not exec it.
#
# Usage:
#   render_template <template_file> <output_file>
#
# For every CONF_<UPPER>=value currently in the environment, replaces
# every occurrence of `{{<lower>}}` in the template with `value`.
# Uses pure bash parameter-expansion (no sed), so values containing
# `/`, `$`, `&`, etc. are inserted verbatim.

render_template() {
    local tmpl="$1" out="$2"

    if [ ! -f "$tmpl" ]; then
        echo "ERROR: template not found: $tmpl" >&2
        return 1
    fi

    local content key lc_key val placeholder
    content="$(cat "$tmpl")"

    while IFS='=' read -rd '' key val; do
        case "$key" in CONF_*) ;; *) continue ;; esac
        lc_key="${key#CONF_}"
        lc_key="${lc_key,,}"
        placeholder="{{${lc_key}}}"
        content="${content//${placeholder}/${val}}"
    done < <(env -0)

    mkdir -p "$(dirname "$out")"
    printf '%s\n' "$content" > "$out"

    # Sanity check: any `{{xxx}}` placeholders left unrendered?
    local leftovers
    leftovers="$(grep -oE '\{\{[a-z0-9_]+\}\}' "$out" | sort -u || true)"
    if [ -n "$leftovers" ]; then
        echo "WARN: unrendered placeholders in $out:" >&2
        printf '  %s\n' $leftovers >&2
    fi
}
