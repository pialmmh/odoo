import base64
import logging
import os
import subprocess
import tempfile

from odoo import models, fields, api
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

ALGORITHM_CHOICES = [
    ('ed25519', 'ED25519'),
    ('rsa2048', 'RSA 2048'),
    ('rsa4096', 'RSA 4096'),
    ('ecdsa256', 'ECDSA 256'),
    ('ecdsa384', 'ECDSA 384'),
]

ALGO_MAP = {
    'ed25519': ('-t', 'ed25519'),
    'rsa2048': ('-t', 'rsa', '-b', '2048'),
    'rsa4096': ('-t', 'rsa', '-b', '4096'),
    'ecdsa256': ('-t', 'ecdsa', '-b', '256'),
    'ecdsa384': ('-t', 'ecdsa', '-b', '384'),
}


class InfraSSHKey(models.Model):
    _name = 'infra.ssh.key'
    _description = 'SSH Key Pair'
    _order = 'name'

    name = fields.Char(string='Key Name', required=True, index=True)
    algorithm = fields.Selection(ALGORITHM_CHOICES, string='Algorithm', default='ed25519', required=True)
    comment = fields.Char(string='Comment')
    has_passphrase = fields.Boolean(string='Has Passphrase', default=False, readonly=True)

    # Storage backend
    key_storage = fields.Selection([
        ('local', 'Local (Odoo DB)'),
        ('vault', 'Vault/OpenBao'),
    ], string='Storage', default='local', required=True)

    # Local storage — private key in Odoo DB
    private_key = fields.Binary(string='Private Key', attachment=False, groups='base.group_system')

    # Vault storage — path reference only, no key in DB
    vault_path = fields.Char(string='Vault Path', readonly=True,
        help='Path in Vault KV store, e.g. infra/ssh-keys/my-key')

    public_key = fields.Text(string='Public Key')
    fingerprint = fields.Char(string='Fingerprint', readonly=True)

    created_date = fields.Datetime(string='Created', default=fields.Datetime.now, readonly=True)
    credential_ids = fields.One2many('infra.ssh.credential', 'key_id', string='Used By')
    credential_count = fields.Integer(string='Credentials', compute='_compute_credential_count')

    _sql_constraints = [
        ('name_uniq', 'unique(name)', 'SSH key name must be unique.'),
    ]

    def _compute_credential_count(self):
        for rec in self:
            rec.credential_count = len(rec.credential_ids)

    def _get_vault_client(self):
        """Get vault client, or None."""
        return self.env['infra.vault.config'].get_client()

    def _determine_storage(self):
        """Determine which storage backend to use for new keys."""
        vault = self._get_vault_client()
        return 'vault' if vault else 'local'

    @api.model
    def action_generate_key(self, name, algorithm='ed25519', comment='', passphrase=''):
        """Generate an SSH key pair. Auto-selects vault if configured, else local."""
        if not name:
            raise UserError('Key name is required.')

        existing = self.search([('name', '=', name)], limit=1)
        if existing:
            raise UserError(f'Key with name "{name}" already exists.')

        algo_args = ALGO_MAP.get(algorithm)
        if not algo_args:
            raise UserError(f'Unsupported algorithm: {algorithm}')

        # Generate key pair
        with tempfile.TemporaryDirectory() as tmpdir:
            key_path = os.path.join(tmpdir, 'key')
            cmd = ['ssh-keygen', *algo_args, '-f', key_path, '-C', comment or name, '-N', passphrase or '']

            try:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                if result.returncode != 0:
                    raise UserError(f'ssh-keygen failed: {result.stderr}')
            except FileNotFoundError:
                raise UserError('ssh-keygen not found on this system.')

            with open(key_path, 'rb') as f:
                private_key_data = f.read()
            with open(key_path + '.pub', 'r') as f:
                public_key_data = f.read().strip()

            fp_result = subprocess.run(
                ['ssh-keygen', '-lf', key_path + '.pub'],
                capture_output=True, text=True,
            )
            fingerprint = ''
            if fp_result.returncode == 0:
                parts = fp_result.stdout.strip().split()
                fingerprint = parts[1] if len(parts) > 1 else fp_result.stdout.strip()

        private_key_pem = private_key_data.decode('utf-8', errors='replace')

        # Determine storage backend
        vault = self._get_vault_client()
        if vault:
            vault_path = self.env['infra.vault.config'].get_ssh_key_path(name)
            vault.store_secret(vault_path, {
                'private_key': private_key_pem,
                'public_key': public_key_data,
                'algorithm': algorithm,
                'fingerprint': fingerprint,
                'comment': comment or name,
            })
            record = self.create({
                'name': name,
                'algorithm': algorithm,
                'comment': comment or name,
                'has_passphrase': bool(passphrase),
                'key_storage': 'vault',
                'vault_path': vault_path,
                'public_key': public_key_data,
                'fingerprint': fingerprint,
            })
            _logger.info('SSH key generated and stored in Vault: %s -> %s', name, vault_path)
        else:
            record = self.create({
                'name': name,
                'algorithm': algorithm,
                'comment': comment or name,
                'has_passphrase': bool(passphrase),
                'key_storage': 'local',
                'private_key': base64.b64encode(private_key_data),
                'public_key': public_key_data,
                'fingerprint': fingerprint,
            })
            _logger.info('SSH key generated and stored locally: %s', name)

        return {
            'id': record.id,
            'name': record.name,
            'algorithm': record.algorithm,
            'fingerprint': record.fingerprint,
            'public_key': record.public_key,
            'key_storage': record.key_storage,
        }

    def _get_private_key_pem(self):
        """Retrieve private key PEM from the appropriate backend."""
        self.ensure_one()

        if self.key_storage == 'vault':
            if not self.vault_path:
                raise UserError('Vault path not set for this key.')
            vault = self._get_vault_client()
            if not vault:
                raise UserError('Vault is not configured or not reachable.')
            data = vault.read_secret(self.vault_path)
            if not data or 'private_key' not in data:
                raise UserError(f'Private key not found in Vault at {self.vault_path}')
            return data['private_key']

        elif self.key_storage == 'local':
            if not self.private_key:
                raise UserError('No private key stored locally.')
            return base64.b64decode(self.private_key).decode('utf-8', errors='replace')

        else:
            raise UserError(f'Unknown key storage type: {self.key_storage}')

    def action_get_public_key(self):
        """Return the public key text."""
        self.ensure_one()
        return self.public_key or ''

    def action_get_private_key_pem(self):
        """Return the private key as text (admin only). Works for both local and vault."""
        self.ensure_one()
        return self._get_private_key_pem()

    def action_migrate_to_vault(self):
        """Migrate a single key from local to vault."""
        self.ensure_one()
        if self.key_storage != 'local':
            raise UserError('Key is already stored in vault.')
        if not self.private_key:
            raise UserError('No private key to migrate.')

        vault = self._get_vault_client()
        if not vault:
            raise UserError('Vault is not configured or not reachable.')

        private_pem = base64.b64decode(self.private_key).decode('utf-8', errors='replace')
        vault_path = self.env['infra.vault.config'].get_ssh_key_path(self.name)

        vault.store_secret(vault_path, {
            'private_key': private_pem,
            'public_key': self.public_key or '',
            'algorithm': self.algorithm,
            'fingerprint': self.fingerprint or '',
            'comment': self.comment or self.name,
        })

        self.write({
            'key_storage': 'vault',
            'vault_path': vault_path,
            'private_key': False,
        })

        _logger.info('SSH key migrated to vault: %s -> %s', self.name, vault_path)
        return {'success': True, 'vault_path': vault_path}

    def unlink(self):
        """Also delete from vault when removing the key record."""
        for rec in self:
            if rec.key_storage == 'vault' and rec.vault_path:
                vault = rec._get_vault_client()
                if vault:
                    vault.delete_secret(rec.vault_path)
        return super().unlink()
