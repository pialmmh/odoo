"""
Phase 3 — account_move (+lines), account_payment, sale_order (+lines).

Demo data, so we use savepoint-per-row and skip rows whose FKs can't be resolved.

FK mapping strategy:
  - res_partner:    by name (already mapped Phase 0/1)
  - product_template / product_product: by name
  - account_journal: by code, fall back by type
  - account_account: by (account_type, name->>'en_US')
  - account_tax:    by (amount, type_tax_use, name->>'en_US') — Phase 0 already mapped 6
  - account_payment_term, account_fiscal_position: by name
  - account_payment_method_line: by code on a sane v19 default journal
"""
import logging
import psycopg2
import psycopg2.extras

logging.basicConfig(level=logging.INFO, format='%(levelname)-7s %(message)s')
log = logging.getLogger('phase3')
DSN_KW = dict(host='/var/run/postgresql', port=5433, user='mustafa')


def jsonify(v):
    if isinstance(v, dict): return psycopg2.extras.Json(v)
    if isinstance(v, memoryview): return bytes(v)
    return v


def cols_intersect(s, d, table):
    s.execute("SELECT column_name FROM information_schema.columns WHERE table_name=%s ORDER BY ordinal_position", (table,))
    a = [r['column_name'] for r in s.fetchall()]
    d.execute("SELECT column_name FROM information_schema.columns WHERE table_name=%s", (table,))
    b = {r['column_name'] for r in d.fetchall()}
    return [c for c in a if c in b]


