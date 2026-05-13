# shellcheck shell=bash
#
# INI-style conf parser. Source it; do not exec it.
#
# Usage:
#   parse_conf <file> <section> <key>      → prints value, empty if missing
#   list_sections <file>                    → prints section names, one per line
#   load_section_into_env <file> <section> <prefix>
#       Reads every key in [section] and exports it as ${PREFIX}<UPPER_KEY>.
#       Lifts the awk pattern out of routesphere remote-deploy-v2.sh.

parse_conf() {
    local file="$1" section="$2" key="$3"
    awk -v section="[$section]" -v key="$key" '
        $0 == section { in_section=1; next }
        /^\[/        { in_section=0 }
        in_section {
            line = $0
            gsub(/^[ \t]+/, "", line)
            if (line ~ "^" key "[ \t]*=") {
                idx = index($0, "=")
                if (idx > 0) {
                    value = substr($0, idx + 1)
                    gsub(/^[ \t]+|[ \t]+$/, "", value)
                    print value
                }
                exit
            }
        }
    ' "$file"
}

list_sections() {
    local file="$1"
    grep -E '^\[' "$file" | tr -d '[]'
}

load_section_into_env() {
    local file="$1" section="$2" prefix="${3:-}"
    while IFS= read -r line; do
        # uppercase, strip non-alnum, prefix
        local up
        up="$(echo "$line" | tr '[:lower:]' '[:upper:]' | tr -c 'A-Z0-9_\n' '_')"
        local val
        val="$(parse_conf "$file" "$section" "$line")"
        # shellcheck disable=SC2163
        export "${prefix}${up}=${val}"
    done < <(awk -v section="[$section]" '
        $0 == section { in_section=1; next }
        /^\[/        { in_section=0 }
        in_section {
            line = $0
            sub(/#.*/, "", line)
            gsub(/^[ \t]+|[ \t]+$/, "", line)
            if (line == "") next
            idx = index(line, "=")
            if (idx > 0) {
                key = substr(line, 1, idx - 1)
                gsub(/[ \t]+$/, "", key)
                print key
            }
        }
    ' "$file")
}
