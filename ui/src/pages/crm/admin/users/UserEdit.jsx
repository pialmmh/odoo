import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, IconButton, CircularProgress, Alert,
  Breadcrumbs, Link as MuiLink, Grid, FormControl, Select, MenuItem,
  TextField, Autocomplete, Chip, InputAdornment,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Close as CloseIcon,
  Person as PersonIcon,
  Visibility, VisibilityOff,
} from '@mui/icons-material';
import {
  getUser, createUser, updateUser,
  listTeams, listRoles, listWorkingTimeCalendars, listLayoutSets,
  USER_TYPES, USER_SALUTATIONS,
} from '../../../../services/crm';
import { Panel } from '../../LeadPanelPrimitives';

// ---- Style constants shared with other edit forms in this project -------
// Wide dropdown slotProps — prevents placeholder/text from getting trimmed.
const WIDE_POPPER = {
  popper: { sx: { minWidth: 320, width: 'max-content !important', maxWidth: 520 }, placement: 'bottom-start' },
  paper:  { sx: { minWidth: 320 } },
};
// MenuProps for regular Select — same widening.
const WIDE_MENU = {
  PaperProps: { sx: { minWidth: 280 } },
};

// Bangladesh mobile phone normalizer.
// Accepts anything the user types ("+880 1711 123456", "01711-123456",
// "8801711123456", "1711123456", etc.) and returns the canonical E.164 form
// +8801XXXXXXXXX. Returns null if the field is empty after stripping or the
// digits don't look like a BD mobile.
function normalizeBdPhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  let local;
  if (digits.startsWith('880')) local = digits.slice(3);
  else if (digits.startsWith('0')) local = digits.slice(1);
  else local = digits;
  // BD mobile: 10 digits starting with 1 (e.g. 1711123456).
  if (!/^1\d{9}$/.test(local)) {
    // Not a BD mobile — pass the user's input through so EspoCRM validates it.
    return String(raw).trim() || null;
  }
  return '+880' + local;
}

const TYPE_COLOR = {
  admin: 'error', 'super-admin': 'error',
  regular: 'primary', portal: 'info', api: 'warning', system: 'default',
};

// Tiny uppercase label — same as the one used in LeadEdit/CaseEdit.
function Lbl({ children, required }) {
  return (
    <Typography sx={{
      fontSize: 10, letterSpacing: 0.8, fontWeight: 600, color: 'text.secondary',
      textTransform: 'uppercase', mb: 0.5, lineHeight: 1,
    }}>
      {children}{required && ' *'}
    </Typography>
  );
}

