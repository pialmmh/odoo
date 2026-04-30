from odoo import models, fields, api


class ArtifactDeployStep(models.Model):
    _name = 'artifact.deploy.step'
    _description = 'Deploy Pipeline Step'
    _order = 'pipeline_id, sequence'

    pipeline_id = fields.Many2one('artifact.deploy.pipeline', string='Pipeline', required=True, ondelete='cascade', index=True)
    sequence = fields.Integer(string='Sequence', default=10)
    name = fields.Char(string='Step Name', required=True)
    step_type = fields.Selection([
        ('ssh', 'Remote SSH'),
        ('local', 'Local Shell'),
        ('sftp', 'SFTP Upload'),
    ], string='Type', default='ssh')
    command = fields.Text(string='Command')
    timeout = fields.Integer(string='Timeout (sec)', default=60)
    status = fields.Selection([
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('skipped', 'Skipped'),
    ], string='Status', default='pending', index=True)
    exit_code = fields.Integer(string='Exit Code')
    stdout = fields.Text(string='stdout')
    stderr = fields.Text(string='stderr')
    started_at = fields.Datetime(string='Started')
    finished_at = fields.Datetime(string='Finished')
    duration_seconds = fields.Float(string='Duration (s)', compute='_compute_duration')
    continue_on_error = fields.Boolean(string='Continue on Error', default=False)

    @api.depends('started_at', 'finished_at')
    def _compute_duration(self):
        for rec in self:
            if rec.started_at and rec.finished_at:
                rec.duration_seconds = (rec.finished_at - rec.started_at).total_seconds()
            else:
                rec.duration_seconds = 0
