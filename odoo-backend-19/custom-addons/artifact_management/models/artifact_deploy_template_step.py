from odoo import models, fields


class ArtifactDeployTemplateStep(models.Model):
    _name = 'artifact.deploy.template.step'
    _description = 'Deploy Template Step'
    _order = 'template_id, sequence'

    template_id = fields.Many2one('artifact.deploy.template', string='Template', required=True, ondelete='cascade')
    sequence = fields.Integer(string='Sequence', default=10)
    name = fields.Char(string='Step Name', required=True)
    step_type = fields.Selection([
        ('ssh', 'Remote SSH'),
        ('local', 'Local Shell'),
        ('sftp', 'SFTP Upload'),
    ], string='Type', default='ssh', required=True)
    command = fields.Text(string='Command', help='Shell command with {variable} placeholders')
    timeout = fields.Integer(string='Timeout (sec)', default=60)
    continue_on_error = fields.Boolean(string='Continue on Error', default=False)
