import json
import logging

from odoo import models, fields, api

_logger = logging.getLogger(__name__)


class ResPartner(models.Model):
    _inherit = 'res.partner'

    x_external_key = fields.Char(
        string='External Key', copy=False,
        help='Kill Bill externalKey (e.g. ISP-001)')
    x_kb_account_id = fields.Char(
        string='KB Account ID', copy=False, readonly=True,
        help='Kill Bill accountId (UUID), set by sync')
    x_nid_passport = fields.Char(
        string='NID/Passport',
        help='National ID or passport number')
    x_verification_status = fields.Selection([
        ('pending', 'Pending'),
        ('verified', 'Verified'),
        ('rejected', 'Rejected'),
    ], string='Verification Status', default='pending', tracking=True)
    x_document_attachment = fields.Binary(
        string='ID Document',
        help='Uploaded NID/passport scan')
    x_document_filename = fields.Char(string='Document Filename')
    x_kb_balance = fields.Float(
        string='KB Balance', readonly=True,
        help='Current Kill Bill account balance')

    _sql_constraints = [
        ('external_key_company_uniq',
         'unique(x_external_key, company_id)',
         'External Key must be unique per company.'),
    ]

    def write(self, vals):
        res = super().write(vals)
        if vals.get('x_verification_status') == 'verified':
            for partner in self:
                if partner.x_external_key and not partner.x_kb_account_id:
                    self._kb_queue_partner_sync(partner)
        return res

    def _kb_queue_partner_sync(self, partner):
        """Queue a partner→KB sync entry when partner is verified."""
        payload = {
            'name': partner.name,
            'email': partner.email or '',
            'external_key': partner.x_external_key,
            'currency': 'BDT',
            'company_name': partner.company_name or (partner.parent_id.name if partner.parent_id else ''),
            'phone': partner.phone or '',
        }
        self.env['kb.sync.log'].sudo().create({
            'operation': 'partner_to_kb',
            'direction': 'odoo_to_kb',
            'status': 'pending',
            'odoo_object': f'res.partner,{partner.id}',
            'request_payload': json.dumps(payload),
            'company_id': partner.company_id.id or self.env.company.id,
        })
        _logger.info('KB sync queued: partner %s (%s)', partner.x_external_key, partner.name)
