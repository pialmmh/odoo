"""
Vault/OpenBao client utility for secret management.

Supports KV v2 secrets engine. Vault connection is configured via
infra.vault.config singleton (stored in res.config.settings).

Usage from other models:
    vault = self.env['infra.vault.config'].get_client()
    if vault:
        vault.store_secret('ssh-keys/my-key', {'private_key': '...'})
        data = vault.read_secret('ssh-keys/my-key')
"""
import logging

_logger = logging.getLogger(__name__)


class VaultClient:
    """Thin wrapper around hvac for KV v2 operations."""

    def __init__(self, url, token, mount_point='secret', namespace=None):
        import hvac
        self._client = hvac.Client(url=url, token=token, namespace=namespace)
        self._mount = mount_point
        if not self._client.is_authenticated():
            raise ConnectionError(f'Vault authentication failed at {url}')
        _logger.info('Vault client connected to %s (mount=%s)', url, mount_point)

    @property
    def is_connected(self):
        try:
            return self._client.is_authenticated()
        except Exception:
            return False

    def store_secret(self, path, data):
        """Store a secret at the given path under the KV v2 mount."""
        self._client.secrets.kv.v2.create_or_update_secret(
            path=path,
            secret=data,
            mount_point=self._mount,
        )
        _logger.info('Vault: stored secret at %s/%s', self._mount, path)

    def read_secret(self, path):
        """Read a secret from the given path. Returns dict or None."""
        try:
            resp = self._client.secrets.kv.v2.read_secret_version(
                path=path,
                mount_point=self._mount,
            )
            return resp['data']['data']
        except Exception as e:
            _logger.warning('Vault: failed to read %s/%s: %s', self._mount, path, e)
            return None

    def delete_secret(self, path):
        """Permanently delete a secret (all versions)."""
        try:
            self._client.secrets.kv.v2.delete_metadata_and_all_versions(
                path=path,
                mount_point=self._mount,
            )
            _logger.info('Vault: deleted secret at %s/%s', self._mount, path)
        except Exception as e:
            _logger.warning('Vault: failed to delete %s/%s: %s', self._mount, path, e)

    def list_secrets(self, path=''):
        """List secret keys under a path."""
        try:
            resp = self._client.secrets.kv.v2.list_secrets(
                path=path,
                mount_point=self._mount,
            )
            return resp['data']['keys']
        except Exception:
            return []

    def health(self):
        """Return vault health status."""
        try:
            status = self._client.sys.read_health_status(method='GET')
            return {
                'initialized': status.get('initialized'),
                'sealed': status.get('sealed'),
                'version': status.get('version'),
                'cluster_name': status.get('cluster_name'),
            }
        except Exception as e:
            return {'error': str(e)}
