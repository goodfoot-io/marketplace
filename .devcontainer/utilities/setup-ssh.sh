#!/bin/bash
# Rootless per-container sshd launcher + paste-in script generator.
# Idempotent: keys, port, and authorized_keys persist across re-runs so an
# already-distributed connect-to-marketplace-devcontainer.sh keeps working.

set -euo pipefail

USER="${USER:-$(id -un)}"
SSH_DIR="$HOME/.ssh"
RUN_DIR="$SSH_DIR/run"
HOST_KEY="$SSH_DIR/ssh_host_ed25519_key"
PEER_KEY="$SSH_DIR/id_ed25519_peer"
AUTH_KEYS="$SSH_DIR/authorized_keys"
SSHD_CONFIG="$SSH_DIR/sshd_config"
PORT_FILE="$RUN_DIR/sshd.port"
PID_FILE="$RUN_DIR/sshd.pid"
LOG_FILE="$RUN_DIR/sshd.log"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT_DIR="$REPO_ROOT/scripts/ssh"
OUT_SCRIPT="$OUT_DIR/connect-to-marketplace-devcontainer.sh"

mkdir -p "$SSH_DIR" "$RUN_DIR" "$OUT_DIR"
chmod 700 "$SSH_DIR" "$RUN_DIR"

# 1. Host key (sshd identity) — generate once, reuse.
if [ ! -f "$HOST_KEY" ]; then
    ssh-keygen -q -t ed25519 -N "" -f "$HOST_KEY" -C "devcontainer-host-$(hostname)"
fi
chmod 600 "$HOST_KEY"
chmod 644 "$HOST_KEY.pub"

# 2. Peer keypair (peers use this to log in here).
if [ ! -f "$PEER_KEY" ]; then
    ssh-keygen -q -t ed25519 -N "" -f "$PEER_KEY" -C "devcontainer-peer-$(hostname)"
fi
chmod 600 "$PEER_KEY"
chmod 644 "$PEER_KEY.pub"

# 3. Authorize the peer key for incoming logins.
touch "$AUTH_KEYS"
chmod 600 "$AUTH_KEYS"
PEER_PUB_LINE="$(cat "$PEER_KEY.pub")"
if ! grep -qxF "$PEER_PUB_LINE" "$AUTH_KEYS"; then
    echo "$PEER_PUB_LINE" >> "$AUTH_KEYS"
fi

# 4. Pick (or reuse) a free high port.
if [ -f "$PORT_FILE" ]; then
    PORT="$(cat "$PORT_FILE")"
else
    PORT="$(python3 -c 'import socket; s=socket.socket(); s.bind(("0.0.0.0",0)); print(s.getsockname()[1]); s.close()')"
    echo "$PORT" > "$PORT_FILE"
fi

# 5. Write a minimal user-owned sshd_config.
cat > "$SSHD_CONFIG" <<EOF
Port $PORT
ListenAddress 0.0.0.0
HostKey $HOST_KEY
PidFile $PID_FILE
AuthorizedKeysFile $AUTH_KEYS
PasswordAuthentication no
ChallengeResponseAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
UsePAM no
PermitRootLogin no
StrictModes yes
PrintMotd no
AcceptEnv LANG LC_*
Subsystem sftp /usr/lib/openssh/sftp-server
EOF
chmod 600 "$SSHD_CONFIG"

# 6. Restart sshd if not running on the recorded port.
need_start=1
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    if ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$PORT\$"; then
        need_start=0
    else
        kill "$(cat "$PID_FILE")" 2>/dev/null || true
        sleep 1
    fi
fi

if [ "$need_start" = "1" ]; then
    : > "$LOG_FILE"
    /usr/sbin/sshd -f "$SSHD_CONFIG" -E "$LOG_FILE"
fi

# 7. Detect host LAN IP (works under host networking).
HOST_IP=""
if command -v ip >/dev/null 2>&1; then
    HOST_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}' || true)"
fi
if [ -z "${HOST_IP:-}" ]; then
    HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
fi
if [ -z "${HOST_IP:-}" ]; then
    HOST_IP="127.0.0.1"
fi

ALIAS="devcontainer-marketplace"
HOST_PUB="$(cat "$HOST_KEY.pub")"
PEER_PRIV="$(cat "$PEER_KEY")"

# 8. Emit the paste-in script for peers.
umask 077
cat > "$OUT_SCRIPT" <<EOF
#!/bin/bash
# Paste-in script: configures the running container to ssh into
# $ALIAS at $HOST_IP:$PORT as user '$USER'.
set -euo pipefail

mkdir -p "\$HOME/.ssh"
chmod 700 "\$HOME/.ssh"

KEY_FILE="\$HOME/.ssh/id_ed25519_${ALIAS}"
cat > "\$KEY_FILE" <<'PRIVKEY'
$PEER_PRIV
PRIVKEY
chmod 600 "\$KEY_FILE"

# Pin the host key in the user's default known_hosts.
KNOWN="\$HOME/.ssh/known_hosts"
touch "\$KNOWN"
chmod 600 "\$KNOWN"
HOST_LINE="[$HOST_IP]:$PORT $HOST_PUB"
ssh-keygen -R "[$HOST_IP]:$PORT" -f "\$KNOWN" >/dev/null 2>&1 || true
echo "\$HOST_LINE" >> "\$KNOWN"

# Add Host alias to ~/.ssh/config (replace any prior block for this alias).
CFG="\$HOME/.ssh/config"
touch "\$CFG"
chmod 600 "\$CFG"
python3 - "\$CFG" "$ALIAS" "$HOST_IP" "$PORT" "\$KEY_FILE" <<'PYEOF'
import sys, re
cfg_path, alias, host, port, keyfile = sys.argv[1:]
try:
    with open(cfg_path) as f:
        text = f.read()
except FileNotFoundError:
    text = ""
pattern = re.compile(
    r"(?ms)^Host\s+" + re.escape(alias) + r"\s*\n(?:[ \t].*\n?)*"
)
text = pattern.sub("", text)
if text and not text.endswith("\n"):
    text += "\n"
text += (
    f"Host {alias}\n"
    f"    HostName {host}\n"
    f"    Port {port}\n"
    f"    User $USER\n"
    f"    IdentityFile {keyfile}\n"
    f"    IdentitiesOnly yes\n"
    f"    StrictHostKeyChecking yes\n"
)
with open(cfg_path, "w") as f:
    f.write(text)
PYEOF

echo "Configured: ssh $ALIAS  ->  $USER@$HOST_IP:$PORT"
EOF
chmod +x "$OUT_SCRIPT"

echo "sshd listening on $HOST_IP:$PORT (alias '$ALIAS')"
echo "paste-in script: $OUT_SCRIPT"
