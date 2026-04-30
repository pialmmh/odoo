import logging

from odoo import models, fields, api
from odoo.exceptions import UserError

from .vault_client import VaultClient

_logger = logging.getLogger(__name__)

# Module-level cache to avoid reconnecting on every call
_vault_client_cache = {}


class InfraVaultConfig(models.Model):
    _name = 'infra.vault.config'
    _description = 'Vault/OpenBao Configuration'
    _order = 'id'

    name = fields.Char(string='Name', default='Default', required=True)
    vault_url = fields.Char(string='Vault URL', help='e.g. http://10.10.199.50:8200')
    vault_token = fields.Char(string='Vault Token', groups='base.group_system')
    vault_mount = fields.Char(string='KV Mount Point', default='secret')
    vault_namespace = fields.Char(string='Namespace', help='Enterprise/OpenBao namespace (optional)')
    vault_ssh_key_prefix = fields.Char(string='SSH Key Path Prefix', default='infra/ssh-keys',
        help='Path prefix for SSH keys in KV store, e.g. infra/ssh-keys')
    is_active = fields.Boolean(string='Active', default=True)
    last_health_check = fields.Text(string='Last Health Check', readonly=True)

    @api.model
    def get_active_config(self):
        """Return the active vault config record, or None."""
        config = self.search([('is_active', '=', True), ('vault_url', '!=', False)], limit=1)
        return config if config else None

    @api.model
    def get_client(self):
        """Return a connected VaultClient, or None if vault is not configured."""
        config = self.get_active_config()
        if not config or not config.vault_url or not config.vault_token:
            return None

        cache_key = f'{config.vault_url}:{config.vault_mount}'
        cached = _vault_client_cache.get(cache_key)
        if cached and cached.is_connected:
            return cached

        try:
            client = VaultClient(
                url=config.vault_url,
                token=config.vault_token,
                mount_point=config.vault_mount or 'secret',
                namespace=config.vault_namespace or None,
            )
            _vault_client_cache[cache_key] = client
            return client
        except Exception as e:
            _logger.error('Failed to connect to Vault at %s: %s', config.vault_url, e)
            return None

    @api.model
    def get_ssh_key_path(self, key_name):
        """Return the full vault path for an SSH key."""
        config = self.get_active_config()
        prefix = config.vault_ssh_key_prefix if config else 'infra/ssh-keys'
        return f'{prefix}/{key_name}'

    def action_test_connection(self):
        """Test the vault connection and store health status."""
        self.ensure_one()
        if not self.vault_url or not self.vault_token:
            raise UserError('Vault URL and token are required.')
        try:
            client = VaultClient(
                url=self.vault_url,
                token=self.vault_token,
                mount_point=self.vault_mount or 'secret',
                namespace=self.vault_namespace or None,
            )
            health = client.health()
            self.write({'last_health_check': str(health)})
            return health
        except Exception as e:
            self.write({'last_health_check': f'ERROR: {e}'})
            return {'error': str(e)}

    def action_migrate_keys_to_vault(self):
        """Migrate all locally-stored SSH keys to vault."""
        self.ensure_one()
        client = self.get_client()
        if not client:
            raise UserError('Vault is not connected.')

        keys = self.env['infra.ssh.key'].search([('key_storage', '=', 'local')])
        migrated = 0
        for key in keys:
            if not key.private_key:
                continue
            import base64
            private_pem = base64.b64decode(key.private_key).decode('utf-8', errors='replace')
            vault_path = self.get_ssh_key_path(key.name)
            client.store_secret(vault_path, {
                'private_key': private_pem,
                'public_key': key.public_key or '',
                'algorithm': key.algorithm,
                'fingerprint': key.fingerprint or '',
            })
            key.write({
                'key_storage': 'vault',
                'vault_path': vault_path,
                'private_key': False,  # Remove from DB
            })
            migrated += 1
            _logger.info('Migrated SSH key to vault: %s -> %s', key.name, vault_path)

        return {'migrated': migrated, 'total': len(keys)}
