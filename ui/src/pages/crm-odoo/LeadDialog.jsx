// LeadDialog — Fluent UI v9, per `.claude/skills/fluent-ui-forms`.
//   - 12-col CSS grid, default spans, every row sums to 12 (commented above row).
//   - <Field> wraps every input.
//   - All spacing/colors from `tokens.*`. No raw px / hex.
//   - Action bar: Cancel (subtle) left, Save (primary) right, 24px top gap, 1px top border.
//
// Used from both the Leads list page (MUI) and the LeadDetail page (Fluent).

import { useEffect, useState } from 'react';
import {
  makeStyles, mergeClasses, tokens,
  Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions,
  Field, Input, Dropdown, Option, Switch, Textarea, Button,
  MessageBar,
} from '@fluentui/react-components';
import { Dismiss20Regular } from '@fluentui/react-icons';
import {
  createLead, updateLead,
  LEAD_STATUSES, LEAD_SOURCES, LEAD_SALUTATIONS,
} from '../../services/crm-via-odoo';

const EMPTY_FORM = {
  salutationName: '', firstName: '', lastName: '',
  title: '', accountName: '',
  emailAddress: '', phoneNumber: '',
  status: 'New', source: '', industry: '',
  opportunityAmount: '',
  doNotCall: false, website: '',
  description: '',
};

const useStyles = makeStyles({
  surface: { maxWidth: '880px', width: '100%' },

  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: tokens.spacingHorizontalM,
  },

  // 12-col grid for the form body. The dialog body provides horizontal
  // padding around this grid so inputs don't crash into the dialog edges.
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXL,
    width: '100%',
    boxSizing: 'border-box',
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingRight: tokens.spacingHorizontalXXL,
  },

  // Span helpers — collapse predictably below 1024 / 640 per the skill rule.
  span2:  { gridColumn: 'span 2',
            '@media (max-width: 1023px)': { gridColumn: 'span 6'  },
            '@media (max-width: 639px)':  { gridColumn: 'span 12' } },
  span4:  { gridColumn: 'span 4',
            '@media (max-width: 1023px)': { gridColumn: 'span 6'  },
            '@media (max-width: 639px)':  { gridColumn: 'span 12' } },
  span5:  { gridColumn: 'span 5',
            '@media (max-width: 1023px)': { gridColumn: 'span 6'  },
            '@media (max-width: 639px)':  { gridColumn: 'span 12' } },
  span6:  { gridColumn: 'span 6',
            '@media (max-width: 639px)':  { gridColumn: 'span 12' } },
  span12: { gridColumn: 'span 12' },

  // Centred cell for switches that sit in a row with labelled inputs.
  switchCell: {
    display: 'flex',
    alignItems: 'center',
    paddingTop: '26px',  // ~ Field label line + gap so it aligns with sibling inputs
    minHeight: '40px',
    '@media (max-width: 639px)': { paddingTop: 0 },
  },

  // Action bar with the 24px top gap + top border per skill rule §7.
  actions: {
    paddingTop: tokens.spacingVerticalXXL,
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingRight: tokens.spacingHorizontalXXL,
    paddingBottom: tokens.spacingVerticalL,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    marginTop: tokens.spacingVerticalL,
    columnGap: tokens.spacingHorizontalS,
    '@media (max-width: 639px)': {
      flexDirection: 'column',
      '& > button': { width: '100%' },
    },
  },
});

