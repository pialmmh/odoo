import { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, TextField, FormControl, InputLabel, Select,
  MenuItem, FormControlLabel, Switch, Grid, Button, Alert,
  CircularProgress, Divider, InputAdornment, IconButton, Chip,
} from '@mui/material';
import { Visibility, VisibilityOff, Save as SaveIcon } from '@mui/icons-material';
import { getSettings, updateSettings } from '../../../services/crm';

// Widen the dropdown panel so long option text doesn't truncate.
const WIDE_MENU = { PaperProps: { sx: { minWidth: 280 } } };

// Generic settings form driven by a panels[] spec.
// Each field: { name, label, type, options?, help?, visibleWhen?, placeholder? }
// Types: varchar, password, int, bool, enum, multiEnum, array
export default function SettingsForm({ panels, onSaved }) {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pwdShow, setPwdShow] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const s = await getSettings();
        setForm(s || {});
      } catch (e) {
        setErr('Failed to load settings: ' + (e?.response?.data?.message || e.message));
      }
      setLoading(false);
    })();
  }, []);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false); };

  const save = async () => {
    setSaving(true); setErr(null); setSaved(false);
    try {
      const payload = {};
      panels.forEach((p) => p.fields.forEach((fld) => {
        if (fld.name in form) payload[fld.name] = form[fld.name];
      }));
      await updateSettings(payload);
      setSaved(true);
      onSaved?.();
    } catch (e) {
      setErr('Save failed: ' + (e?.response?.data?.message || e.message));
    }
    setSaving(false);
  };

  const isVisible = (fld) => {
    if (!fld.visibleWhen) return true;
    return fld.visibleWhen(form);
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }
  if (err && !form) return <Alert severity="error">{err}</Alert>;

  return (
    <Box>
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {saved && <Alert severity="success" sx={{ mb: 2 }}>Settings saved.</Alert>}

      {panels.map((panel, pi) => (
        <Paper key={pi} variant="outlined" sx={{ mb: 2, borderRadius: 1.5 }}>
          {panel.label && (
            <>
              <Box sx={{ px: 2, py: 1.25, bgcolor: 'action.hover' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{panel.label}</Typography>
              </Box>
              <Divider />
            </>
          )}
          <Box sx={{ p: 2 }}>
            <Grid container spacing={2}>
              {panel.fields.filter(isVisible).map((fld) => (
                <Grid size={{ xs: 12, sm: fld.full ? 12 : 6 }} key={fld.name}>
                  {renderField(fld, form, set, pwdShow, setPwdShow)}
                </Grid>
              ))}
            </Grid>
          </Box>
        </Paper>
      ))}

      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button variant="contained" onClick={save} disabled={saving} startIcon={<SaveIcon />}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
}

function renderField(fld, form, set, pwdShow, setPwdShow) {
  const v = form[fld.name];
  const label = fld.label + (fld.required ? ' *' : '');

  if (fld.type === 'bool') {
    return (
      <FormControlLabel
        control={<Switch checked={!!v} onChange={(e) => set(fld.name, e.target.checked)} />}
        label={<span>{label}{fld.help && <Typography variant="caption" display="block" color="text.secondary">{fld.help}</Typography>}</span>}
      />
    );
  }

  if (fld.type === 'enum') {
    return (
      <FormControl fullWidth size="small">
        <InputLabel>{label}</InputLabel>
        <Select value={v ?? ''} label={label} MenuProps={WIDE_MENU}
          onChange={(e) => set(fld.name, e.target.value)}>
          {fld.options.map((opt) => (
            <MenuItem key={String(opt.value ?? opt)} value={opt.value ?? opt}>
              {opt.label ?? opt ?? '(none)'}
            </MenuItem>
          ))}
        </Select>
        {fld.help && <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>{fld.help}</Typography>}
      </FormControl>
    );
  }

  if (fld.type === 'multiEnum' || fld.type === 'array') {
    const arr = Array.isArray(v) ? v : [];
    return (
      <FormControl fullWidth size="small">
        <InputLabel>{label}</InputLabel>
        <Select
          multiple
          value={arr}
          label={label}
          MenuProps={WIDE_MENU}
          onChange={(e) => set(fld.name, e.target.value)}
          renderValue={(sel) => (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {sel.map((x) => <Chip key={x} label={x} size="small" />)}
            </Box>
          )}
        >
          {(fld.options || []).map((opt) => (
            <MenuItem key={opt} value={opt}>{opt}</MenuItem>
          ))}
        </Select>
        {fld.help && <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>{fld.help}</Typography>}
      </FormControl>
    );
  }

  if (fld.type === 'password') {
    const show = pwdShow[fld.name];
    return (
      <TextField
        fullWidth size="small" label={label}
        type={show ? 'text' : 'password'}
        value={v ?? ''} onChange={(e) => set(fld.name, e.target.value)}
        helperText={fld.help} placeholder={fld.placeholder}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setPwdShow((s) => ({ ...s, [fld.name]: !show }))}>
                {show ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
    );
  }

  if (fld.type === 'int') {
    return (
      <TextField fullWidth size="small" label={label} type="number"
        value={v ?? ''} onChange={(e) => set(fld.name, e.target.value === '' ? null : +e.target.value)}
        helperText={fld.help} placeholder={fld.placeholder} />
    );
  }

  // varchar / text / default
  return (
    <TextField fullWidth size="small" label={label}
      value={v ?? ''} onChange={(e) => set(fld.name, e.target.value)}
      helperText={fld.help} placeholder={fld.placeholder}
      multiline={fld.type === 'text'} rows={fld.type === 'text' ? 3 : undefined}
    />
  );
}
