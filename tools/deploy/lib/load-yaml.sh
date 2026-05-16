# shellcheck shell=bash
#
# YAML profile loader. Source it; do not exec it.
#
# Usage:
#   load_yaml_into_env <yaml_file> <prefix>
#       Reads every top-level key in the YAML file and exports it as
#       ${prefix}<UPPER_KEY>=<value>. Nested keys are not supported on
#       purpose — keep operator YAML flat so templates' {{key}} placeholders
#       stay readable.
#
# Requires python3 with PyYAML. Both are available out-of-the-box on the
# dev box and on Debian 12 LXC base images.

load_yaml_into_env() {
    local file="$1" prefix="${2:-}"

    if [ ! -f "$file" ]; then
        echo "ERROR: yaml file not found: $file" >&2
        return 1
    fi

    # Read YAML, emit one KEY=VALUE per line with NUL separator so values
    # with newlines or `=` survive. Eval each into the shell with `export`.
    while IFS= read -rd '' line; do
        local key="${line%%=*}"
        local val="${line#*=}"
        local up
        up="$(echo "$key" | tr '[:lower:]' '[:upper:]' | tr -c 'A-Z0-9_\n' '_')"
        # shellcheck disable=SC2163
        export "${prefix}${up}=${val}"
    done < <(python3 - "$file" <<'PYEOF'
import sys, yaml
with open(sys.argv[1]) as fh:
    data = yaml.safe_load(fh) or {}
if not isinstance(data, dict):
    sys.exit("ERROR: top-level of %s must be a mapping" % sys.argv[1])
for k, v in data.items():
    if isinstance(v, (dict, list)):
        sys.exit("ERROR: nested key '%s' not supported — flatten the YAML" % k)
    if v is None:
        v = ""
    if isinstance(v, bool):
        v = "True" if v else "False"
    sys.stdout.write(f"{k}={v}\0")
PYEOF
)
}

# List available profiles for an operator: scans operators/<op>/*.yml
list_yaml_profiles() {
    local op_dir="$1"
    if [ ! -d "$op_dir" ]; then
        return 0
    fi
    ls -1 "$op_dir"/*.yml 2>/dev/null | xargs -n1 -r basename | sed 's/\.yml$//'
}