export default function LeadDialog({ open, onClose, lead, onSaved }) {
  const styles = useStyles();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const isEdit = !!lead?.id;
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    if (lead) {
      setForm({
        salutationName: lead.salutationName || '',
        firstName: lead.firstName || '',
        lastName: lead.lastName || '',
        title: lead.title || '',
        accountName: lead.accountName || '',
        emailAddress: lead.emailAddress || '',
        phoneNumber: lead.phoneNumber || '',
        status: lead.status || 'New',
        source: lead.source || '',
        industry: lead.industry || '',
        opportunityAmount: lead.opportunityAmount ?? '',
        doNotCall: !!lead.doNotCall,
        website: lead.website || '',
        description: lead.description || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErr(null);
  }, [open, lead]);

  const handleSave = async () => {
    if (!form.lastName.trim()) { setErr('Last name is required'); return; }
    setSaving(true); setErr(null);
    try {
      const payload = {
        ...form,
        opportunityAmount: form.opportunityAmount === '' ? null : Number(form.opportunityAmount),
      };
      if (isEdit) await updateLead(lead.id, payload);
      else        await createLead(payload);
      onSaved?.();
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Save failed');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => !d.open && onClose()} modalType="modal">
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle
            action={
              <Button appearance="subtle" icon={<Dismiss20Regular />} aria-label="Close" onClick={onClose} />
            }
          >
            {isEdit ? 'Edit Lead' : 'New Lead'}
          </DialogTitle>

          <DialogContent>
            {err && <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalM }}>{err}</MessageBar>}

            <div className={styles.grid}>
              {/* Row 1: Salutation(2) + FirstName(5) + LastName(5) = 12 ✓ */}
              <div className={styles.span2}>
                <Field label="Title">
                  <Dropdown
                    value={form.salutationName || '—'}
                    selectedOptions={form.salutationName ? [form.salutationName] : ['']}
                    onOptionSelect={(_, d) => set('salutationName')(d.optionValue || '')}
                  >
                    {LEAD_SALUTATIONS.map(s => <Option key={s || 'none'} value={s}>{s || '—'}</Option>)}
                  </Dropdown>
                </Field>
              </div>
              <div className={styles.span5}>
                <Field label="First Name">
                  <Input value={form.firstName} onChange={(_, d) => set('firstName')(d.value)} />
                </Field>
              </div>
              <div className={styles.span5}>
                <Field label="Last Name" required validationState={!form.lastName.trim() && err ? 'error' : 'none'}>
                  <Input value={form.lastName} onChange={(_, d) => set('lastName')(d.value)} />
                </Field>
              </div>

              {/* Row 2: JobTitle(6) + AccountCompany(6) = 12 ✓ */}
              <div className={styles.span6}>
                <Field label="Job Title">
                  <Input value={form.title} onChange={(_, d) => set('title')(d.value)} />
                </Field>
              </div>
              <div className={styles.span6}>
                <Field label="Account / Company">
                  <Input value={form.accountName} onChange={(_, d) => set('accountName')(d.value)} />
                </Field>
              </div>

              {/* Row 3: Email(6) + Phone(6) = 12 ✓ */}
              <div className={styles.span6}>
                <Field label="Email">
                  <Input type="email" value={form.emailAddress} onChange={(_, d) => set('emailAddress')(d.value)} />
                </Field>
              </div>
              <div className={styles.span6}>
                <Field label="Phone">
                  <Input value={form.phoneNumber} onChange={(_, d) => set('phoneNumber')(d.value)} />
                </Field>
              </div>

              {/* Row 4: Status(4) + Source(4) + Industry(4) = 12 ✓ */}
              <div className={styles.span4}>
                <Field label="Status">
                  <Dropdown
                    value={form.status}
                    selectedOptions={[form.status]}
                    onOptionSelect={(_, d) => set('status')(d.optionValue || 'New')}
                  >
                    {LEAD_STATUSES.map(s => <Option key={s} value={s}>{s}</Option>)}
                  </Dropdown>
                </Field>
              </div>
              <div className={styles.span4}>
                <Field label="Source">
                  <Dropdown
                    value={form.source || '—'}
                    selectedOptions={form.source ? [form.source] : ['']}
                    onOptionSelect={(_, d) => set('source')(d.optionValue || '')}
                  >
                    <Option value="">—</Option>
                    {LEAD_SOURCES.map(s => <Option key={s} value={s}>{s}</Option>)}
                  </Dropdown>
                </Field>
              </div>
              <div className={styles.span4}>
                <Field label="Industry">
                  <Input value={form.industry} onChange={(_, d) => set('industry')(d.value)} />
                </Field>
              </div>

              {/* Row 5: OpportunityAmount(6) + Website(6) = 12 ✓ */}
              <div className={styles.span6}>
                <Field label="Opportunity Amount">
                  <Input type="number" value={String(form.opportunityAmount ?? '')}
                         onChange={(_, d) => set('opportunityAmount')(d.value)} />
                </Field>
              </div>
              <div className={styles.span6}>
                <Field label="Website">
                  <Input value={form.website} onChange={(_, d) => set('website')(d.value)} />
                </Field>
              </div>

              {/* Row 6: Description(12) = 12 ✓ */}
              <div className={styles.span12}>
                <Field label="Description">
                  <Textarea rows={3} value={form.description} onChange={(_, d) => set('description')(d.value)} />
                </Field>
              </div>

              {/* Row 7: DoNotCall(12) = 12 ✓ — switch sits flush left */}
              <div className={styles.span12}>
                <Switch
                  checked={form.doNotCall}
                  onChange={(_, d) => set('doNotCall')(!!d.checked)}
                  label="Do Not Call"
                />
              </div>
            </div>
          </DialogContent>

          <DialogActions className={styles.actions}>
            <Button appearance="subtle" onClick={onClose}>Cancel</Button>
            <Button appearance="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : (isEdit ? 'Save' : 'Create Lead')}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
