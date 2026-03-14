import logging

from odoo import models, fields, api

_logger = logging.getLogger(__name__)

PG_NOTIFY_FUNCTION = """
CREATE OR REPLACE FUNCTION kb_sync_notify() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('kb_sync', json_build_object(
        'id', NEW.id,
        'operation', NEW.operation,
        'direction', NEW.direction,
        'status', NEW.status
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

PG_NOTIFY_TRIGGER = """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'kb_sync_log_notify_trigger'
    ) THEN
        CREATE TRIGGER kb_sync_log_notify_trigger
            AFTER INSERT ON kb_sync_log
            FOR EACH ROW
            WHEN (NEW.status = 'pending')
            EXECUTE FUNCTION kb_sync_notify();
    END IF;
END $$;
"""


class KbSyncLog(models.Model):
    _name = 'kb.sync.log'
    _description = 'Kill Bill Sync Queue & Log'
    _order = 'create_date desc'

    name = fields.Char(
        string='Reference', required=True, copy=False,
        readonly=True, default='New')
    operation = fields.Selection([
        ('partner_to_kb', 'Partner → KB'),
        ('catalog_upload', 'Catalog Upload'),
        ('subscription_create', 'Subscription Create'),
        ('invoice_from_kb', 'Invoice from KB'),
        ('payment_from_kb', 'Payment from KB'),
        ('subscription_state', 'Subscription State Change'),
        ('overdue_state', 'Overdue State Change'),
    ], string='Operation', required=True, index=True)
    direction = fields.Selection([
        ('odoo_to_kb', 'Odoo → Kill Bill'),
        ('kb_to_odoo', 'Kill Bill → Odoo'),
    ], string='Direction', required=True, index=True)
    status = fields.Selection([
        ('pending', 'Pending'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('retrying', 'Retrying'),
    ], string='Status', default='pending', required=True, index=True)
    kb_object_id = fields.Char(
        string='KB Object ID', index=True,
        help='Kill Bill UUID (accountId, invoiceId, etc.)')
    odoo_object = fields.Char(
        string='Odoo Object',
        help='Model + ID (e.g. res.partner,42)')
    request_payload = fields.Text(
        string='Request Payload',
        help='JSON payload for the sync operation')
    response_payload = fields.Text(
        string='Response',
        help='API response from KB or Odoo')
    error_message = fields.Text(string='Error')
    retry_count = fields.Integer(string='Retries', default=0)
    catalog_hash = fields.Char(
        string='Catalog Hash',
        help='SHA256 for catalog change detection')
    event_id = fields.Char(
        string='Event ID', index=True,
        help='Unique event UUID for deduplication')
    company_id = fields.Many2one(
        'res.company', string='Company', required=True,
        default=lambda self: self.env.company, index=True)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'New') == 'New':
                vals['name'] = self.env['ir.sequence'].next_by_code('kb.sync.log') or 'New'
        return super().create(vals_list)

    def init(self):
        """Install PG NOTIFY trigger on kb_sync_log table.

        When a row is inserted with status='pending', PostgreSQL fires
        a NOTIFY on channel 'kb_sync' with the row's id, operation,
        direction, and status as JSON payload.

        External consumer services LISTEN on 'kb_sync' to wake up
        immediately instead of polling.
        """
        self.env.cr.execute(PG_NOTIFY_FUNCTION)
        self.env.cr.execute(PG_NOTIFY_TRIGGER)
        _logger.info('KB sync PG NOTIFY trigger installed on kb_sync_log')
