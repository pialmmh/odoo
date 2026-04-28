import { useEffect, useState, useMemo } from 'react';
import {
  tokens, Button, Field, Input, Textarea, Spinner,
  Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, DialogTrigger,
  Combobox, Option,
} from '@fluentui/react-components';
import {
  receiveStock, moveStock, issueStock,
  listWarehouses, listLocators, listBPartners, listCharges,
} from '../../../services/erpInventory';

// All dialogs share the same shape: minimal fields, no client-side validation
// beyond "is a number" — iDempiere is the validator. Errors come back from the
// BFF as { error, message } and are surfaced verbatim by the parent via onError.

const fieldRow = { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalM };

// ── Reusable picker bound to a list endpoint ─────────────────────────────
function PickerCombobox({ label, value, onChange, items, getId, getLabel, disabled, required }) {
  const selected = items.find((i) => String(getId(i)) === String(value));
  return (
    <Field label={label} required={required}>
      <Combobox
        disabled={disabled || items.length === 0}
        value={selected ? getLabel(selected) : ''}
        selectedOptions={value ? [String(value)] : []}
        onOptionSelect={(_e, d) => onChange(d.optionValue)}
      >
        {items.map((it) => (
          <Option key={getId(it)} value={String(getId(it))} text={getLabel(it)}>
            {getLabel(it)}
          </Option>
        ))}
      </Combobox>
    </Field>
  );
}

