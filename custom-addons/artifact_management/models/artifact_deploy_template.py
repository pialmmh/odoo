from odoo import models, fields


class ArtifactDeployTemplate(models.Model):
    _name = 'artifact.deploy.template'
    _description = 'Deploy Template'
    _order = 'name'

    name = fields.Char(string='Template Name', required=True)
    project_type = fields.Selection([
        ('jar', 'Java JAR'),
        ('docker', 'Docker Image'),
        ('lxc', 'LXC Container'),
    ], string='Artifact Type', default='jar')
    description = fields.Text(string='Description')
    variable_names = fields.Char(string='Variables', help='Comma-separated variable names, e.g. tenant,profile,deploy_path')
    step_ids = fields.One2many('artifact.deploy.template.step', 'template_id', string='Steps')
    step_count = fields.Integer(string='Steps', compute='_compute_step_count')

    def _compute_step_count(self):
        for rec in self:
            rec.step_count = len(rec.step_ids)
