import base64
import logging
import os
import tempfile
import threading

from odoo import models, fields, api

_logger = logging.getLogger(__name__)


class ArtifactDeployPipeline(models.Model):
    _name = 'artifact.deploy.pipeline'
    _description = 'Deploy Pipeline'
    _order = 'id desc'

    name = fields.Char(string='Name', compute='_compute_name', store=True)
    deployment_id = fields.Many2one('artifact.deployment', string='Deployment', ondelete='cascade', index=True)
    ssh_credential_id = fields.Many2one('infra.ssh.credential', string='SSH Credential', required=True)
    status = fields.Selection([
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ], string='Status', default='pending', index=True)
    step_ids = fields.One2many('artifact.deploy.step', 'pipeline_id', string='Steps')
    current_step = fields.Integer(string='Current Step', default=0)
    started_at = fields.Datetime(string='Started')
    finished_at = fields.Datetime(string='Finished')
    total_steps = fields.Integer(string='Total Steps', compute='_compute_total_steps')

    @api.depends('deployment_id.name')
    def _compute_name(self):
        for rec in self:
            rec.name = f"Pipeline #{rec.id} — {rec.deployment_id.name or ''}"

    def _compute_total_steps(self):
        for rec in self:
            rec.total_steps = len(rec.step_ids)

    def action_execute(self):
        """Launch pipeline execution in a background thread."""
        self.ensure_one()
        self.write({'status': 'running', 'started_at': fields.Datetime.now()})
        pipeline_id = self.id
        db_name = self.env.cr.dbname
        uid = self.env.uid
        context = dict(self.env.context)

        thread = threading.Thread(
            target=self._run_pipeline_thread,
            args=(db_name, uid, context, pipeline_id),
            daemon=True,
        )
        thread.start()
        return {'status': 'started', 'pipeline_id': pipeline_id}

    @api.model
    def _run_pipeline_thread(self, db_name, uid, context, pipeline_id):
        """Execute pipeline steps in a new cursor (background thread)."""
        import odoo
        registry = odoo.registry(db_name)
        with registry.cursor() as cr:
            env = api.Environment(cr, uid, context)
            pipeline = env['artifact.deploy.pipeline'].browse(pipeline_id)
            pipeline._execute_steps(env)

    def _execute_steps(self, env):
        """Core executor: open SSH, run steps sequentially, commit after each."""
        try:
            import paramiko
        except ImportError:
            self._fail('paramiko not installed', env)
            return

        cred = self.ssh_credential_id
        if not cred.key_id or not cred.key_id.private_key:
            self._fail('SSH credential has no key assigned', env)
            return

        # Write private key to temp file
        key_data = base64.b64decode(cred.key_id.private_key)
        fd, key_path = tempfile.mkstemp(prefix='deploy_key_', suffix='.pem')
        with os.fdopen(fd, 'wb') as f:
            f.write(key_data)
        os.chmod(key_path, 0o600)

        client = None
        try:
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            client.connect(
                hostname=cred.host,
                port=cred.port,
                username=cred.username,
                key_filename=key_path,
                timeout=15,
                look_for_keys=False,
                allow_agent=False,
            )
            # Keep alive for long deploys
            transport = client.get_transport()
            if transport:
                transport.set_keepalive(30)

            steps = self.step_ids.sorted('sequence')
            for i, step in enumerate(steps):
                # Check if cancelled
                self.env.cr.execute('SELECT status FROM artifact_deploy_pipeline WHERE id = %s', (self.id,))
                row = self.env.cr.fetchone()
                if row and row[0] == 'cancelled':
                    step.write({'status': 'skipped'})
                    self.env.cr.commit()
                    continue

                self.write({'current_step': i + 1})
                self.env.cr.commit()

                step.write({'status': 'running', 'started_at': fields.Datetime.now()})
                self.env.cr.commit()

                try:
                    if step.step_type == 'ssh':
                        exit_code, stdout, stderr = self._exec_ssh(client, step.command, step.timeout)
                    elif step.step_type == 'local':
                        exit_code, stdout, stderr = self._exec_local(step.command, step.timeout)
                    elif step.step_type == 'sftp':
                        exit_code, stdout, stderr = self._exec_sftp(client, step.command, step.timeout)
                    else:
                        exit_code, stdout, stderr = -1, '', f'Unknown step type: {step.step_type}'

                    success = exit_code == 0
                    step.write({
                        'status': 'success' if success else 'failed',
                        'exit_code': exit_code,
                        'stdout': stdout[-65536:] if stdout else '',  # Truncate large output
                        'stderr': stderr[-16384:] if stderr else '',
                        'finished_at': fields.Datetime.now(),
                    })
                    self.env.cr.commit()

                    if not success and not step.continue_on_error:
                        self._fail(f'Step "{step.name}" failed (exit {exit_code})', self.env)
                        return

                except Exception as e:
                    step.write({
                        'status': 'failed',
                        'stderr': str(e),
                        'finished_at': fields.Datetime.now(),
                    })
                    self.env.cr.commit()
                    if not step.continue_on_error:
                        self._fail(f'Step "{step.name}" error: {e}', self.env)
                        return

            # All steps done
            self.write({'status': 'success', 'finished_at': fields.Datetime.now()})
            if self.deployment_id:
                self.deployment_id.write({'status': 'success', 'finished_at': fields.Datetime.now()})
            self.env.cr.commit()
            _logger.info('Pipeline %s completed successfully', self.id)

        except Exception as e:
            _logger.exception('Pipeline %s failed: %s', self.id, e)
            self._fail(str(e), self.env)
        finally:
            if client:
                client.close()
            os.unlink(key_path)

    def _exec_ssh(self, client, command, timeout):
        stdin, stdout, stderr = client.exec_command(command, timeout=timeout or 60)
        exit_code = stdout.channel.recv_exit_status()
        return exit_code, stdout.read().decode('utf-8', errors='replace'), stderr.read().decode('utf-8', errors='replace')

    def _exec_local(self, command, timeout):
        import subprocess
        result = subprocess.run(
            command, shell=True, capture_output=True, text=True,
            timeout=timeout or 60,
        )
        return result.returncode, result.stdout, result.stderr

    def _exec_sftp(self, client, command, timeout):
        """SFTP upload. Command format: local_path -> remote_path"""
        try:
            parts = command.split('->')
            if len(parts) != 2:
                return -1, '', 'SFTP command format: /local/path -> /remote/path'
            local_path = parts[0].strip()
            remote_path = parts[1].strip()
            if not os.path.isfile(local_path):
                return -1, '', f'Local file not found: {local_path}'
            sftp = client.open_sftp()
            sftp.put(local_path, remote_path)
            sftp.close()
            size = os.path.getsize(local_path)
            return 0, f'Uploaded {local_path} -> {remote_path} ({size} bytes)', ''
        except Exception as e:
            return -1, '', str(e)

    def _fail(self, reason, env):
        self.write({'status': 'failed', 'finished_at': fields.Datetime.now()})
        if self.deployment_id:
            self.deployment_id.write({'status': 'failed', 'finished_at': fields.Datetime.now()})
        env.cr.commit()
        _logger.error('Pipeline %s failed: %s', self.id, reason)

    def action_cancel(self):
        """Mark pipeline as cancelled. Running steps will be skipped on next check."""
        self.ensure_one()
        if self.status == 'running':
            self.write({'status': 'cancelled', 'finished_at': fields.Datetime.now()})
            if self.deployment_id:
                self.deployment_id.write({'status': 'failed', 'finished_at': fields.Datetime.now()})
