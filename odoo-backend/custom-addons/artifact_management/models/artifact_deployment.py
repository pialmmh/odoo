import json
import logging

from odoo import models, fields, api
from odoo.exceptions import UserError

from .artifact_project import ALLOWED_TARGETS

_logger = logging.getLogger(__name__)


class ArtifactDeployment(models.Model):
    _name = 'artifact.deployment'
    _description = 'Artifact Deployment'
    _order = 'started_at desc, id desc'

    name = fields.Char(string='Name', compute='_compute_name', store=True)
    version_id = fields.Many2one('artifact.version', string='Version', required=True, index=True)
    project_id = fields.Many2one('artifact.project', string='Project', related='version_id.project_id', store=True, readonly=True)

    # Target: either a compute or a container (mutually exclusive)
    target_type = fields.Selection([
        ('compute', 'Compute (Server/VM)'),
        ('container', 'Container'),
    ], string='Target Type', default='compute', required=True)
    compute_id = fields.Many2one('infra.compute', string='Target Compute', index=True)
    container_id = fields.Many2one('infra.container', string='Target Container', index=True)
    target_display = fields.Char(string='Target', compute='_compute_target_display')

    ssh_credential_id = fields.Many2one('infra.ssh.credential', string='SSH Credential', required=True)
    deploy_template_id = fields.Many2one('artifact.deploy.template', string='Deploy Template')
    pipeline_id = fields.Many2one('artifact.deploy.pipeline', string='Pipeline', readonly=True)
    status = fields.Selection([
        ('draft', 'Draft'),
        ('running', 'Running'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('rolled_back', 'Rolled Back'),
    ], string='Status', default='draft', index=True)
    variables = fields.Text(string='Variables (JSON)', default='{}')
    started_at = fields.Datetime(string='Started')
    finished_at = fields.Datetime(string='Finished')
    deployed_by = fields.Many2one('res.users', string='Deployed By', default=lambda self: self.env.user)
    notes = fields.Text(string='Notes')

    @api.depends('version_id.name', 'compute_id.name', 'container_id.name', 'target_type')
    def _compute_name(self):
        for rec in self:
            ver = rec.version_id.name or '?'
            if rec.target_type == 'container' and rec.container_id:
                target = rec.container_id.name
            elif rec.compute_id:
                target = rec.compute_id.name
            else:
                target = '?'
            rec.name = f"{ver} → {target}"

    @api.depends('target_type', 'compute_id', 'container_id')
    def _compute_target_display(self):
        for rec in self:
            if rec.target_type == 'container' and rec.container_id:
                rec.target_display = f"Container: {rec.container_id.name}"
            elif rec.compute_id:
                rec.target_display = f"Compute: {rec.compute_id.name}"
            else:
                rec.target_display = ''

    def _validate_target_compatibility(self):
        """Check that the artifact type is compatible with the deploy target."""
        self.ensure_one()
        project_type = self.version_id.project_id.project_type
        allowed = ALLOWED_TARGETS.get(project_type, {})

        if self.target_type == 'compute' and self.compute_id:
            allowed_node_types = allowed.get('compute', [])
            if self.compute_id.node_type not in allowed_node_types:
                raise UserError(
                    f'Cannot deploy "{project_type}" artifact to compute type '
                    f'"{self.compute_id.node_type}". '
                    f'Allowed: {", ".join(allowed_node_types)}'
                )
        elif self.target_type == 'container' and self.container_id:
            allowed_container_types = allowed.get('container', [])
            if not allowed_container_types:
                raise UserError(
                    f'Cannot deploy "{project_type}" artifact to a container. '
                    f'This artifact type can only be deployed to compute nodes (server/VM).'
                )
            if self.container_id.container_type not in allowed_container_types:
                raise UserError(
                    f'Cannot deploy "{project_type}" artifact to container type '
                    f'"{self.container_id.container_type}". '
                    f'Allowed: {", ".join(allowed_container_types)}'
                )

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        for rec in records:
            rec._validate_target_compatibility()
        return records

    def write(self, vals):
        res = super().write(vals)
        if any(f in vals for f in ('version_id', 'compute_id', 'container_id', 'target_type')):
            for rec in self:
                rec._validate_target_compatibility()
        return res

    def action_deploy(self):
        """Create pipeline from template and execute."""
        self.ensure_one()
        if self.status not in ('draft', 'failed'):
            raise UserError('Can only deploy from draft or failed status.')

        # Validate target compatibility
        self._validate_target_compatibility()

        template = self.deploy_template_id or self.project_id.deploy_template_id
        if not template:
            raise UserError('No deploy template configured.')

        if not template.step_ids:
            raise UserError('Deploy template has no steps.')

        # Parse variables
        try:
            variables = json.loads(self.variables or '{}')
        except json.JSONDecodeError:
            raise UserError('Invalid JSON in variables field.')

        # Add built-in variables
        target_name = self.container_id.name if self.target_type == 'container' else self.compute_id.name
        variables.update({
            'deploy_path': self.project_id.deploy_base_path or '/opt/app',
            'artifact_path': self.version_id.artifact_path or '',
            'git_tag': self.version_id.git_tag or '',
            'git_commit': self.version_id.git_commit or '',
            'git_branch': self.version_id.git_branch or '',
            'version_name': self.version_id.name or '',
            'target_name': target_name or '',
            'compute_name': self.compute_id.name or '',
            'deploy_user': self.env.user.name or '',
        })

        # Create pipeline
        pipeline = self.env['artifact.deploy.pipeline'].create({
            'deployment_id': self.id,
            'ssh_credential_id': self.ssh_credential_id.id,
            'status': 'pending',
        })

        # Create steps from template
        for ts in template.step_ids.sorted('sequence'):
            try:
                resolved_cmd = (ts.command or '').format_map(variables)
            except KeyError as e:
                resolved_cmd = f"# ERROR: Missing variable {e}\n{ts.command}"

            self.env['artifact.deploy.step'].create({
                'pipeline_id': pipeline.id,
                'sequence': ts.sequence,
                'name': ts.name,
                'step_type': ts.step_type,
                'command': resolved_cmd,
                'timeout': ts.timeout,
                'continue_on_error': ts.continue_on_error,
                'status': 'pending',
            })

        self.write({
            'pipeline_id': pipeline.id,
            'status': 'running',
            'started_at': fields.Datetime.now(),
        })

        # Execute in background thread
        pipeline.action_execute()

        return {
            'deployment_id': self.id,
            'pipeline_id': pipeline.id,
            'status': 'started',
        }
