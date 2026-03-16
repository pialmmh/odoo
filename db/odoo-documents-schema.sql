-- Document binary storage schema
-- Database: odoo_documents (separate from main Odoo DB)
--
-- Binary content is stored here to keep the main Odoo DB fast.
-- Odoo's doc.document model stores metadata; this DB stores the actual bytes.
-- Linked by storage_ref (UUID).

CREATE TABLE IF NOT EXISTS doc_binary (
    id BIGSERIAL PRIMARY KEY,
    storage_ref UUID NOT NULL UNIQUE,
    content BYTEA NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_binary_ref ON doc_binary(storage_ref);
CREATE INDEX IF NOT EXISTS idx_doc_binary_checksum ON doc_binary(checksum);

COMMENT ON TABLE doc_binary IS 'Binary document storage — separate DB to avoid slowing main Odoo DB';
COMMENT ON COLUMN doc_binary.storage_ref IS 'UUID key matching doc.document.storage_ref in Odoo main DB';
COMMENT ON COLUMN doc_binary.checksum IS 'SHA256 checksum for deduplication';
