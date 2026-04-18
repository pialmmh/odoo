import { useState, useEffect, useRef } from 'react';
import { Autocomplete, TextField, Select, MenuItem, Box } from '@mui/material';
import { get } from '../../services/crm';

// Single-parent linkParent picker. value = { type, id, name } | null.
// entityList defaults to the standard Meeting/Call/Task parent list.
export default function ParentPicker({
  value, onChange,
  entityList = ['Account', 'Contact', 'Lead', 'Opportunity', 'Case'],
  placeholder = 'Select',
}) {
  const [type, setType] = useState(value?.type || entityList[0]);
  const [input, setInput] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const reqRef = useRef(0);

  useEffect(() => { if (value?.type && value.type !== type) setType(value.type); /* eslint-disable-next-line */ }, [value?.type]);

  useEffect(() => {
    const q = input.trim();
    const id = ++reqRef.current;
    setLoading(true);
    const params = { maxSize: 10, select: 'id,name' };
    if (q) params.textFilter = q;
    get(`/${type}`, params)
      .then(res => {
        if (id !== reqRef.current) return;
        setOptions((res.list || []).map(it => ({ id: it.id, name: it.name || '(unnamed)' })));
      })
      .catch(() => {})
      .finally(() => { if (id === reqRef.current) setLoading(false); });
  }, [input, type]);

  const selected = value ? { id: value.id, name: value.name } : null;

  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Select size="small" value={type} sx={{ minWidth: 130 }}
        onChange={(e) => { setType(e.target.value); onChange?.(null); }}>
        {entityList.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
      </Select>
      <Autocomplete
        sx={{ flex: 1, minWidth: 0 }}
        size="small"
        value={selected}
        options={options}
        loading={loading}
        onInputChange={(_, v) => setInput(v)}
        onChange={(_, v) => onChange?.(v ? { type, id: v.id, name: v.name } : null)}
        getOptionLabel={(o) => o?.name || ''}
        isOptionEqualToValue={(o, v) => o.id === v.id}
        renderInput={(p) => <TextField {...p} size="small" placeholder={placeholder} />}
      />
    </Box>
  );
}
