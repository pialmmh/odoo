from odoo import models, fields, api


class ArtifactVersion(models.Model):
    _name = 'artifact.version'
    _description = 'Artifact Version'
    _order = 'build_date desc, id desc'

    name = fields.Char(string='Name', compute='_compute_name', store=True)
    project_id = fields.Many2one('artifact.project', string='Project', required=True, ondelete='cascade', index=True)
    git_tag = fields.Char(string='Git Tag', required=True, index=True)
    git_commit = fields.Char(string='Git Commit')
    git_branch = fields.Char(string='Git Branch')
    checksum = fields.Char(string='SHA256 Checksum')
    file_size = fields.Integer(string='File Size (bytes)')
    file_size_display = fields.Char(string='Size', compute='_compute_file_size_display')
    artifact_path = fields.Char(string='Artifact Path', help='Full local path to the built artifact')
    build_date = fields.Datetime(string='Build Date', default=fields.Datetime.now)
    built_by = fields.Char(string='Built By')
    status = fields.Selection([
        ('draft', 'Draft'),
        ('released', 'Released'),
        ('deprecated', 'Deprecated'),
    ], string='Status', default='released', index=True)
    notes = fields.Text(string='Notes')

    deployment_ids = fields.One2many('artifact.deployment', 'version_id', string='Deployments')
    deployment_count = fields.Integer(string='Deploys', compute='_compute_deployment_count')

    _sql_constraints = [
        ('project_tag_uniq', 'unique(project_id, git_tag)', 'Version tag must be unique per project.'),
    ]

    @api.depends('project_id.name', 'git_tag')
    def _compute_name(self):
        for rec in self:
            rec.name = f"{rec.project_id.name or '?'}/{rec.git_tag or '?'}"

    @api.depends('file_size')
    def _compute_file_size_display(self):
        for rec in self:
            size = rec.file_size or 0
            if size < 1024:
                rec.file_size_display = f"{size} B"
            elif size < 1024 * 1024:
                rec.file_size_display = f"{size / 1024:.1f} KB"
            else:
                rec.file_size_display = f"{size / (1024 * 1024):.1f} MB"

    def _compute_deployment_count(self):
        for rec in self:
            rec.deployment_count = len(rec.deployment_ids)
