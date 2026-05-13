# shellcheck shell=bash
#
# SSH/rsync helpers. Source it; do not exec it.
#
# Expects (from deploy.sh):
#   SSH_HOST, SSH_PORT, SSH_USER, SSH_KEY     — resolved from inventory
#   SSH_TARGET = "${SSH_USER}@${SSH_HOST}"

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=10)

ssh_run() {
    # ssh_run "<remote command>"
    ssh -i "$SSH_KEY" -p "$SSH_PORT" "${SSH_OPTS[@]}" "$SSH_TARGET" "$@"
}

rsync_to() {
    # rsync_to <local> <remote>
    local src="$1" dst="$2"
    rsync -az --delete \
          -e "ssh -i $SSH_KEY -p $SSH_PORT ${SSH_OPTS[*]}" \
          "$src" "${SSH_TARGET}:${dst}"
}

scp_to() {
    # scp_to <local> <remote>
    local src="$1" dst="$2"
    scp -i "$SSH_KEY" -P "$SSH_PORT" "${SSH_OPTS[@]}" "$src" "${SSH_TARGET}:${dst}"
}

dry_or_run() {
    # If $DRY_RUN is "true", print the command instead of running it.
    if [ "${DRY_RUN:-false}" = "true" ]; then
        echo "[dry-run] $*"
    else
        eval "$@"
    fi
}
