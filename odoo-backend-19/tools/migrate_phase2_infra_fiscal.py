"""
Phase 2 — infra_management module + fiscal positions.

Tables (in dependency order):
  infra_region, infra_os_family, infra_device_attribute, infra_ssh_key,
  infra_availability_zone, infra_os_version,
  infra_device_model, infra_device_model_attribute_rel,
  infra_storage, infra_networking, infra_datacenter, infra_resource_pool,
  infra_network_device, infra_network_device_attribute_rel,
  infra_compute, infra_container, infra_ip_address, infra_ssh_credential,
  account_fiscal_position, account_fiscal_position_tax.
"""
import logging
import psycopg2
import psycopg2.extras

logging.basicConfig(level=logging.INFO, format='%(levelname)-7s %(message)s')
log = logging.getLogger('phase2')
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


def migrate_table(s, d, table, name_col='name', extra_remap=None, log_label=None):
    """
    Generic copy: for each v17 row, look up v19 row with same `name_col`. If
    exists, map id; else INSERT with shared columns + extra_remap.

    Uses per-row savepoints so a single failing row doesn't roll back the
    whole transaction.

    Returns (id_map, n_added).
    """
    label = log_label or table
    shared = cols_intersect(s, d, table)
    shared.remove('id')
    s.execute(f'SELECT * FROM {table} ORDER BY id')
    rows = s.fetchall()
    id_map = {}
    n_added = n_existing = n_skip = 0
    for r in rows:
        if name_col and name_col in shared:
            d.execute(f'SELECT id FROM {table} WHERE {name_col}=%s LIMIT 1', (r[name_col],))
            existing = d.fetchone()
            if existing:
                id_map[r['id']] = existing['id']
                n_existing += 1
                continue
        row = dict(r)
        if extra_remap:
            for col, fn in extra_remap.items():
                row[col] = fn(row)
        cols = shared
        vals = [jsonify(row.get(c)) for c in cols]
        sp = f'sp_{table}_{r["id"]}'
        d.execute(f'SAVEPOINT {sp}')
        try:
            d.execute(f'INSERT INTO {table} ({",".join(cols)}) VALUES ({",".join(["%s"]*len(cols))}) RETURNING id', vals)
            id_map[r['id']] = d.fetchone()['id']
            n_added += 1
            d.execute(f'RELEASE SAVEPOINT {sp}')
        except Exception as e:
            d.execute(f'ROLLBACK TO SAVEPOINT {sp}')
            d.execute(f'RELEASE SAVEPOINT {sp}')
            log.warning(f'  skip {table}[{r["id"]}] {row.get(name_col)}: {str(e)[:120]}')
            n_skip += 1
    log.info(f'  {label}: +{n_added} new, ~{n_existing} matched, !{n_skip} skipped')
    return id_map, n_added


