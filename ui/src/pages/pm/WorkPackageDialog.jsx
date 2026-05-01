// Work Package create/edit dialog — Fluent UI v9.
// 12-col grid, every row sums to 12.
// Uses form schema from OpenProject to determine available statuses/types.

import { useEffect, useState } from 'react';
import {
  makeStyles, tokens,
  Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions,
  Field, Input, Dropdown, Option, Textarea, Button,
  MessageBar, Spinner,
} from '@fluentui/react-components';
import { Dismiss20Regular } from '@fluentui/react-icons';
import {
  createWorkPackage, updateWorkPackage, getWorkPackageForm,
  listTypes, listAvailableAssignees,
} from '../../services/openproject';

const EMPTY = {
  subject: '',
  description: '',
  typeHref: '',
  statusHref: '',
  assigneeHref: '',
  priorityHref: '',
  startDate: '',
  dueDate: '',
};

const useStyles = makeStyles({
  surface: { maxWidth: '800px', width: '100%' },
  titleRow: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: tokens.spacingHorizontalM,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXL,
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingRight: tokens.spacingHorizontalXXL,
    boxSizing: 'border-box',
    width: '100%',
  },
  span4:  { gridColumn: 'span 4',  '@media (max-width: 639px)': { gridColumn: 'span 12' } },
  span6:  { gridColumn: 'span 6',  '@media (max-width: 639px)': { gridColumn: 'span 12' } },
  span12: { gridColumn: 'span 12' },
  actions: {
    paddingTop: tokens.spacingVerticalXXL,
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingRight: tokens.spacingHorizontalXXL,
    paddingBottom: tokens.spacingVerticalL,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    marginTop: tokens.spacingVerticalL,
    columnGap: tokens.spacingHorizontalS,
  },
});