def main():
    sc = psycopg2.connect(dbname='odoo_billing', **DSN_KW)
    dc = psycopg2.connect(dbname='odoo_billing_19', **DSN_KW)
    dc.autocommit = False
    s = sc.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    d = dc.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # --- Pre-built lookup maps -----------------------------------------
    log.info('--- Building FK lookup maps ---')

    # partner_map: by name
    partner_map = {}
    s.execute("SELECT id, name FROM res_partner")
    for r in s.fetchall():
        d.execute("SELECT id FROM res_partner WHERE name=%s LIMIT 1", (r['name'],))
        v19 = d.fetchone()
        if v19: partner_map[r['id']] = v19['id']
    log.info(f'  partner_map: {len(partner_map)} entries')

    # product_template_map: by name->>'en_US'
    tmpl_map = {}
    s.execute("SELECT id, name FROM product_template")
    for r in s.fetchall():
        nm = r['name'].get('en_US') if isinstance(r['name'], dict) else r['name']
        d.execute("SELECT id FROM product_template WHERE name->>'en_US'=%s LIMIT 1", (nm,))
        v19 = d.fetchone()
        if v19: tmpl_map[r['id']] = v19['id']
    log.info(f'  product_template_map: {len(tmpl_map)} entries')

    # product_product_map: by product_tmpl_id mapping; pick first variant on v19
    prod_map = {}
    s.execute("SELECT id, product_tmpl_id FROM product_product")
    for r in s.fetchall():
        new_tmpl = tmpl_map.get(r['product_tmpl_id'])
        if not new_tmpl: continue
        d.execute("SELECT id FROM product_product WHERE product_tmpl_id=%s ORDER BY id LIMIT 1", (new_tmpl,))
        v19 = d.fetchone()
        if v19: prod_map[r['id']] = v19['id']
    log.info(f'  product_product_map: {len(prod_map)} entries')

    # account_account_map: by (account_type, name->>'en_US')
    acct_map = {}
    s.execute("SELECT id, account_type, name FROM account_account")
    for r in s.fetchall():
        nm = r['name'].get('en_US') if isinstance(r['name'], dict) else r['name']
        d.execute("SELECT id FROM account_account WHERE account_type=%s AND name->>'en_US'=%s LIMIT 1",
                  (r['account_type'], nm))
        v19 = d.fetchone()
        if not v19:
            # fallback: any account of same type
            d.execute("SELECT id FROM account_account WHERE account_type=%s ORDER BY id LIMIT 1", (r['account_type'],))
            v19 = d.fetchone()
        if v19: acct_map[r['id']] = v19['id']
    log.info(f'  account_account_map: {len(acct_map)} of v17 accounts mapped')

    # account_journal_map: by code, fall back by type
    journal_map = {}
    s.execute("SELECT id, code, type, name FROM account_journal")
    for r in s.fetchall():
        d.execute("SELECT id FROM account_journal WHERE code=%s LIMIT 1", (r['code'],))
        v19 = d.fetchone()
        if not v19:
            d.execute("SELECT id FROM account_journal WHERE type=%s ORDER BY id LIMIT 1", (r['type'],))
            v19 = d.fetchone()
        if v19: journal_map[r['id']] = v19['id']
    log.info(f'  journal_map: {len(journal_map)} of v17 journals mapped')

    # account_tax_map: by (amount, type_tax_use, name->>'en_US')
    tax_map = {}
    s.execute("SELECT id, amount, type_tax_use, name FROM account_tax")
    for r in s.fetchall():
        nm = r['name'].get('en_US') if isinstance(r['name'], dict) else r['name']
        d.execute("""SELECT id FROM account_tax WHERE amount=%s AND type_tax_use=%s AND name->>'en_US'=%s LIMIT 1""",
                  (r['amount'], r['type_tax_use'], nm))
        v19 = d.fetchone()
        if not v19:
            d.execute("SELECT id FROM account_tax WHERE amount=%s AND type_tax_use=%s LIMIT 1",
                      (r['amount'], r['type_tax_use']))
            v19 = d.fetchone()
        if v19: tax_map[r['id']] = v19['id']
    log.info(f'  tax_map: {len(tax_map)} of v17 taxes mapped')

    # payment_term_map: by name->>'en_US'
    term_map = {}
    s.execute("SELECT id, name FROM account_payment_term")
    for r in s.fetchall():
        nm = r['name'].get('en_US') if isinstance(r['name'], dict) else r['name']
        d.execute("SELECT id FROM account_payment_term WHERE name->>'en_US'=%s LIMIT 1", (nm,))
        v19 = d.fetchone()
        if v19: term_map[r['id']] = v19['id']
    log.info(f'  payment_term_map: {len(term_map)} entries')

    # fiscal_position_map: by name->>'en_US'
    fp_map = {}
    s.execute("SELECT id, name FROM account_fiscal_position")
    for r in s.fetchall():
        nm = r['name'].get('en_US') if isinstance(r['name'], dict) else r['name']
        d.execute("SELECT id FROM account_fiscal_position WHERE name->>'en_US'=%s LIMIT 1", (nm,))
        v19 = d.fetchone()
        if v19: fp_map[r['id']] = v19['id']
    log.info(f'  fiscal_position_map: {len(fp_map)} entries')

    # payment_method_line_map: just take v19's first inbound/outbound for the same journal
    # Build at insertion time; for demo data, use v19 defaults

    move_map = {}
    sale_map = {}

    try:
        # ============================================================
        # account_move (4)
        # Strategy: for KB-tagged moves, match by x_kb_invoice_id (preserves
        # the KB linkage if v19 already has them). For others, always INSERT
        # a fresh row (Odoo allows duplicate `name`; v19 demo rows stay).
        # ============================================================
        log.info('--- account_move ---')
        s_cols = cols_intersect(s, d, 'account_move')
        s_cols.remove('id')
        s.execute("SELECT * FROM account_move ORDER BY id")
        v17_moves = s.fetchall()
        for m in v17_moves:
            row = dict(m)
            row['partner_id'] = partner_map.get(row['partner_id']) if row['partner_id'] else None
            row['journal_id'] = journal_map.get(row['journal_id'])
            row['fiscal_position_id'] = fp_map.get(row['fiscal_position_id']) if row['fiscal_position_id'] else None
            row['invoice_payment_term_id'] = term_map.get(row['invoice_payment_term_id']) if row['invoice_payment_term_id'] else None
            row['company_id'] = 1
            if not row['journal_id']:
                log.warning(f'  skip account_move[{m["id"]}] — no journal mapping')
                continue
            # Match by x_kb_invoice_id only (preserves KB linkage)
            if m.get('x_kb_invoice_id'):
                d.execute("SELECT id FROM account_move WHERE x_kb_invoice_id=%s LIMIT 1", (m['x_kb_invoice_id'],))
                existing = d.fetchone()
                if existing:
                    move_map[m['id']] = existing['id']
                    log.info(f'  ~ account_move "{m["name"]}" KB-matched (id={existing["id"]})')
                    continue
            sp = f'sp_move_{m["id"]}'
            d.execute(f'SAVEPOINT {sp}')
            try:
                cols = s_cols
                vals = [jsonify(row.get(c)) for c in cols]
                d.execute(f'INSERT INTO account_move ({",".join(cols)}) VALUES ({",".join(["%s"]*len(cols))}) RETURNING id', vals)
                move_map[m['id']] = d.fetchone()['id']
                d.execute(f'RELEASE SAVEPOINT {sp}')
                log.info(f'  + account_move "{m["name"]}" → v19 id={move_map[m["id"]]}')
            except Exception as e:
                d.execute(f'ROLLBACK TO SAVEPOINT {sp}; RELEASE SAVEPOINT {sp}')
                log.warning(f'  skip account_move[{m["id"]}] "{m["name"]}": {str(e)[:140]}')

        # ============================================================
        # account_move_line (6) — defer payment_id (set NULL; will fill after payment migrated)
        # Skip lines whose move was matched (already exists with its own lines).
        # ============================================================
        log.info('--- account_move_line ---')
        ml_cols = cols_intersect(s, d, 'account_move_line')
        ml_cols.remove('id')
        s.execute("SELECT * FROM account_move_line ORDER BY id")
        ml_added = ml_skipped = 0
        ml_v17_to_v19 = {}  # for later payment_id back-fill
        for ln in s.fetchall():
            row = dict(ln)
            new_move = move_map.get(row['move_id'])
            if not new_move:
                ml_skipped += 1; continue
            # Was this move newly inserted (we own it)? Check by seeing if v19 already has lines.
            d.execute("SELECT COUNT(*) AS c FROM account_move_line WHERE move_id=%s", (new_move,))
            if d.fetchone()['c'] > 0:
                ml_skipped += 1
                continue
            row['move_id']    = new_move
            row['account_id'] = acct_map.get(row['account_id'])
            row['partner_id'] = partner_map.get(row['partner_id']) if row['partner_id'] else None
            row['journal_id'] = journal_map.get(row['journal_id']) if row['journal_id'] else None
            row['product_id'] = prod_map.get(row['product_id']) if row['product_id'] else None
            row['tax_line_id'] = tax_map.get(row['tax_line_id']) if row['tax_line_id'] else None
            row['payment_id'] = None  # back-fill below after account_payment migration
            row['company_id'] = 1
            if not row['account_id'] or not row['journal_id']:
                ml_skipped += 1
                continue
            sp = f'sp_ml_{ln["id"]}'
            d.execute(f'SAVEPOINT {sp}')
            try:
                vals = [jsonify(row.get(c)) for c in ml_cols]
                d.execute(f'INSERT INTO account_move_line ({",".join(ml_cols)}) VALUES ({",".join(["%s"]*len(ml_cols))}) RETURNING id', vals)
                ml_v17_to_v19[ln['id']] = d.fetchone()['id']
                d.execute(f'RELEASE SAVEPOINT {sp}')
                ml_added += 1
            except Exception as e:
                d.execute(f'ROLLBACK TO SAVEPOINT {sp}; RELEASE SAVEPOINT {sp}')
                log.warning(f'  skip account_move_line[{ln["id"]}]: {str(e)[:140]}')
                ml_skipped += 1
        log.info(f'  +{ml_added}, !{ml_skipped} skipped')

        # ============================================================
        # account_payment (1) — also back-fills move_line.payment_id
        # ============================================================
        log.info('--- account_payment ---')
        payment_map = {}  # v17 payment id → v19 payment id
        ap_cols = cols_intersect(s, d, 'account_payment')
        ap_cols.remove('id')
        s.execute("SELECT * FROM account_payment ORDER BY id")
        for p in s.fetchall():
            row = dict(p)
            row['move_id'] = move_map.get(row['move_id'])
            row['partner_id'] = partner_map.get(row['partner_id']) if row['partner_id'] else None
            row['outstanding_account_id'] = acct_map.get(row['outstanding_account_id']) if row['outstanding_account_id'] else None
            row['destination_account_id'] = acct_map.get(row['destination_account_id']) if row['destination_account_id'] else None
            row['destination_journal_id'] = journal_map.get(row['destination_journal_id']) if row['destination_journal_id'] else None
            # payment_method_line — use v19's first method_line on the move's journal
            # whose underlying account_payment_method matches the payment_type
            if row['move_id']:
                d.execute("""SELECT pml.id FROM account_payment_method_line pml
                             JOIN account_payment_method pm ON pm.id = pml.payment_method_id
                             JOIN account_move m ON m.journal_id = pml.journal_id
                             WHERE m.id = %s AND pm.payment_type=%s ORDER BY pml.id LIMIT 1""",
                          (row['move_id'], row['payment_type'] or 'inbound'))
                v19pml = d.fetchone()
                row['payment_method_line_id'] = v19pml['id'] if v19pml else None
                # payment_method_id mirrors the line's underlying method
                if v19pml:
                    d.execute("SELECT payment_method_id FROM account_payment_method_line WHERE id=%s", (v19pml['id'],))
                    row['payment_method_id'] = d.fetchone()['payment_method_id']
            row['company_id'] = 1
            if not row['move_id']:
                log.warning(f'  skip account_payment[{p["id"]}] — no move mapping')
                continue
            sp = f'sp_pay_{p["id"]}'
            d.execute(f'SAVEPOINT {sp}')
            try:
                vals = [jsonify(row.get(c)) for c in ap_cols]
                d.execute(f'INSERT INTO account_payment ({",".join(ap_cols)}) VALUES ({",".join(["%s"]*len(ap_cols))}) RETURNING id', vals)
                new_pay_id = d.fetchone()['id']
                payment_map[p['id']] = new_pay_id
                d.execute(f'RELEASE SAVEPOINT {sp}')
                log.info(f'  + account_payment[{p["id"]}] → v19 id={new_pay_id}')
            except Exception as e:
                d.execute(f'ROLLBACK TO SAVEPOINT {sp}; RELEASE SAVEPOINT {sp}')
                log.warning(f'  skip account_payment[{p["id"]}]: {str(e)[:140]}')

        # back-fill move_line.payment_id for the lines we deferred
        if payment_map:
            log.info('--- back-fill account_move_line.payment_id ---')
            s.execute("SELECT id, payment_id FROM account_move_line WHERE payment_id IS NOT NULL")
            backfilled = 0
            for ln in s.fetchall():
                v19_ml = ml_v17_to_v19.get(ln['id'])
                v19_pay = payment_map.get(ln['payment_id'])
                if v19_ml and v19_pay:
                    d.execute("UPDATE account_move_line SET payment_id=%s WHERE id=%s", (v19_pay, v19_ml))
                    backfilled += 1
            log.info(f'  back-filled {backfilled} move_line.payment_id rows')

        # ============================================================
        # sale_order (2)
        # ============================================================
        log.info('--- sale_order ---')
        so_cols = cols_intersect(s, d, 'sale_order')
        so_cols.remove('id')
        s.execute("SELECT * FROM sale_order ORDER BY id")
        for o in s.fetchall():
            row = dict(o)
            row['partner_id']        = partner_map.get(row['partner_id']) if row['partner_id'] else None
            row['journal_id']        = journal_map.get(row['journal_id']) if row['journal_id'] else None
            row['fiscal_position_id'] = fp_map.get(row['fiscal_position_id']) if row['fiscal_position_id'] else None
            row['payment_term_id']   = term_map.get(row['payment_term_id']) if row['payment_term_id'] else None
            row['company_id'] = 1
            if not row['partner_id']:
                log.warning(f'  skip sale_order[{o["id"]}] "{o["name"]}" — no partner mapping')
                continue
            d.execute("SELECT id FROM sale_order WHERE name=%s LIMIT 1", (o['name'],))
            existing = d.fetchone()
            if existing:
                sale_map[o['id']] = existing['id']
                log.info(f'  ~ sale_order "{o["name"]}" already on v19')
                continue
            sp = f'sp_so_{o["id"]}'
            d.execute(f'SAVEPOINT {sp}')
            try:
                vals = [jsonify(row.get(c)) for c in so_cols]
                d.execute(f'INSERT INTO sale_order ({",".join(so_cols)}) VALUES ({",".join(["%s"]*len(so_cols))}) RETURNING id', vals)
                sale_map[o['id']] = d.fetchone()['id']
                d.execute(f'RELEASE SAVEPOINT {sp}')
                log.info(f'  + sale_order "{o["name"]}" → v19 id={sale_map[o["id"]]}')
            except Exception as e:
                d.execute(f'ROLLBACK TO SAVEPOINT {sp}; RELEASE SAVEPOINT {sp}')
                log.warning(f'  skip sale_order[{o["id"]}] "{o["name"]}": {str(e)[:140]}')

        # ============================================================
        # sale_order_line (1)
        # ============================================================
        log.info('--- sale_order_line ---')
        sol_cols = cols_intersect(s, d, 'sale_order_line')
        sol_cols.remove('id')
        s.execute("SELECT * FROM sale_order_line ORDER BY id")
        added = skipped = 0
        for ln in s.fetchall():
            row = dict(ln)
            row['order_id']         = sale_map.get(row['order_id'])
            row['order_partner_id'] = partner_map.get(row['order_partner_id']) if row['order_partner_id'] else None
            row['product_id']       = prod_map.get(row['product_id']) if row['product_id'] else None
            row['salesman_id']      = 2
            row['company_id'] = 1
            if not row['order_id'] or not row['product_id']:
                skipped += 1; continue
            sp = f'sp_sol_{ln["id"]}'
            d.execute(f'SAVEPOINT {sp}')
            try:
                vals = [jsonify(row.get(c)) for c in sol_cols]
                d.execute(f'INSERT INTO sale_order_line ({",".join(sol_cols)}) VALUES ({",".join(["%s"]*len(sol_cols))})', vals)
                d.execute(f'RELEASE SAVEPOINT {sp}')
                added += 1
            except Exception as e:
                d.execute(f'ROLLBACK TO SAVEPOINT {sp}; RELEASE SAVEPOINT {sp}')
                log.warning(f'  skip sale_order_line[{ln["id"]}]: {str(e)[:140]}')
                skipped += 1
        log.info(f'  +{added}, !{skipped} skipped')

        log.info('--- COMMIT ---')
        dc.commit()
        log.info('Phase 3 complete.')

    except Exception as e:
        log.exception(f'Phase 3 failed: {e!r}')
        dc.rollback()
        raise
    finally:
        s.close(); d.close(); sc.close(); dc.close()


if __name__ == '__main__':
    main()
