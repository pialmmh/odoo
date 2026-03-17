import base64
import hashlib
import logging
import uuid

import psycopg2

from odoo import models, fields, api
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

# Separate DB connection for document binary storage
DOC_DB_DSN = "host=127.0.0.1 port=5433 dbname=odoo_documents user=mustafa password=mustafa"


def _get_doc_conn():
    """Get a connection to the separate documents database."""
    return psycopg2.connect(DOC_DB_DSN)


class DocDocument(models.Model):
    _name = 'doc.document'
    _description = 'Document (metadata in Odoo, binary in separate DB)'
    _order = 'upload_date desc, id desc'

    name = fields.Char(string='Document Name', required=True, index=True)
    filename = fields.Char(string='Filename', required=True)
    mimetype = fields.Char(string='MIME Type', default='application/octet-stream')
    file_size = fields.Integer(string='File Size (bytes)', readonly=True)
    file_size_display = fields.Char(string='Size', compute='_compute_file_size_display')
    checksum = fields.Char(string='Checksum (SHA256)', readonly=True, index=True)
    storage_ref = fields.Char(
        string='Storage Ref', readonly=True, index=True, copy=False,
        help='UUID key to retrieve binary from document storage DB')

    # Upload field — transient, used to push binary to doc DB
    file_upload = fields.Binary(string='Upload File', attachment=False)

    doc_type = fields.Selection([
        ('sro', 'SRO / Gazette Notification'),
        ('circular', 'Circular / Letter'),
        ('contract', 'Contract / Agreement'),
        ('invoice', 'Invoice / Receipt'),
        ('nid', 'NID / Passport'),
        ('certificate', 'Certificate / License'),
        ('report', 'Report'),
        ('other', 'Other'),
    ], string='Document Type', default='other', index=True)

    description = fields.Text(string='Description')
    tags = fields.Char(string='Tags', help='Comma-separated tags for search')

    uploaded_by = fields.Many2one(
        'res.users', string='Uploaded By',
        default=lambda self: self.env.user, readonly=True)
    upload_date = fields.Datetime(
        string='Upload Date', default=fields.Datetime.now, readonly=True)
    company_id = fields.Many2one(
        'res.company', string='Company', required=True,
        default=lambda self: self.env.company, index=True)

    mapping_ids = fields.One2many(
        'doc.mapping', 'document_id', string='Linked Records')
    mapping_count = fields.Integer(
        string='Linked Records', compute='_compute_mapping_count')

    def _compute_mapping_count(self):
        for rec in self:
            rec.mapping_count = len(rec.mapping_ids)

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

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            file_data = vals.pop('file_upload', None)
            if file_data:
                binary = base64.b64decode(file_data)
                checksum = hashlib.sha256(binary).hexdigest()
                storage_ref = str(uuid.uuid4())

                # Store binary in separate DB
                self._store_binary(storage_ref, binary, checksum)

                vals['checksum'] = checksum
                vals['storage_ref'] = storage_ref
                vals['file_size'] = len(binary)

                # Detect mimetype from filename
                fname = vals.get('filename', '')
                if fname.lower().endswith('.pdf'):
                    vals['mimetype'] = 'application/pdf'
                elif fname.lower().endswith(('.jpg', '.jpeg')):
                    vals['mimetype'] = 'image/jpeg'
                elif fname.lower().endswith('.png'):
                    vals['mimetype'] = 'image/png'
                elif fname.lower().endswith(('.doc', '.docx')):
                    vals['mimetype'] = 'application/msword'
                elif fname.lower().endswith(('.xls', '.xlsx')):
                    vals['mimetype'] = 'application/vnd.ms-excel'

        return super().create(vals_list)

    def get_binary(self):
        """Retrieve binary content from the document storage DB.
        Returns base64-encoded content.
        """
        self.ensure_one()
        if not self.storage_ref:
            raise UserError("No storage reference — document binary not available.")
        conn = _get_doc_conn()
        try:
            with conn.cursor() as cr:
                cr.execute(
                    "SELECT content FROM doc_binary WHERE storage_ref = %s",
                    (self.storage_ref,))
                row = cr.fetchone()
                if not row:
                    raise UserError("Document binary not found in storage.")
                return base64.b64encode(row[0]).decode('ascii')
        finally:
            conn.close()

    @staticmethod
    def _store_binary(storage_ref, binary_data, checksum):
        """Store binary in the separate documents database."""
        conn = _get_doc_conn()
        try:
            with conn.cursor() as cr:
                # Check for duplicate by checksum (deduplication)
                cr.execute(
                    "SELECT storage_ref FROM doc_binary WHERE checksum = %s LIMIT 1",
                    (checksum,))
                existing = cr.fetchone()
                if existing:
                    _logger.info("Document binary already exists (checksum %s), reusing", checksum[:12])
                    # Still insert with new storage_ref pointing to same content
                    # (or we could return existing ref — but separate refs allow independent deletion)

                cr.execute(
                    "INSERT INTO doc_binary (storage_ref, content, checksum, file_size) "
                    "VALUES (%s, %s, %s, %s)",
                    (storage_ref, psycopg2.Binary(binary_data), checksum, len(binary_data)))
            conn.commit()
            _logger.info("Stored document binary: ref=%s, size=%d", storage_ref, len(binary_data))
        finally:
            conn.close()

    def unlink(self):
        """Delete binary from document DB when metadata is deleted."""
        refs = [r.storage_ref for r in self if r.storage_ref]
        result = super().unlink()
        if refs:
            conn = _get_doc_conn()
            try:
                with conn.cursor() as cr:
                    cr.execute(
                        "DELETE FROM doc_binary WHERE storage_ref = ANY(%s)",
                        (refs,))
                conn.commit()
            finally:
                conn.close()
        return result


class DocMapping(models.Model):
    _name = 'doc.mapping'
    _description = 'Document ↔ Entity Mapping'
    _order = 'id desc'

    document_id = fields.Many2one(
        'doc.document', string='Document', required=True,
        ondelete='cascade', index=True)
    res_model = fields.Char(
        string='Entity Model', required=True, index=True,
        help='Odoo model name (e.g. product.tax.rate, account.move, res.partner)')
    res_id = fields.Integer(
        string='Entity ID', required=True, index=True,
        help='Record ID in the entity model')
    res_name = fields.Char(
        string='Entity Name', compute='_compute_res_name', store=True)
    link_type = fields.Selection([
        ('sro', 'SRO / Gazette'),
        ('supporting', 'Supporting Document'),
        ('contract', 'Contract'),
        ('receipt', 'Receipt / Proof of Payment'),
        ('id_proof', 'Identity Proof'),
        ('certificate', 'Certificate'),
        ('other', 'Other'),
    ], string='Link Type', default='other')
    notes = fields.Char(string='Notes')

    _sql_constraints = [
        ('unique_doc_entity',
         'unique(document_id, res_model, res_id)',
         'Document is already linked to this record.'),
    ]

    @api.depends('res_model', 'res_id')
    def _compute_res_name(self):
        for rec in self:
            if rec.res_model and rec.res_id:
                try:
                    entity = self.env[rec.res_model].browse(rec.res_id)
                    rec.res_name = entity.display_name if entity.exists() else f"{rec.res_model},{rec.res_id}"
                except Exception:
                    rec.res_name = f"{rec.res_model},{rec.res_id}"
            else:
                rec.res_name = ''
