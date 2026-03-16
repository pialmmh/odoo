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

    private_key = fields.Binary(string='Private Key', attachment=False, groups='base.group_system')
    public_key = fields.Text(string='Public Key')
    fingerprint = fields.Char(string='Fingerprint', readonly=True)

    created_date = fields.Datetime(string='Created', default=fields.Datetime.now, readonly=True)
    credential_ids = fields.One2many('infra.ssh.credential', 'key_id', string='Used By')
    credential_count = fields.Integer(string='Used By', compute='_compute_credential_count')

    _sql_constraints = [
        ('name_uniq', 'unique(name)', 'SSH key name must be unique.'),
    ]

    def _compute_credential_count(self):
        for rec in self:
            rec.credential_count = len(rec.credential_ids)

    @api.model
    def action_generate_key(self, name, algorithm='ed25519', comment='', passphrase=''):
        """Generate an SSH key pair and store it in Odoo."""
        if not name:
            raise UserError('Key name is required.')

        existing = self.search([('name', '=', name)], limit=1)
        if existing:
            raise UserError(f'Key with name "{name}" already exists.')

        algo_args = ALGO_MAP.get(algorithm)
        if not algo_args:
            raise UserError(f'Unsupported algorithm: {algorithm}')

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

            # Get fingerprint
            fp_result = subprocess.run(
                ['ssh-keygen', '-lf', key_path + '.pub'],
                capture_output=True, text=True,
            )
            fingerprint = ''
            if fp_result.returncode == 0:
                parts = fp_result.stdout.strip().split()
                fingerprint = parts[1] if len(parts) > 1 else fp_result.stdout.strip()

        record = self.create({
            'name': name,
            'algorithm': algorithm,
            'comment': comment or name,
            'has_passphrase': bool(passphrase),
            'private_key': base64.b64encode(private_key_data),
            'public_key': public_key_data,
            'fingerprint': fingerprint,
        })

        _logger.info('SSH key generated: %s (%s)', name, algorithm)
        return {
            'id': record.id,
            'name': record.name,
            'algorithm': record.algorithm,
            'fingerprint': record.fingerprint,
            'public_key': record.public_key,
        }

    def action_get_public_key(self):
        """Return the public key text."""
        self.ensure_one()
        return self.public_key or ''

    def action_get_private_key_pem(self):
        """Return the private key as text (admin only)."""
        self.ensure_one()
        if not self.private_key:
            raise UserError('No private key stored.')
        return base64.b64decode(self.private_key).decode('utf-8', errors='replace')
