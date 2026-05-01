// Generic Fluent v9 dialog driven by a `rows` config:
//   rows: [
//     [{ key, label, type: 'text'|'email'|'tel'|'number'|'select'|'switch'|'textarea',
//        span: 2|3|4|5|6|12, required?, options?[], placeholder? }, ...],
//     ...
//   ]
// Every row must sum to 12 (per the Fluent skill). Caller validates.

import { useEffect, useState } from 'react';
import {
  Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions,
  Field, Input, Dropdown, Option, Switch, Textarea, Button, MessageBar,
} from '@fluentui/react-components';
import { Dismiss20Regular } from '@fluentui/react-icons';
import { useDialogStyles } from './styles';

const SPAN_CLASS = {
  2: 'span2', 3: 'span3', 4: 'span4', 5: 'span5', 6: 'span6', 12: 'span12',
};

export default function EntityDialog({
  open, onClose,
  title,                 // 'Edit Lead' | 'New Lead'
  saveLabel = 'Save',
  rows = [],             // see header comment
  initialValue,          // initial form state (object)
  emptyValue,            // factory or object — used when initialValue is null
  validate,              // (value) => string | null  — return error message
  onSave,                // async (value) => void  — throws on failure
}) {
  const styles = useDialogStyles();
  const [form, setForm] = useState(emptyValue || {});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm(initialValue || (typeof emptyValue === 'function' ? emptyValue() : { ...(emptyValue || {}) }));
    setErr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValue]);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (validate) {
      const v = validate(form);
      if (v) { setErr(v); return; }
    }
    setSaving(true); setErr(null);
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Save failed');
    }
    setSaving(false);
  };

  const renderField = (f) => {
    const key = f.key;
    const val = form[key] ?? '';
    switch (f.type) {
      case 'select': {
        const value = String(val ?? '');
        const display = (f.options.find(o => String(o.value) === value)?.label) ?? (value || (f.placeholder || '—'));
        return (
          <Field label={f.label} required={f.required}>
            <Dropdown
              value={display}
              selectedOptions={[value]}
              onOptionSelect={(_, d) => set(key)(d.optionValue ?? '')}
            >
              {f.allowEmpty && <Option value="">—</Option>}
              {f.options.map(o => (
                <Option key={String(o.value)} value={String(o.value)}>{o.label}</Option>
              ))}
            </Dropdown>
          </Field>
        );
      }
      case 'switch':
        return (
          <Switch checked={!!val} label={f.label}
                  onChange={(_, d) => set(key)(!!d.checked)} />
        );
      case 'textarea':
        return (
          <Field label={f.label} required={f.required}>
            <Textarea rows={f.rows || 3} value={String(val)} onChange={(_, d) => set(key)(d.value)} />
          </Field>
        );
      case 'number':
        return (
          <Field label={f.label} required={f.required}>
            <Input type="number" value={String(val ?? '')}
                   onChange={(_, d) => set(key)(d.value)} />
          </Field>
        );
      case 'email':
        return (
          <Field label={f.label} required={f.required}>
            <Input type="email" value={String(val)} onChange={(_, d) => set(key)(d.value)} />
          </Field>
        );
      case 'tel':
        return (
          <Field label={f.label} required={f.required}>
            <Input type="tel" value={String(val)} onChange={(_, d) => set(key)(d.value)} />
          </Field>
        );
      case 'date':
        return (
          <Field label={f.label} required={f.required}>
            <Input type="date" value={String(val ?? '')} onChange={(_, d) => set(key)(d.value)} />
          </Field>
        );
      case 'text':
      default:
        return (
          <Field label={f.label} required={f.required}>
            <Input value={String(val)} onChange={(_, d) => set(key)(d.value)} />
          </Field>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()} modalType="modal">
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle action={
            <Button appearance="subtle" icon={<Dismiss20Regular />} aria-label="Close" onClick={onClose} />
          }>
            {title}
          </DialogTitle>

          <DialogContent>
            {err && <MessageBar intent="error">{err}</MessageBar>}
            <div className={styles.grid}>
              {rows.map((row, i) =>
                row.map((f, j) => (
                  <div key={`${i}-${j}-${f.key}`} className={styles[SPAN_CLASS[f.span] || 'span6']}>
                    {renderField(f)}
                  </div>
                ))
              )}
            </div>
          </DialogContent>

          <DialogActions className={styles.actions}>
            <Button appearance="subtle" onClick={onClose}>Cancel</Button>
            <Button appearance="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : saveLabel}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