// ── Receive (Vendor IN) ─────────────────────────────────────────────────
// Used both when the product has no inventory rows yet (initial stock) and
// to add stock from a vendor. The user picks vendor + warehouse + locator
// + qty. iDempiere sets all the doctype/movement-type fields.
export function ReceiveStockDialog({ productId, defaultWarehouseId, defaultLocatorId, onClose, onSuccess, onError }) {
  const [warehouses, setWarehouses] = useState([]);
  const [locators, setLocators] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId ? String(defaultWarehouseId) : '');
  const [locatorId, setLocatorId] = useState(defaultLocatorId ? String(defaultLocatorId) : '');
  const [bpartnerId, setBpartnerId] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([listWarehouses(), listBPartners({ role: 'vendor' })])
      .then(([whs, bps]) => {
        if (!alive) return;
        setWarehouses(whs);
        setVendors(bps);
        if (!warehouseId && whs.length === 1) setWarehouseId(String(whs[0].id));
      })
      .catch((e) => onError?.(e?.response?.data?.message || e.message))
      .finally(() => { if (alive) setBootstrapping(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!warehouseId) { setLocators([]); return; }
    let alive = true;
    listLocators(warehouseId)
      .then((rows) => {
        if (!alive) return;
        setLocators(rows);
        if (!locatorId && rows.length > 0) {
          const def = rows.find((r) => r.isDefault) || rows[0];
          setLocatorId(String(def.id));
        }
      })
      .catch((e) => onError?.(e?.response?.data?.message || e.message));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId]);

  const submit = async () => {
    setSaving(true);
    try {
      const result = await receiveStock({
        productId,
        locatorId: Number(locatorId),
        bpartnerId: Number(bpartnerId),
        qty: Number(qty),
        description: reason || null,
      });
      onSuccess?.(result);
    } catch (e) {
      onError?.(e?.response?.data?.message || e.message || 'Receipt failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(_e, d) => { if (!d.open) onClose?.(); }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Receive goods</DialogTitle>
          <DialogContent>
            {bootstrapping ? <div style={{ textAlign: 'center', padding: 24 }}><Spinner /></div> : (
              <div style={fieldRow}>
                <PickerCombobox label="Vendor" required value={bpartnerId} onChange={setBpartnerId}
                  items={vendors} getId={(v) => v.id}
                  getLabel={(v) => `${v.name}${v.value ? ` (${v.value})` : ''}`}
                  disabled={saving} />
                <PickerCombobox label="Warehouse" required value={warehouseId} onChange={(v) => { setWarehouseId(v); setLocatorId(''); }}
                  items={warehouses} getId={(w) => w.id} getLabel={(w) => w.name} disabled={saving} />
                <PickerCombobox label="Locator" required value={locatorId} onChange={setLocatorId}
                  items={locators} getId={(l) => l.id}
                  getLabel={(l) => `${l.value || `${l.x}-${l.y}-${l.z}`} (on hand: ${l.qtyOnHand})`}
                  disabled={saving || !warehouseId} />
                <Field label="Quantity received" required>
                  <Input type="number" value={qty} onChange={(_e, d) => setQty(d.value)} disabled={saving} autoFocus />
                </Field>
                <Field label="Reference / note (optional)">
                  <Textarea value={reason} onChange={(_e, d) => setReason(d.value)} rows={2} disabled={saving} />
                </Field>
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" disabled={saving}>Cancel</Button>
            </DialogTrigger>
            <Button appearance="primary" onClick={submit}
              disabled={saving || bootstrapping || !bpartnerId || !locatorId || !qty}>
              {saving ? 'Posting…' : 'Post receipt'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

// ── Move (Internal Movement) ────────────────────────────────────────────
export function MoveStockDialog({ productId, fromRow, onClose, onSuccess, onError }) {
  const [warehouses, setWarehouses] = useState([]);
  const [locators, setLocators] = useState([]);
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [toLocatorId, setToLocatorId] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  const fromQty = useMemo(() => Number(fromRow.qtyonhand || 0), [fromRow]);

  useEffect(() => {
    let alive = true;
    listWarehouses()
      .then((whs) => { if (alive) setWarehouses(whs); })
      .catch((e) => onError?.(e?.response?.data?.message || e.message))
      .finally(() => { if (alive) setBootstrapping(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toWarehouseId) { setLocators([]); return; }
    let alive = true;
    listLocators(toWarehouseId)
      .then((rows) => {
        if (!alive) return;
        // Don't allow moving to the same locator
        setLocators(rows.filter((l) => l.id !== fromRow.m_locator_id));
      })
      .catch((e) => onError?.(e?.response?.data?.message || e.message));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toWarehouseId]);

  const submit = async () => {
    setSaving(true);
    try {
      const result = await moveStock({
        productId,
        fromLocatorId: fromRow.m_locator_id,
        toLocatorId: Number(toLocatorId),
        qty: Number(qty),
        description: reason || null,
      });
      onSuccess?.(result);
    } catch (e) {
      onError?.(e?.response?.data?.message || e.message || 'Move failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(_e, d) => { if (!d.open) onClose?.(); }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Move stock</DialogTitle>
          <DialogContent>
            {bootstrapping ? <div style={{ textAlign: 'center', padding: 24 }}><Spinner /></div> : (
              <div style={fieldRow}>
                <div>
                  <div style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>From</div>
                  <div>{fromRow.m_locator_id_display || `#${fromRow.m_locator_id}`} (on hand: {fromQty})</div>
                </div>
                <PickerCombobox label="Destination warehouse" required value={toWarehouseId}
                  onChange={(v) => { setToWarehouseId(v); setToLocatorId(''); }}
                  items={warehouses} getId={(w) => w.id} getLabel={(w) => w.name} disabled={saving} />
                <PickerCombobox label="Destination locator" required value={toLocatorId} onChange={setToLocatorId}
                  items={locators} getId={(l) => l.id}
                  getLabel={(l) => `${l.value || `${l.x}-${l.y}-${l.z}`} (on hand: ${l.qtyOnHand})`}
                  disabled={saving || !toWarehouseId} />
                <Field label="Quantity to move" required>
                  <Input type="number" value={qty} onChange={(_e, d) => setQty(d.value)} disabled={saving} autoFocus />
                </Field>
                <Field label="Reason (optional)">
                  <Textarea value={reason} onChange={(_e, d) => setReason(d.value)} rows={2} disabled={saving} />
                </Field>
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" disabled={saving}>Cancel</Button>
            </DialogTrigger>
            <Button appearance="primary" onClick={submit}
              disabled={saving || bootstrapping || !toLocatorId || !qty}>
              {saving ? 'Posting…' : 'Post movement'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

// ── Issue (Internal Use / Scrap) ────────────────────────────────────────
export function IssueStockDialog({ productId, row, onClose, onSuccess, onError }) {
  const [charges, setCharges] = useState([]);
  const [chargeId, setChargeId] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const fromQty = Number(row.qtyonhand || 0);

  useEffect(() => {
    let alive = true;
    listCharges()
      .then((cs) => { if (alive) setCharges(cs); })
      .catch(() => { /* picker is optional — backend defaults to first */ });
    return () => { alive = false; };
  }, []);

  const submit = async () => {
    setSaving(true);
    try {
      const result = await issueStock({
        productId,
        locatorId: row.m_locator_id,
        qty: Number(qty),
        chargeId: chargeId ? Number(chargeId) : 0,
        description: reason || null,
      });
      onSuccess?.(result);
    } catch (e) {
      onError?.(e?.response?.data?.message || e.message || 'Issue failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(_e, d) => { if (!d.open) onClose?.(); }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Issue / scrap stock</DialogTitle>
          <DialogContent>
            <div style={fieldRow}>
              <div>
                <div style={{ fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 }}>Locator</div>
                <div>{row.m_locator_id_display || `#${row.m_locator_id}`} (on hand: {fromQty})</div>
              </div>
              <Field label="Quantity to issue" required hint="Used for scrap, internal consumption, write-off.">
                <Input type="number" value={qty} onChange={(_e, d) => setQty(d.value)} disabled={saving} autoFocus />
              </Field>
              <PickerCombobox label="Charge / cost account" value={chargeId} onChange={setChargeId}
                items={charges} getId={(c) => c.id} getLabel={(c) => c.name} disabled={saving} />
              <Field label="Reason (optional)">
                <Textarea value={reason} onChange={(_e, d) => setReason(d.value)} rows={2} disabled={saving} />
              </Field>
            </div>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" disabled={saving}>Cancel</Button>
            </DialogTrigger>
            <Button appearance="primary" onClick={submit} disabled={saving || !qty}>
              {saving ? 'Posting…' : 'Post issue'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
