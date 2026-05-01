"""
Phase 1 — foundation rows from v17 (odoo_billing) → v19 (odoo_billing_19).

Tables migrated (in order):
  1. res_partner     — BTCL + Telcobright ISP (skip 6 stock partners)
  2. account_payment_term + lines
  3. platform_tenant_config
  4. rbac_role, rbac_permission, rbac_role_permission_rel
  5. rbac_url_pattern, rbac_url_pattern_permission_rel
  6. artifact_deploy_template + steps
  7. crm_lead

Single transaction, rollback on error.
"""
import logging
import psycopg2
import psycopg2.extras

logging.basicConfig(level=logging.INFO, format='%(levelname)-7s %(message)s')
log = logging.getLogger('phase1')

DSN_KW = dict(host='/var/run/postgresql', port=5433, user='mustafa')

def jsonify(v):
    if isinstance(v, dict):
        return psycopg2.extras.Json(v)
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
    s = sc.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    d = dc.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        dc.autocommit = False

        # ABC ISP already at v19 partner_id=44 from Phase 0
        d.execute("SELECT id FROM res_partner WHERE name='ABC ISP Limited'")
        abc_isp = d.fetchone()['id']
        partner_map = {7: abc_isp}

        # Map v17 stock partners to v19 stock partners by name
        for v17id, name in [(2,'OdooBot'),(4,'Public user'),(5,'Portal User Template')]:
            d.execute("SELECT id FROM res_partner WHERE name=%s LIMIT 1", (name,))
            r = d.fetchone()
            if r:
                partner_map[v17id] = r['id']
                log.info(f'  partner_map[{v17id}] "{name}" → existing v19 id={r["id"]}')

        # ------------------------------------------------------------------
        # 1) res_partner — BTCL (id=8) + Telcobright ISP (id=1) +
        #    Administrator (id=3) + Default User Template (id=5 already mapped above)
        # ------------------------------------------------------------------
        log.info('--- res_partner (BTCL, Telcobright ISP, Administrator, Default Tpl) ---')
        s.execute("SELECT * FROM res_partner WHERE id IN (1, 3, 5, 8) ORDER BY id")
        for p in s.fetchall():
            d.execute("SELECT id FROM res_partner WHERE name=%s LIMIT 1", (p['name'],))
            existing = d.fetchone()
            if existing:
                partner_map[p['id']] = existing['id']
                log.info(f'  ~ res_partner[{p["id"]}] "{p["name"]}" — already on v19 (id={existing["id"]})')
                continue
            shared = cols_intersect(s, d, 'res_partner')
            shared.remove('id')
            shared = [c for c in shared if c != 'parent_path']
            extra = {'autopost_bills': 'never'}
            cols = shared + list(extra)
            placeholders = ','.join(['%s'] * len(cols))
            vals = [jsonify(p.get(c)) for c in shared] + list(extra.values())
            d.execute(f'INSERT INTO res_partner ({",".join(cols)}) VALUES ({placeholders}) RETURNING id', vals)
            new_id = d.fetchone()['id']
            partner_map[p['id']] = new_id
            log.info(f'  + res_partner[{p["id"]}] "{p["name"]}" → v19 id={new_id}')

        # ------------------------------------------------------------------
        # 2) account_payment_term + lines
        # ------------------------------------------------------------------
        log.info('--- account_payment_term ---')
        s.execute("SELECT * FROM account_payment_term ORDER BY id")
        v17terms = s.fetchall()
        term_map = {}
        # Match by english name on v19
        d.execute("SELECT id, name FROM account_payment_term")
        v19terms_by_name = {(r['name'].get('en_US') if isinstance(r['name'], dict) else r['name']): r['id']
                            for r in d.fetchall()}
        shared = cols_intersect(s, d, 'account_payment_term')
        shared.remove('id')
        for t in v17terms:
            nm_en = t['name'].get('en_US') if isinstance(t['name'], dict) else t['name']
            if nm_en in v19terms_by_name:
                term_map[t['id']] = v19terms_by_name[nm_en]
                log.info(f'  ~ payment_term[{t["id"]}] "{nm_en}" — already on v19 (id={v19terms_by_name[nm_en]})')
                continue
            cols = shared
            placeholders = ','.join(['%s'] * len(cols))
            vals = [jsonify(t.get(c)) for c in cols]
            d.execute(f'INSERT INTO account_payment_term ({",".join(cols)}) VALUES ({placeholders}) RETURNING id', vals)
            new_id = d.fetchone()['id']
            term_map[t['id']] = new_id
            log.info(f'  + payment_term[{t["id"]}] "{nm_en}" → v19 id={new_id}')

        # lines
        log.info('--- account_payment_term_line ---')
        line_shared = cols_intersect(s, d, 'account_payment_term_line')
        line_shared.remove('id')
        s.execute("SELECT * FROM account_payment_term_line ORDER BY payment_id, id")
        line_count = 0
        for ln in s.fetchall():
            if ln['payment_id'] not in term_map:
                continue
            new_term = term_map[ln['payment_id']]
            # only insert if v19 term doesn't already have lines (the matched stock ones do)
            d.execute("SELECT COUNT(*) AS c FROM account_payment_term_line WHERE payment_id=%s", (new_term,))
            if d.fetchone()['c'] > 0:
                continue
            row = dict(ln); row['payment_id'] = new_term
            cols = line_shared
            vals = [jsonify(row.get(c)) for c in cols]
            d.execute(f'INSERT INTO account_payment_term_line ({",".join(cols)}) VALUES ({",".join(["%s"]*len(cols))})', vals)
            line_count += 1
        log.info(f'  + payment_term_line: {line_count} rows')

        # ------------------------------------------------------------------
        # 3) platform_tenant_config — 3 rows, partner_id remapped
        # ------------------------------------------------------------------
        log.info('--- platform_tenant_config ---')
        ptc_shared = cols_intersect(s, d, 'platform_tenant_config')
        ptc_shared.remove('id')
        s.execute("SELECT * FROM platform_tenant_config ORDER BY id")
        for r in s.fetchall():
            new_partner = partner_map.get(r['partner_id'])
            if not new_partner:
                log.warning(f'  skip platform_tenant_config[{r["id"]}] — partner_id={r["partner_id"]} not mapped')
                continue
            d.execute("SELECT id FROM platform_tenant_config WHERE slug=%s", (r['slug'],))
            if d.fetchone():
                log.info(f'  ~ platform_tenant_config "{r["slug"]}" already exists')
                continue
            row = dict(r); row['partner_id'] = new_partner
            cols = ptc_shared
            vals = [jsonify(row.get(c)) for c in cols]
            d.execute(f'INSERT INTO platform_tenant_config ({",".join(cols)}) VALUES ({",".join(["%s"]*len(cols))})', vals)
            log.info(f'  + platform_tenant_config "{r["slug"]}" partner_id={new_partner}')

        # ------------------------------------------------------------------
        # 4) rbac_role / rbac_permission / rbac_role_permission_rel
        # ------------------------------------------------------------------
        log.info('--- rbac_role ---')
        role_map = {}
        role_shared = cols_intersect(s, d, 'rbac_role')
        role_shared.remove('id')
        s.execute("SELECT * FROM rbac_role ORDER BY id")
        for r in s.fetchall():
            d.execute("SELECT id FROM rbac_role WHERE code=%s LIMIT 1" if 'code' in role_shared else "SELECT id FROM rbac_role WHERE name=%s LIMIT 1",
                      (r.get('code') if 'code' in role_shared else r['name'],))
            existing = d.fetchone()
            if existing:
                role_map[r['id']] = existing['id']
                continue
            cols = role_shared; vals = [jsonify(r.get(c)) for c in cols]
            d.execute(f'INSERT INTO rbac_role ({",".join(cols)}) VALUES ({",".join(["%s"]*len(cols))}) RETURNING id', vals)
            role_map[r['id']] = d.fetchone()['id']
        log.info(f'  rbac_role map: {role_map}')

        log.info('--- rbac_permission ---')
        perm_map = {}
        perm_shared = cols_intersect(s, d, 'rbac_permission')
        perm_shared.remove('id')
        s.execute("SELECT * FROM rbac_permission ORDER BY id")
        for r in s.fetchall():
            d.execute("SELECT id FROM rbac_permission WHERE code=%s LIMIT 1", (r['code'],))
            existing = d.fetchone()
            if existing:
                perm_map[r['id']] = existing['id']
                continue
            cols = perm_shared; vals = [jsonify(r.get(c)) for c in cols]
            d.execute(f'INSERT INTO rbac_permission ({",".join(cols)}) VALUES ({",".join(["%s"]*len(cols))}) RETURNING id', vals)
            perm_map[r['id']] = d.fetchone()['id']
        log.info(f'  rbac_permission: {len(perm_map)} entries')

        log.info('--- rbac_role_permission_rel ---')
        s.execute("SELECT role_id, permission_id FROM rbac_role_permission_rel")
        rel_count = 0
        for r in s.fetchall():
            nr = role_map.get(r['role_id']); np = perm_map.get(r['permission_id'])
            if not nr or not np: continue
            d.execute("INSERT INTO rbac_role_permission_rel (role_id, permission_id) VALUES (%s,%s) ON CONFLICT DO NOTHING", (nr, np))
            rel_count += 1
        log.info(f'  + rbac_role_permission_rel: {rel_count} rows')

        log.info('--- rbac_url_pattern ---')
        url_map = {}
        url_shared = cols_intersect(s, d, 'rbac_url_pattern')
        url_shared.remove('id')
        s.execute("SELECT * FROM rbac_url_pattern ORDER BY id")
        for r in s.fetchall():
            d.execute("SELECT id FROM rbac_url_pattern WHERE url_pattern=%s LIMIT 1", (r['url_pattern'],))
            existing = d.fetchone()
            if existing:
                url_map[r['id']] = existing['id']
                continue
            cols = url_shared; vals = [jsonify(r.get(c)) for c in cols]
            d.execute(f'INSERT INTO rbac_url_pattern ({",".join(cols)}) VALUES ({",".join(["%s"]*len(cols))}) RETURNING id', vals)
            url_map[r['id']] = d.fetchone()['id']
        log.info(f'  rbac_url_pattern: {len(url_map)} entries')

        log.info('--- rbac_url_pattern_permission_rel ---')
        s.execute("SELECT pattern_id, permission_id FROM rbac_url_pattern_permission_rel")
        urel = 0
        for r in s.fetchall():
            nu = url_map.get(r['pattern_id']); np = perm_map.get(r['permission_id'])
            if not nu or not np: continue
            d.execute("INSERT INTO rbac_url_pattern_permission_rel (pattern_id, permission_id) VALUES (%s,%s) ON CONFLICT DO NOTHING", (nu, np))
            urel += 1
        log.info(f'  + rbac_url_pattern_permission_rel: {urel} rows')

        # ------------------------------------------------------------------
        # 5) artifact_deploy_template + steps
        # ------------------------------------------------------------------
        log.info('--- artifact_deploy_template ---')
        tmpl_map = {}
        tmpl_shared = cols_intersect(s, d, 'artifact_deploy_template')
        tmpl_shared.remove('id')
        s.execute("SELECT * FROM artifact_deploy_template ORDER BY id")
        for r in s.fetchall():
            d.execute("SELECT id FROM artifact_deploy_template WHERE name=%s LIMIT 1", (r['name'],))
            existing = d.fetchone()
            if existing:
                tmpl_map[r['id']] = existing['id']
                log.info(f'  ~ artifact_deploy_template "{r["name"]}" — already on v19')
                continue
            cols = tmpl_shared; vals = [jsonify(r.get(c)) for c in cols]
            d.execute(f'INSERT INTO artifact_deploy_template ({",".join(cols)}) VALUES ({",".join(["%s"]*len(cols))}) RETURNING id', vals)
            tmpl_map[r['id']] = d.fetchone()['id']
            log.info(f'  + artifact_deploy_template "{r["name"]}" → v19 id={tmpl_map[r["id"]]}')

        log.info('--- artifact_deploy_template_step ---')
        step_shared = cols_intersect(s, d, 'artifact_deploy_template_step')
        step_shared.remove('id')
        s.execute("SELECT * FROM artifact_deploy_template_step ORDER BY id")
        step_count = 0
        for r in s.fetchall():
            new_tmpl = tmpl_map.get(r['template_id'])
            if not new_tmpl: continue
            # skip if step already exists for this template (existing match)
            d.execute("SELECT id FROM artifact_deploy_template_step WHERE template_id=%s AND name=%s LIMIT 1",
                      (new_tmpl, r['name']))
            if d.fetchone():
                continue
            row = dict(r); row['template_id'] = new_tmpl
            cols = step_shared; vals = [jsonify(row.get(c)) for c in cols]
            d.execute(f'INSERT INTO artifact_deploy_template_step ({",".join(cols)}) VALUES ({",".join(["%s"]*len(cols))})', vals)
            step_count += 1
        log.info(f'  + artifact_deploy_template_step: {step_count} rows')

        # ------------------------------------------------------------------
        # 6) crm_lead — 5 demo leads
        # ------------------------------------------------------------------
        log.info('--- crm_lead ---')
        # Map by name; only common columns; remap partner_id, user_id, team_id, company_id, country_id, state_id
        s.execute("SELECT * FROM crm_lead ORDER BY id")
        lead_shared = cols_intersect(s, d, 'crm_lead')
        lead_shared.remove('id')
        # Drop columns that have FK we don't track (team_id maps to crm_team which exists 1:1 by name)
        team_map = {}
        s.execute("SELECT id, name FROM crm_team")
        for r in s.fetchall():
            tname = r['name'].get('en_US') if isinstance(r['name'], dict) else r['name']
            d.execute("SELECT id FROM crm_team WHERE name->>'en_US'=%s LIMIT 1", (tname,))
            t = d.fetchone()
            if t: team_map[r['id']] = t['id']
        s.execute("SELECT * FROM crm_lead ORDER BY id")
        lead_count = 0
        for r in s.fetchall():
            row = dict(r)
            if row.get('partner_id'): row['partner_id'] = partner_map.get(row['partner_id'])
            if row.get('team_id'):    row['team_id']    = team_map.get(row['team_id'])
            row['user_id'] = 2 if row.get('user_id') else None
            row['company_id'] = 1
            d.execute("SELECT id FROM crm_lead WHERE name=%s LIMIT 1", (row['name'],))
            if d.fetchone():
                continue
            cols = lead_shared
            vals = [jsonify(row.get(c)) for c in cols]
            try:
                d.execute(f'INSERT INTO crm_lead ({",".join(cols)}) VALUES ({",".join(["%s"]*len(cols))})', vals)
                lead_count += 1
            except Exception as e:
                log.warning(f'  skip crm_lead "{r["name"]}" — {str(e)[:100]}')
                d.execute('SAVEPOINT sp_crm; ROLLBACK TO SAVEPOINT sp_crm')
        log.info(f'  + crm_lead: {lead_count} rows')

        log.info('--- COMMIT ---')
        dc.commit()
        log.info('Phase 1 complete.')

    except Exception as e:
        log.exception(f'Phase 1 failed: {e!r}')
        dc.rollback()
        raise
    finally:
        s.close(); d.close(); sc.close(); dc.close()


if __name__ == '__main__':
    main()
