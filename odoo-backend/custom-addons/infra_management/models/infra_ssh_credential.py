import base64
import io
import logging
import tempfile
import os

from odoo import models, fields, api
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

SERVER_TYPES = [
    ('linux', 'Linux'),
    ('mikrotik', 'MikroTik'),
    ('cisco', 'Cisco'),
    ('generic', 'Generic'),
]

DEPLOY_STATUS = [
    ('pending', 'Pending'),
    ('deployed', 'Deployed'),
    ('failed', 'Failed'),
    ('verified', 'Verified'),
]


class InfraSSHCredential(models.Model):
    _name = 'infra.ssh.credential'
    _description = 'SSH Server Credential'
    _order = 'name'

    name = fields.Char(string='Name', required=True, index=True)
    host = fields.Char(string='Host', required=True, help='IP address or hostname')
    port = fields.Integer(string='SSH Port', default=22, required=True)
    username = fields.Char(string='Username', required=True)
    server_type = fields.Selection(SERVER_TYPES, string='Server Type', default='linux', required=True)
    sudo_enabled = fields.Boolean(string='Sudo Enabled', default=False)
    description = fields.Text(string='Description')
    tags = fields.Char(string='Tags', help='Comma-separated tags')

    key_id = fields.Many2one('infra.ssh.key', string='SSH Key', index=True, ondelete='set null')
    deploy_status = fields.Selection(DEPLOY_STATUS, string='Key Deploy Status', default='pending')
    last_deploy_date = fields.Datetime(string='Last Deploy')
    last_verified_date = fields.Datetime(string='Last Verified')
    deploy_log = fields.Text(string='Deploy Log')

    # Polymorphic link to infra entities
    compute_id = fields.Many2one('infra.compute', string='Compute', index=True, ondelete='cascade')
    network_device_id = fields.Many2one('infra.network.device', string='Network Device', index=True, ondelete='cascade')

    linked_entity = fields.Char(string='Linked To', compute='_compute_linked_entity')

    @api.depends('compute_id', 'network_device_id')
    def _compute_linked_entity(self):
        for rec in self:
            if rec.compute_id:
                rec.linked_entity = f"Compute: {rec.compute_id.name}"
            elif rec.network_device_id:
                rec.linked_entity = f"Device: {rec.network_device_id.name}"
            else:
                rec.linked_entity = 'Standalone'

    def _get_private_key_path(self):
        """Write private key to a temp file and return path. Caller must clean up.
        Works with both local and vault-stored keys."""
        self.ensure_one()
        if not self.key_id:
            raise UserError('No SSH key assigned.')
        key_pem = self.key_id._get_private_key_pem()
        fd, path = tempfile.mkstemp(prefix='ssh_key_', suffix='.pem')
        with os.fdopen(fd, 'wb') as f:
            f.write(key_pem.encode('utf-8'))
        os.chmod(path, 0o600)
        return path

    def action_deploy_key(self):
        """Deploy the assigned SSH public key to the remote server."""
        self.ensure_one()
        if not self.key_id:
            raise UserError('No SSH key assigned.')
        if not self.key_id.public_key:
            raise UserError('SSH key has no public key.')

        try:
            import paramiko
        except ImportError:
            raise UserError('paramiko library not installed on server.')

        public_key = self.key_id.public_key.strip()
        log_lines = []

        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

            # For initial deploy we need password — stored temporarily in context
            password = self.env.context.get('ssh_password')
            if not password:
                raise UserError('Password required for initial key deployment. Pass via context.')

            log_lines.append(f"Connecting to {self.username}@{self.host}:{self.port}...")
            client.connect(
                hostname=self.host,
                port=self.port,
                username=self.username,
                password=password,
                timeout=15,
                look_for_keys=False,
                allow_agent=False,
            )
            log_lines.append("Connected with password auth.")

            if self.server_type == 'mikrotik':
                # MikroTik: upload via SFTP then import
                sftp = client.open_sftp()
                remote_file = f'{self.key_id.name}.pub'
                with sftp.open(remote_file, 'w') as f:
                    f.write(public_key + '\n')
                sftp.close()
                log_lines.append(f"Uploaded public key as {remote_file}")

                cmd = f'/user ssh-keys import public-key-file={remote_file} user={self.username}'
                stdin, stdout, stderr = client.exec_command(cmd)
                out = stdout.read().decode()
                err = stderr.read().decode()
                log_lines.append(f"Import command: {cmd}")
                if out:
                    log_lines.append(f"Output: {out}")
                if err:
                    log_lines.append(f"Stderr: {err}")
            else:
                # Linux: append to authorized_keys
                commands = [
                    'mkdir -p ~/.ssh',
                    'chmod 700 ~/.ssh',
                    'touch ~/.ssh/authorized_keys',
                    'chmod 600 ~/.ssh/authorized_keys',
                ]
                for cmd in commands:
                    client.exec_command(cmd)

                # Check if key already exists
                stdin, stdout, stderr = client.exec_command('cat ~/.ssh/authorized_keys')
                existing = stdout.read().decode()
                if public_key in existing:
                    log_lines.append("Public key already in authorized_keys.")
                else:
                    escaped_key = public_key.replace('"', '\\"')
                    cmd = f'echo "{escaped_key}" >> ~/.ssh/authorized_keys'
                    client.exec_command(cmd)
                    log_lines.append("Public key appended to authorized_keys.")

            client.close()
            self.write({
                'deploy_status': 'deployed',
                'last_deploy_date': fields.Datetime.now(),
                'deploy_log': '\n'.join(log_lines),
            })
            _logger.info('SSH key deployed to %s@%s', self.username, self.host)
            return {'success': True, 'log': '\n'.join(log_lines)}

        except Exception as e:
            log_lines.append(f"ERROR: {e}")
            self.write({
                'deploy_status': 'failed',
                'deploy_log': '\n'.join(log_lines),
            })
            _logger.error('SSH key deploy failed for %s@%s: %s', self.username, self.host, e)
            return {'success': False, 'log': '\n'.join(log_lines)}

    def action_verify_key(self):
        """Verify that key-based auth works."""
        self.ensure_one()
        if not self.key_id or not self.key_id.private_key:
            raise UserError('No SSH key assigned.')

        try:
            import paramiko
        except ImportError:
            raise UserError('paramiko library not installed on server.')

        key_path = self._get_private_key_path()
        log_lines = []

        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

            log_lines.append(f"Verifying key auth to {self.username}@{self.host}:{self.port}...")
            client.connect(
                hostname=self.host,
                port=self.port,
                username=self.username,
                key_filename=key_path,
                timeout=15,
                look_for_keys=False,
                allow_agent=False,
            )

            stdin, stdout, stderr = client.exec_command('echo key-auth-ok')
            result = stdout.read().decode().strip()
            client.close()

            if result == 'key-auth-ok':
                log_lines.append("Key authentication verified successfully.")
                self.write({
                    'deploy_status': 'verified',
                    'last_verified_date': fields.Datetime.now(),
                    'deploy_log': '\n'.join(log_lines),
                })
                return {'success': True, 'log': '\n'.join(log_lines)}
            else:
                log_lines.append(f"Unexpected response: {result}")
                self.write({'deploy_log': '\n'.join(log_lines)})
                return {'success': False, 'log': '\n'.join(log_lines)}

        except Exception as e:
            log_lines.append(f"Verification failed: {e}")
            self.write({
                'deploy_status': 'failed',
                'deploy_log': '\n'.join(log_lines),
            })
            return {'success': False, 'log': '\n'.join(log_lines)}
        finally:
            os.unlink(key_path)

    def action_exec_command(self, command):
        """Execute a command on the remote server using key auth."""
        self.ensure_one()
        if not self.key_id or not self.key_id.private_key:
            raise UserError('No SSH key assigned.')

        try:
            import paramiko
        except ImportError:
            raise UserError('paramiko library not installed on server.')

        key_path = self._get_private_key_path()

        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            client.connect(
                hostname=self.host,
                port=self.port,
                username=self.username,
                key_filename=key_path,
                timeout=15,
                look_for_keys=False,
                allow_agent=False,
            )

            stdin, stdout, stderr = client.exec_command(command, timeout=30)
            out = stdout.read().decode()
            err = stderr.read().decode()
            exit_code = stdout.channel.recv_exit_status()
            client.close()

            return {
                'exit_code': exit_code,
                'stdout': out,
                'stderr': err,
            }
        except Exception as e:
            return {'exit_code': -1, 'stdout': '', 'stderr': str(e)}
        finally:
            os.unlink(key_path)

    def action_generate_setup_script(self):
        """Generate a shell script for developers to configure SSH access on their local machine."""
        self.ensure_one()
        key_name = self.key_id.name if self.key_id else 'id_ed25519'
        alias = self.name.replace('-ssh', '') if self.name.endswith('-ssh') else self.name
        compute_name = self.compute_id.name if self.compute_id else alias

        script = f"""#!/bin/bash
# ─────────────────────────────────────────────────────
# SSH Setup Script — {compute_name}
# Generated by Telcobright Platform
# Run on your local machine: bash {alias}-ssh-setup.sh
# ─────────────────────────────────────────────────────

KEY_NAME="{key_name}"
KEY_PATH="$HOME/.ssh/$KEY_NAME"
HOST="{self.host}"
PORT="{self.port}"
USER="{self.username}"
ALIAS="{alias}"

echo ""
echo "Setting up SSH access to: $ALIAS ($USER@$HOST:$PORT)"
echo ""

# 1. Ensure .ssh directory
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

# 2. Private key
if [ ! -f "$KEY_PATH" ]; then
    echo "Private key not found at $KEY_PATH"
    echo ""
    echo "Option A: Download from Platform UI (SSH Keys > $KEY_NAME > Download)"
    echo "          and save to: $KEY_PATH"
    echo ""
    echo "Option B: Paste the private key now (press Ctrl+D when done):"
    echo ""
    read -p "Paste key now? (y/n): " PASTE
    if [ "$PASTE" = "y" ]; then
        cat > "$KEY_PATH"
        chmod 600 "$KEY_PATH"
        echo ""
        echo "Key saved to $KEY_PATH"
    else
        echo "Please save the key to $KEY_PATH manually, then re-run this script."
        exit 1
    fi
else
    echo "Key already exists: $KEY_PATH"
fi

chmod 600 "$KEY_PATH"

# 3. SSH config entry
touch "$HOME/.ssh/config"
chmod 600 "$HOME/.ssh/config"

if grep -q "^Host $ALIAS$" "$HOME/.ssh/config" 2>/dev/null; then
    echo "SSH config entry '$ALIAS' already exists — skipping"
else
    cat >> "$HOME/.ssh/config" <<SSHEOF

# {compute_name} — Telcobright Platform
Host $ALIAS
    HostName $HOST
    Port $PORT
    User $USER
    IdentityFile $KEY_PATH
    StrictHostKeyChecking no
    ServerAliveInterval 60
SSHEOF
    echo "Added SSH config entry: $ALIAS"
fi

echo ""
echo "─────────────────────────────────────────"
echo "Setup complete. Connect with:"
echo ""
echo "  ssh $ALIAS"
echo ""
echo "Or manually:"
echo "  ssh -i $KEY_PATH -p $PORT $USER@$HOST"
echo "─────────────────────────────────────────"
"""
        return {
            'script': script,
            'filename': f'{alias}-ssh-setup.sh',
            'alias': alias,
            'host': self.host,
            'port': self.port,
            'username': self.username,
            'key_name': key_name,
        }

    @api.model
    def action_setup_ssh_for_compute(self, compute_id, key_id, temp_username, temp_password):
        """Combined action: create credential, deploy key, return setup script.
        Called from the compute detail pane UI."""
        compute = self.env['infra.compute'].browse(compute_id)
        key = self.env['infra.ssh.key'].browse(key_id)

        if not compute.exists():
            raise UserError('Compute not found.')
        if not key.exists():
            raise UserError('SSH key not found.')
        if not key.public_key:
            raise UserError('SSH key has no public key.')

        host = compute.management_ip
        if not host:
            raise UserError('Compute has no management IP configured.')

        # Create or find existing credential
        cred_name = f'{compute.name}-ssh'
        existing = self.search([('name', '=', cred_name)], limit=1)
        if existing:
            cred = existing
            cred.write({'key_id': key_id})
        else:
            cred = self.create({
                'name': cred_name,
                'host': host,
                'port': 22,
                'username': temp_username,
                'server_type': 'linux',
                'key_id': key_id,
                'compute_id': compute_id,
                'deploy_status': 'pending',
                'tags': 'auto-setup',
            })

        # Deploy key using temp password
        deploy_result = cred.with_context(ssh_password=temp_password).action_deploy_key()

        # Generate setup script
        script_result = cred.action_generate_setup_script()

        return {
            'credential_id': cred.id,
            'deploy_success': deploy_result.get('success', False),
            'deploy_log': deploy_result.get('log', ''),
            'script': script_result.get('script', ''),
            'filename': script_result.get('filename', ''),
        }