// Multi-select link picker (Teams, Roles)
function LinkMultiPicker({ value, namesMap, onChange, loader, placeholder }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let live = true;
    setLoading(true);
    loader({ maxSize: 100 })
      .then((r) => { if (live) setOptions(r?.list || []); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [loader]);

  const selected = useMemo(
    () => (value?.ids || []).map((id) => ({
      id, name: value?.names?.[id] || namesMap?.[id] || id,
    })),
    [value, namesMap],
  );

  return (
    <Autocomplete
      multiple size="small" loading={loading} options={options}
      value={selected}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      getOptionLabel={(o) => o.name || o.id}
      onChange={(_, items) => {
        const ids = items.map((i) => i.id);
        const names = Object.fromEntries(items.map((i) => [i.id, i.name]));
        onChange({ ids, names });
      }}
      renderTags={(vals, getTagProps) =>
        vals.map((o, i) => (
          <Chip key={o.id} size="small" label={o.name || o.id} {...getTagProps({ index: i })} />
        ))}
      renderInput={(params) => (
        <TextField {...params} size="small" placeholder={placeholder || 'Select'} />
      )}
      slotProps={WIDE_POPPER}
    />
  );
}

// Single-select link picker (Default Team, Working Time Calendar, Layout Set)
function LinkPicker({ valueId, valueName, onChange, loader, placeholder, disabled }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let live = true;
    setLoading(true);
    loader({ maxSize: 100 })
      .then((r) => { if (live) setOptions(r?.list || []); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [loader]);

  const current = valueId ? { id: valueId, name: valueName || valueId } : null;

  return (
    <Autocomplete
      size="small" loading={loading} options={options}
      value={current}
      disabled={disabled}
      isOptionEqualToValue={(a, b) => a?.id === b?.id}
      getOptionLabel={(o) => o?.name || o?.id || ''}
      onChange={(_, item) => onChange(item ? { id: item.id, name: item.name } : { id: null, name: null })}
      renderInput={(params) => (
        <TextField {...params} size="small" placeholder={placeholder || 'Select'} />
      )}
      slotProps={WIDE_POPPER}
    />
  );
}

// ---- Page ---------------------------------------------------------------
const EMPTY = {
  userName: '', salutationName: '', firstName: '', lastName: '',
  title: '', emailAddress: '', phoneNumber: '', phoneNumberType: 'Mobile',
  gender: '', avatarColor: '',
  type: 'regular', isActive: true,
  teamsIds: [], teamsNames: {},
  defaultTeamId: null, defaultTeamName: null,
  rolesIds: [], rolesNames: {},
  workingTimeCalendarId: null, workingTimeCalendarName: null,
  layoutSetId: null, layoutSetName: null,
  password: '', passwordConfirm: '',
};

export default function UserEdit() {
  const navigate = useNavigate();
  const { id, tenant } = useParams();
  const [searchParams] = useSearchParams();
  const base = tenant ? `/${tenant}` : '';
  const isEdit = !!id;
  const defaultType = searchParams.get('type') || 'regular';

  const [form, setForm] = useState(() => ({ ...EMPTY, type: defaultType }));
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [touched, setTouched] = useState({});
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    let live = true;
    getUser(id).then((u) => {
      if (!live) return;
      setForm((f) => ({
        ...f,
        userName:       u.userName || '',
        salutationName: u.salutationName || '',
        firstName:      u.firstName || '',
        lastName:       u.lastName || '',
        title:          u.title || '',
        emailAddress:   u.emailAddress || '',
        phoneNumber:    u.phoneNumber || '',
        gender:         u.gender || '',
        avatarColor:    u.avatarColor || '',
        type:           u.type || 'regular',
        isActive:       u.isActive !== false,
        teamsIds:       u.teamsIds || [],
        teamsNames:     u.teamsNames || {},
        defaultTeamId:  u.defaultTeamId || null,
        defaultTeamName: u.defaultTeamName || null,
        rolesIds:       u.rolesIds || [],
        rolesNames:     u.rolesNames || {},
        workingTimeCalendarId:   u.workingTimeCalendarId || null,
        workingTimeCalendarName: u.workingTimeCalendarName || null,
        layoutSetId:    u.layoutSetId || null,
        layoutSetName:  u.layoutSetName || null,
      }));
    }).catch((e) => setErr(e?.response?.data?.message || e.message))
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id, isEdit]);

  const set = useCallback((patch) => setForm((f) => ({ ...f, ...patch })), []);

  const generatePassword = () => {
    const up = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lo = 'abcdefghijkmnpqrstuvwxyz';
    const di = '23456789';
    const sy = '!@#$%^&*';
    const all = up + lo + di + sy;
    const pick = (s) => s[Math.floor(Math.random() * s.length)];
    let p = pick(up) + pick(lo) + pick(di) + pick(sy);
    for (let i = 0; i < 8; i++) p += pick(all);
    p = p.split('').sort(() => Math.random() - 0.5).join('');
    set({ password: p, passwordConfirm: p });
  };

  const submit = useCallback(async () => {
    setTouched({ userName: true, password: true });
    if (!form.userName.trim()) return;
    if (!isEdit && !form.password) return;
    if (form.password && form.password !== form.passwordConfirm) {
      setErr('Passwords do not match'); return;
    }
    setSaving(true); setErr(null);
    try {
      const payload = {
        userName:       form.userName,
        salutationName: form.salutationName || null,
        firstName:      form.firstName || null,
        lastName:       form.lastName || null,
        title:          form.title || null,
        emailAddress:   form.emailAddress || null,
        phoneNumber:    normalizeBdPhone(form.phoneNumber),
        gender:         form.gender || null,
        avatarColor:    form.avatarColor || null,
        type:           form.type,
        isActive:       form.isActive,
        teamsIds:       form.teamsIds,
        teamsNames:     form.teamsNames,
        defaultTeamId:   form.defaultTeamId,
        defaultTeamName: form.defaultTeamName,
        rolesIds:       form.rolesIds,
        rolesNames:     form.rolesNames,
        workingTimeCalendarId:   form.workingTimeCalendarId,
        workingTimeCalendarName: form.workingTimeCalendarName,
        layoutSetId:    form.layoutSetId,
        layoutSetName:  form.layoutSetName,
      };
      if (form.password) payload.password = form.password;
      if (isEdit) {
        delete payload.userName;
        await updateUser(id, payload);
      } else {
        await createUser(payload);
      }
      navigate(`${base}/crm/admin/users`);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Save failed');
    }
    setSaving(false);
  }, [form, id, isEdit, navigate, base]);

  const cancel = () => navigate(`${base}/crm/admin/users`);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  const displayName = [form.firstName, form.lastName].filter(Boolean).join(' ') || form.userName;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 0.5 }}>
        <MuiLink component={RouterLink} to={`${base}/crm/admin`} underline="hover">Administration</MuiLink>
        <MuiLink component={RouterLink} to={`${base}/crm/admin/users`} underline="hover">Users</MuiLink>
        <Typography color="text.primary">{isEdit ? 'Edit' : 'Create'}</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={(theme) => ({
          width: 40, height: 40, borderRadius: 1.5,
          bgcolor: alpha(theme.palette.primary.main, 0.12),
          color: theme.palette.primary.main,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        })}>
          <PersonIcon />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            {isEdit ? `Edit ${displayName || 'User'}` : 'Create User'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
            {form.type && <Chip label={form.type} size="small" variant="outlined" color={TYPE_COLOR[form.type] || 'default'} />}
            {form.isActive
              ? <Chip label="Active" size="small" color="success" variant="outlined" />
              : <Chip label="Inactive" size="small" variant="outlined" />}
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2,
                 gap: 1, px: 1.5, py: 1, bgcolor: 'background.default', borderRadius: 1 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="contained" color="primary" size="small" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="outlined" size="small" onClick={cancel}>Cancel</Button>
        </Box>
        <IconButton size="small" onClick={cancel}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Panel title="Overview">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Lbl required>User Name</Lbl>
                <TextField fullWidth size="small" required
                  disabled={isEdit}
                  value={form.userName}
                  error={touched.userName && !form.userName.trim()}
                  helperText={touched.userName && !form.userName.trim() ? 'User Name is required' : ''}
                  onChange={(e) => { set({ userName: e.target.value }); setTouched((t) => ({ ...t, userName: true })); }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Lbl>Title</Lbl>
                <TextField fullWidth size="small"
                  value={form.title}
                  onChange={(e) => set({ title: e.target.value })} />
              </Grid>

              <Grid size={{ xs: 12, sm: 2 }}>
                <Lbl required>Salutation</Lbl>
                <FormControl fullWidth size="small">
                  <Select value={form.salutationName || ''} displayEmpty
                    MenuProps={WIDE_MENU}
                    onChange={(e) => set({ salutationName: e.target.value })}>
                    {USER_SALUTATIONS.map((s) => (
                      <MenuItem key={s || 'none'} value={s}>{s || '—'}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 5 }}>
                <Lbl>First Name</Lbl>
                <TextField fullWidth size="small" placeholder="First Name"
                  value={form.firstName}
                  onChange={(e) => set({ firstName: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 12, sm: 5 }}>
                <Lbl>Last Name</Lbl>
                <TextField fullWidth size="small" placeholder="Last Name"
                  value={form.lastName}
                  onChange={(e) => set({ lastName: e.target.value })} />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Lbl>Email</Lbl>
                <TextField fullWidth size="small" type="email"
                  value={form.emailAddress}
                  onChange={(e) => set({ emailAddress: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Lbl>Phone</Lbl>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <Select value={form.phoneNumberType}
                      MenuProps={WIDE_MENU}
                      onChange={(e) => set({ phoneNumberType: e.target.value })}>
                      {['Mobile', 'Office', 'Home', 'Fax', 'Other'].map((t) => (
                        <MenuItem key={t} value={t}>{t}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField fullWidth size="small" placeholder="+8801XXXXXXXXX"
                    value={form.phoneNumber}
                    onChange={(e) => set({ phoneNumber: e.target.value })}
                    onBlur={() => {
                      const n = normalizeBdPhone(form.phoneNumber);
                      if (n && n !== form.phoneNumber) set({ phoneNumber: n });
                    }} />
                </Box>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Lbl>Gender</Lbl>
                <FormControl fullWidth size="small">
                  <Select value={form.gender || ''} displayEmpty
                    MenuProps={WIDE_MENU}
                    onChange={(e) => set({ gender: e.target.value })}>
                    <MenuItem value="">Not Set</MenuItem>
                    <MenuItem value="Male">Male</MenuItem>
                    <MenuItem value="Female">Female</MenuItem>
                    <MenuItem value="Neutral">Neutral</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Panel>

          <Panel title="Teams and Access Control">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Lbl required>Type</Lbl>
                <FormControl fullWidth size="small">
                  <Select value={form.type} MenuProps={WIDE_MENU}
                    onChange={(e) => set({ type: e.target.value })}>
                    {USER_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Lbl>Is Active</Lbl>
                <FormControl fullWidth size="small">
                  <Select value={form.isActive ? 'yes' : 'no'} MenuProps={WIDE_MENU}
                    onChange={(e) => set({ isActive: e.target.value === 'yes' })}>
                    <MenuItem value="yes">Yes</MenuItem>
                    <MenuItem value="no">No</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Lbl>Teams</Lbl>
                <LinkMultiPicker
                  value={{ ids: form.teamsIds, names: form.teamsNames }}
                  onChange={(v) => set({ teamsIds: v.ids, teamsNames: v.names })}
                  loader={listTeams}
                  placeholder="Select teams"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Lbl>Default Team</Lbl>
                <LinkPicker
                  valueId={form.defaultTeamId}
                  valueName={form.defaultTeamName}
                  onChange={(v) => set({ defaultTeamId: v.id, defaultTeamName: v.name })}
                  loader={listTeams}
                  placeholder={form.teamsIds.length === 0 ? 'Select Teams first' : 'Select default team'}
                  disabled={form.teamsIds.length === 0}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Lbl>Roles</Lbl>
                <LinkMultiPicker
                  value={{ ids: form.rolesIds, names: form.rolesNames }}
                  onChange={(v) => set({ rolesIds: v.ids, rolesNames: v.names })}
                  loader={listRoles}
                  placeholder="Select roles"
                />
              </Grid>
            </Grid>
          </Panel>

          <Panel title="Misc">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Lbl>Working Time Calendar</Lbl>
                <LinkPicker
                  valueId={form.workingTimeCalendarId}
                  valueName={form.workingTimeCalendarName}
                  onChange={(v) => set({
                    workingTimeCalendarId: v.id,
                    workingTimeCalendarName: v.name,
                  })}
                  loader={listWorkingTimeCalendars}
                  placeholder="Select working time calendar"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Lbl>Layout Set</Lbl>
                <LinkPicker
                  valueId={form.layoutSetId}
                  valueName={form.layoutSetName}
                  onChange={(v) => set({
                    layoutSetId: v.id,
                    layoutSetName: v.name,
                  })}
                  loader={listLayoutSets}
                  placeholder="Select layout set"
                />
              </Grid>
            </Grid>
          </Panel>

          <Panel title="Password">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 8 }}>
                <Lbl required={!isEdit}>{isEdit ? 'New Password (leave blank to keep)' : 'Password'}</Lbl>
                <TextField fullWidth size="small"
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  error={touched.password && !isEdit && !form.password}
                  helperText={touched.password && !isEdit && !form.password ? 'Password is required' : ''}
                  onChange={(e) => { set({ password: e.target.value }); setTouched((t) => ({ ...t, password: true })); }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowPwd(!showPwd)}>
                          {showPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'flex-end', pb: 0.25 }}>
                <Button variant="outlined" size="small" onClick={generatePassword}>Generate</Button>
              </Grid>

              <Grid size={{ xs: 12, sm: 8 }}>
                <Lbl>Confirm Password</Lbl>
                <TextField fullWidth size="small"
                  type={showPwd2 ? 'text' : 'password'}
                  value={form.passwordConfirm}
                  error={!!form.password && form.password !== form.passwordConfirm}
                  helperText={(!!form.password && form.password !== form.passwordConfirm) ? 'Passwords do not match' : ''}
                  onChange={(e) => set({ passwordConfirm: e.target.value })}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowPwd2(!showPwd2)}>
                          {showPwd2 ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }} />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Typography variant="caption" color="text.secondary">
                  You need to setup SMTP settings to make the system be able to
                  send password in email.
                </Typography>
              </Grid>
            </Grid>
          </Panel>
        </Box>

        <Box>
          <Panel title="Avatar" dense>
            <Box sx={{ mb: 2 }}>
              <Box sx={(theme) => ({
                width: 64, height: 64, borderRadius: 1.5,
                bgcolor: form.avatarColor || alpha(theme.palette.primary.main, 0.12),
                color: theme.palette.primary.main,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              })}>
                <PersonIcon sx={{ fontSize: 32 }} />
              </Box>
            </Box>
            <Lbl>Avatar Color</Lbl>
            <TextField fullWidth size="small"
              value={form.avatarColor}
              onChange={(e) => set({ avatarColor: e.target.value })}
              placeholder="#rrggbb"
              InputProps={{
                endAdornment: form.avatarColor && (
                  <InputAdornment position="end">
                    <Box sx={(t) => ({
                      width: 18, height: 18, borderRadius: 0.5,
                      bgcolor: form.avatarColor,
                      border: `1px solid ${t.palette.divider}`,
                    })} />
                  </InputAdornment>
                ),
              }} />
          </Panel>
        </Box>
      </Box>
    </Box>
  );
}
