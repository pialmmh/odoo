from odoo import models, fields


class ArtifactProject(models.Model):
    _name = 'artifact.project'
    _description = 'Software Project'
    _order = 'name'

    name = fields.Char(string='Project Name', required=True, index=True)
    project_type = fields.Selection([
        ('jar', 'Java JAR'),
        ('docker', 'Docker Image'),
        ('lxc', 'LXC Container'),
    ], string='Type', default='jar', required=True)
    repo_url = fields.Char(string='Repository URL')
    build_command = fields.Text(string='Build Command')
    artifact_path = fields.Char(string='Artifact Path', help='Relative path to built artifact, e.g. target/app-runner.jar')
    deploy_base_path = fields.Char(string='Deploy Base Path', help='Remote install directory, e.g. /opt/routesphere')
    deploy_template_id = fields.Many2one('artifact.deploy.template', string='Default Deploy Template')
    description = fields.Text(string='Description')

    version_ids = fields.One2many('artifact.version', 'project_id', string='Versions')
    version_count = fields.Integer(string='Versions', compute='_compute_counts')
    deployment_count = fields.Integer(string='Deployments', compute='_compute_counts')

    _sql_constraints = [
        ('name_uniq', 'unique(name)', 'Project name must be unique.'),
    ]

    def _compute_counts(self):
        for rec in self:
            rec.version_count = len(rec.version_ids)
            rec.deployment_count = self.env['artifact.deployment'].search_count([
                ('version_id.project_id', '=', rec.id),
            ])