export default function WorkPackageDialog({ open, projectId, wp, onClose, onSaved }) {
  const styles = useStyles();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [schema, setSchema] = useState(null);
  const [types, setTypes] = useState([]);
  const [assignees, setAssignees] = useState([]);
  const isEdit = !!wp?.id;

  useEffect(() => {
    if (!open || !projectId) return;
    Promise.all([
      getWorkPackageForm(projectId),
      listTypes(projectId),
      listAvailableAssignees(projectId),
    ]).then(([formData, t, a]) => {
      setSchema(formData?._embedded?.schema || null);
      setTypes(t);
      setAssignees(a);
    }).catch(console.error);
  }, [open, projectId]);

  useEffect(() => {
    if (!open) return;
    if (wp) {
      setForm({
        subject: wp.subject || '',
        description: wp.description || '',
        typeHref: wp._links?.type?.href || '',
        statusHref: wp._links?.status?.href || '',
        assigneeHref: wp._links?.assignee?.href || '',
        priorityHref: wp._links?.priority?.href || '',
        startDate: wp.startDate || '',
        dueDate: wp.dueDate || '',
      });
    } else {
      setForm(EMPTY);
    }
    setErr(null);
  }, [open, wp]);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const availableStatuses = schema?.status?._embedded?.allowedValues || [];
  const priorities = schema?.priority?._embedded?.allowedValues || [];

  const handleSave = async () => {
    if (!form.subject.trim()) { setErr('Subject is required'); return; }
    setSaving(true); setErr(null);
    try {
      if (isEdit) {
        await updateWorkPackage(wp.id, wp.lockVersion, form);
      } else {
        await createWorkPackage(projectId, form);
      }
      onSaved?.();
      onClose();
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?._embedded?.errors?.[0]?.message || e.message || 'Save failed';
      setErr(msg);
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
            {isEdit ? `Edit #${wp.id}` : 'New Work Package'}
          </DialogTitle>

          <DialogContent>
            {err && (
              <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalM }}>
                {err}
              </MessageBar>
            )}

            <div className={styles.grid}>
              {/* Subject (12) */}
              <div className={styles.span12}>
                <Field label="Subject" required
                  validationState={!form.subject.trim() && err ? 'error' : 'none'}>
                  <Input
                    value={form.subject}
                    onChange={(_, d) => set('subject')(d.value)}
                    placeholder="Work package title"
                  />
                </Field>
              </div>

              {/* Type (4) + Status (4) + Priority (4) */}
              <div className={styles.span4}>
                <Field label="Type">
                  <Dropdown
                    placeholder="— Type —"
                    value={types.find(t => t._links?.self?.href === form.typeHref)?.name || ''}
                    selectedOptions={form.typeHref ? [form.typeHref] : []}
                    onOptionSelect={(_, d) => set('typeHref')(d.optionValue || '')}
                  >
                    {types.map(t => (
                      <Option key={t.id} value={t._links.self.href}>{t.name}</Option>
                    ))}
                  </Dropdown>
                </Field>
              </div>

              <div className={styles.span4}>
                <Field label="Status">
                  <Dropdown
                    placeholder="— Status —"
                    value={availableStatuses.find(s => s._links?.self?.href === form.statusHref)?.name || ''}
                    selectedOptions={form.statusHref ? [form.statusHref] : []}
                    onOptionSelect={(_, d) => set('statusHref')(d.optionValue || '')}
                  >
                    {availableStatuses.map(s => (
                      <Option key={s.id} value={s._links.self.href}>{s.name}</Option>
                    ))}
                  </Dropdown>
                </Field>
              </div>

              <div className={styles.span4}>
                <Field label="Priority">
                  <Dropdown
                    placeholder="— Priority —"
                    value={priorities.find(p => p._links?.self?.href === form.priorityHref)?.name || ''}
                    selectedOptions={form.priorityHref ? [form.priorityHref] : []}
                    onOptionSelect={(_, d) => set('priorityHref')(d.optionValue || '')}
                  >
                    {priorities.map(p => (
                      <Option key={p.id} value={p._links.self.href}>{p.name}</Option>
                    ))}
                  </Dropdown>
                </Field>
              </div>

              {/* Assignee (6) + empty (6) */}
              <div className={styles.span6}>
                <Field label="Assignee">
                  <Dropdown
                    placeholder="— Unassigned —"
                    value={assignees.find(a => a._links?.self?.href === form.assigneeHref)?.name || ''}
                    selectedOptions={form.assigneeHref ? [form.assigneeHref] : []}
                    onOptionSelect={(_, d) => set('assigneeHref')(d.optionValue || '')}
                  >
                    <Option value="">— Unassigned —</Option>
                    {assignees.map(a => (
                      <Option key={a.id} value={a._links.self.href}>{a.name}</Option>
                    ))}
                  </Dropdown>
                </Field>
              </div>

              {/* Start (4) + Due (4) + spare(4) */}
              <div className={styles.span4}>
                <Field label="Start Date">
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(_, d) => set('startDate')(d.value)}
                  />
                </Field>
              </div>
              <div className={styles.span4}>
                <Field label="Due Date">
                  <Input
                    type="date"
                    value={form.dueDate}
                    onChange={(_, d) => set('dueDate')(d.value)}
                  />
                </Field>
              </div>

              {/* Description (12) */}
              <div className={styles.span12}>
                <Field label="Description">
                  <Textarea
                    rows={4}
                    value={form.description}
                    onChange={(_, d) => set('description')(d.value)}
                    placeholder="Optional description (markdown)"
                  />
                </Field>
              </div>
            </div>
          </DialogContent>

          <DialogActions className={styles.actions}>
            <Button appearance="subtle" onClick={onClose}>Cancel</Button>
            <Button appearance="primary" onClick={handleSave} disabled={saving}>
              {saving
                ? <><Spinner size="tiny" style={{ marginRight: '6px' }} />Saving…</>
                : isEdit ? 'Save Changes' : 'Create Work Package'}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
