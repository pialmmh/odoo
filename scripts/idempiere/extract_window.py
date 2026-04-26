#!/usr/bin/env python3
"""
Extract an iDempiere AD_Window into the JSON shape used by the React clones
(matches ui/src/pages/erp/m_product_window.json).

Usage:
  scripts/idempiere/extract_window.py <ad_window_id> [out_path]

Connects to localhost:5433 / idempiere / adempiere via PGPASSWORD or .pgpass.
"""
import json
import os
import subprocess
import sys


def psql(sql: str) -> str:
    env = {**os.environ, "PGPASSWORD": os.environ.get("PGPASSWORD", "adempiere")}
    cmd = [
        "psql", "-h", "localhost", "-p", "5433",
        "-U", "adempiere", "-d", "idempiere",
        "-At", "-X", "-q", "-c", sql,
    ]
    res = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if res.returncode != 0:
        sys.exit(f"psql failed: {res.stderr}")
    return res.stdout


SQL = r"""
WITH fields AS (
  SELECT
    f.ad_tab_id,
    jsonb_build_object(
      'seqno',             COALESCE(f.seqno, 0),
      'label',             f.name,
      'columnName',        c.columnname,
      'reference',         r.name,
      'isMandatory',       CASE
                             WHEN COALESCE(f.ismandatory, c.ismandatory) = 'Y'
                             THEN 'Y' ELSE 'N'
                           END,
      'isUpdateable',      COALESCE(c.isupdateable, 'N'),
      'fieldLength',       COALESCE(f.displaylength, c.fieldlength, 0),
      'defaultValue',      COALESCE(f.defaultvalue, c.defaultvalue),
      'callout',           c.callout,
      'valRuleId',         COALESCE(f.ad_val_rule_id, c.ad_val_rule_id),
      'isDisplayed',       COALESCE(f.isdisplayed, 'N'),
      'isDisplayedGrid',   COALESCE(f.isdisplayedgrid, 'N'),
      'seqNoGrid',         COALESCE(f.seqnogrid, 0),
      'displayLogic',      f.displaylogic,
      'readOnlyLogic',     c.readonlylogic,
      'columnSpan',        2,
      'isSameLine',        COALESCE(f.issameline, 'N'),
      'isIdentifier',      COALESCE(c.isidentifier, 'N'),
      'isSelectionColumn', COALESCE(c.isselectioncolumn, 'N'),
      'fieldGroup',        fg.name
    ) AS field
  FROM ad_field f
  JOIN ad_column c    ON c.ad_column_id = f.ad_column_id
  JOIN ad_reference r ON r.ad_reference_id = COALESCE(f.ad_reference_id, c.ad_reference_id)
  LEFT JOIN ad_fieldgroup fg ON fg.ad_fieldgroup_id = f.ad_fieldgroup_id
  WHERE f.isactive = 'Y'
),
tabs AS (
  SELECT
    t.seqno AS tab_seqno,
    jsonb_build_object(
      'seqno',       t.seqno,
      'name',        t.name,
      'tableName',   tab.tablename,
      'tableLevel',  t.tablevel,
      'isReadOnly',  COALESCE(t.isreadonly, 'N'),
      'isSingleRow', COALESCE(t.issinglerow, 'Y'),
      'fields', COALESCE((
        SELECT jsonb_agg(field ORDER BY (field->>'seqno')::int, field->>'columnName')
        FROM fields WHERE ad_tab_id = t.ad_tab_id
      ), '[]'::jsonb)
    ) AS tab_obj
  FROM ad_tab t
  JOIN ad_table tab ON tab.ad_table_id = t.ad_table_id
  WHERE t.ad_window_id = {wid} AND t.isactive = 'Y'
)
SELECT to_jsonb(jsonb_build_object(
  'window',   (SELECT name FROM ad_window WHERE ad_window_id = {wid}),
  'windowId', {wid},
  'tabs',     (SELECT jsonb_agg(tab_obj ORDER BY tab_seqno) FROM tabs)
));
"""


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    wid = int(sys.argv[1])
    out_path = sys.argv[2] if len(sys.argv) > 2 else None
    raw = psql(SQL.format(wid=wid))
    obj = json.loads(raw)
    pretty = json.dumps(obj, indent=4)
    if out_path:
        with open(out_path, "w") as fh:
            fh.write(pretty + "\n")
        print(f"wrote {len(pretty):,} bytes to {out_path}")
    else:
        print(pretty)


if __name__ == "__main__":
    main()