def main():
    sc = psycopg2.connect(dbname='odoo_billing', **DSN_KW)
    dc = psycopg2.connect(dbname='odoo_billing_19', **DSN_KW)
    dc.autocommit = False
    s = sc.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    d = dc.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Pre-built maps (from Phase 0 / Phase 1)
    s.execute("SELECT id, name FROM res_partner WHERE id IN (1,7,8)")
    v17_partners = {r['id']: r['name'] for r in s.fetchall()}
    partner_map = {}
    for pid, pname in v17_partners.items():
        d.execute("SELECT id FROM res_partner WHERE name=%s LIMIT 1", (pname,))
        r = d.fetchone()
        if r: partner_map[pid] = r['id']

    try:

        # 1. region (no FKs)
        log.info('--- infra_region ---')
        region_map, _ = migrate_table(s, d, 'infra_region')

        # 2. os_family (no FKs)
        log.info('--- infra_os_family ---')
        osf_map, _ = migrate_table(s, d, 'infra_os_family')

        # 3. device_attribute (no FKs)
        log.info('--- infra_device_attribute ---')
        attr_map, _ = migrate_table(s, d, 'infra_device_attribute')

        # 4. ssh_key (no FKs)
        log.info('--- infra_ssh_key ---')
        sshkey_map, _ = migrate_table(s, d, 'infra_ssh_key')

        # 5. availability_zone → region
        log.info('--- infra_availability_zone ---')
        az_map, _ = migrate_table(s, d, 'infra_availability_zone',
            extra_remap={'region_id': lambda r: region_map.get(r['region_id'])})

        # 6. os_version → os_family
        log.info('--- infra_os_version ---')
        osv_map, _ = migrate_table(s, d, 'infra_os_version', name_col='display_name',
            extra_remap={'family_id': lambda r: osf_map.get(r['family_id'])})

        # 7. device_model
        log.info('--- infra_device_model ---')
        model_map, _ = migrate_table(s, d, 'infra_device_model')

        # 8. networking — needs datacenter; defer until after datacenter
        # 9. storage — needs datacenter; defer

        # 10. datacenter → zone (AZ), region, partner
        log.info('--- infra_datacenter ---')
        dc_map, _ = migrate_table(s, d, 'infra_datacenter',
            extra_remap={
                'zone_id':    lambda r: az_map.get(r['zone_id']),
                'region_id':  lambda r: region_map.get(r['region_id']),
                'partner_id': lambda r: partner_map.get(r['partner_id']),
            })

        # 11. resource_pool → datacenter
        log.info('--- infra_resource_pool ---')
        pool_map, _ = migrate_table(s, d, 'infra_resource_pool',
            extra_remap={'datacenter_id': lambda r: dc_map.get(r['datacenter_id'])})

        # 12. networking → datacenter
        log.info('--- infra_networking ---')
        net_map, _ = migrate_table(s, d, 'infra_networking',
            extra_remap={'datacenter_id': lambda r: dc_map.get(r['datacenter_id'])})

        # 13. storage → datacenter
        log.info('--- infra_storage ---')
        sto_map, _ = migrate_table(s, d, 'infra_storage',
            extra_remap={'datacenter_id': lambda r: dc_map.get(r['datacenter_id'])})

        # 14. network_device → device_model, datacenter
        log.info('--- infra_network_device ---')
        netdev_map, _ = migrate_table(s, d, 'infra_network_device',
            extra_remap={
                'device_model_id': lambda r: model_map.get(r['device_model_id']),
                'datacenter_id':   lambda r: dc_map.get(r['datacenter_id']),
            })

        # 15-16. m2m rels
        log.info('--- infra_device_model_attribute_rel ---')
        s.execute('SELECT * FROM infra_device_model_attribute_rel')
        n=0
        for r in s.fetchall():
            nm = model_map.get(r['model_id']); na = attr_map.get(r['attribute_id'])
            if not nm or not na: continue
            d.execute("INSERT INTO infra_device_model_attribute_rel (model_id, attribute_id) VALUES (%s,%s) ON CONFLICT DO NOTHING", (nm, na)); n+=1
        log.info(f'  +{n} m2m rows')

        log.info('--- infra_network_device_attribute_rel ---')
        s.execute('SELECT * FROM infra_network_device_attribute_rel')
        n=0
        for r in s.fetchall():
            nd = netdev_map.get(r['device_id']); na = attr_map.get(r['attribute_id'])
            if not nd or not na: continue
            d.execute("INSERT INTO infra_network_device_attribute_rel (device_id, attribute_id) VALUES (%s,%s) ON CONFLICT DO NOTHING", (nd, na)); n+=1
        log.info(f'  +{n} m2m rows')

        # 17. compute → datacenter, pool, os_version
        log.info('--- infra_compute ---')
        compute_map, _ = migrate_table(s, d, 'infra_compute', name_col='hostname',
            extra_remap={
                'datacenter_id':  lambda r: dc_map.get(r['datacenter_id']),
                'pool_id':        lambda r: pool_map.get(r['pool_id']),
                'os_version_id':  lambda r: osv_map.get(r['os_version_id']),
            })

        # 18. container → compute
        log.info('--- infra_container ---')
        container_map, _ = migrate_table(s, d, 'infra_container',
            extra_remap={'compute_id': lambda r: compute_map.get(r['compute_id'])})

        # 19. ip_address → compute, network_device, container, vlan (→ networking)
        log.info('--- infra_ip_address ---')
        ip_map, _ = migrate_table(s, d, 'infra_ip_address', name_col='ip_address',
            extra_remap={
                'compute_id':        lambda r: compute_map.get(r['compute_id']),
                'network_device_id': lambda r: netdev_map.get(r['network_device_id']),
                'container_id':      lambda r: container_map.get(r['container_id']),
                'vlan_id':           lambda r: net_map.get(r['vlan_id']),
            })

        # 20. ssh_credential → compute, network_device, key
        log.info('--- infra_ssh_credential ---')
        ssh_map, _ = migrate_table(s, d, 'infra_ssh_credential',
            extra_remap={
                'compute_id':        lambda r: compute_map.get(r['compute_id']),
                'network_device_id': lambda r: netdev_map.get(r['network_device_id']),
                'key_id':            lambda r: sshkey_map.get(r['key_id']),
            })

        # ----------------------------------------------------------------
        # account_fiscal_position + _tax
        # ----------------------------------------------------------------
        log.info('--- account_fiscal_position ---')
        # Match by name->>'en_US'; v19 likely already has 'National', 'International'
        s.execute("SELECT * FROM account_fiscal_position ORDER BY id")
        v17fp = s.fetchall()
        fp_shared = cols_intersect(s, d, 'account_fiscal_position')
        fp_shared.remove('id')
        fp_map = {}
        for fp in v17fp:
            nm = fp['name'].get('en_US') if isinstance(fp['name'], dict) else fp['name']
            d.execute("SELECT id FROM account_fiscal_position WHERE name->>'en_US'=%s LIMIT 1", (nm,))
            existing = d.fetchone()
            if existing:
                fp_map[fp['id']] = existing['id']
                log.info(f'  ~ fiscal_position "{nm}" already on v19 (id={existing["id"]})')
                continue
            row = dict(fp); row['company_id'] = 1
            cols = fp_shared; vals = [jsonify(row.get(c)) for c in cols]
            d.execute(f'INSERT INTO account_fiscal_position ({",".join(cols)}) VALUES ({",".join(["%s"]*len(cols))}) RETURNING id', vals)
            fp_map[fp['id']] = d.fetchone()['id']
            log.info(f'  + fiscal_position "{nm}" → v19 id={fp_map[fp["id"]]}')

        # account_fiscal_position_tax (v17) is gone in v19. v19 replaced it with
        # `account_fiscal_position_account_tax_rel(fiscal_position_id, tax_id)` — a
        # plain m2m of "applicable taxes" with no src→dst mapping. We skip the v17
        # tax-substitution rules; they're a different model now.
        log.info('--- account_fiscal_position_tax: SKIPPED (v19 model redesigned) ---')

        log.info('--- COMMIT ---')
        dc.commit()
        log.info('Phase 2 complete.')
    except Exception as e:
        log.exception(f'Phase 2 failed: {e!r}')
        dc.rollback()
        raise
    finally:
        s.close(); d.close(); sc.close(); dc.close()


if __name__ == '__main__':
    main()
