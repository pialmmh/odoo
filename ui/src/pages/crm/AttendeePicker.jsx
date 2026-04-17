import { useState, useEffect, useRef } from 'react';
import { Autocomplete, TextField, Chip, Avatar, Box } from '@mui/material';
import { get } from '../../services/crm';

// Async-searching multi-select attendee picker. Queries /{entity}?textFilter=...
// Returns/accepts an array of { id, name }.

export default function AttendeePicker({ entity, value = [], onChange, placeholder = 'Select', label, disableIds = [] }) {
  const [input,   setInput]   = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const reqRef = useRef(0);

  useEffect(() => {
    const q  = input.trim();
    const id = ++reqRef.current;
    if (!q && options.length) return;
    setLoading(true);
    const params = { maxSize: 10, select: 'id,name,userName' };
    if (q) params.textFilter = q;
    get(`/${entity}`, params)
      .then(res => {
        if (id !== reqRef.current) return;
        setOptions((res.list || []).map(it => ({
          id: it.id,
          name: it.name || it.userName || '(unnamed)',
        })));
      })
      .catch(() => {})
      .finally(() => { if (id === reqRef.current) setLoading(false); });
  }, [input, entity]);

  return (
    <Autocomplete
      multiple
      size="small"
      value={value}
      options={options}
      loading={loading}
      onInputChange={(_, v) => setInput(v)}
      onChange={(_, v) => onChange?.(v)}
      getOptionLabel={o => o.name || ''}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      getOptionDisabled={o => disableIds.includes(o.id)}
      filterSelectedOptions
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((opt, idx) => (
          <Chip
            {...getTagProps({ index: idx })}
            key={opt.id}
            size="small"
            avatar={<Avatar sx={{ bgcolor: 'primary.main', fontSize: 10 }}>{opt.name.slice(0, 2).toUpperCase()}</Avatar>}
            label={opt.name}
          />
        ))
      }
      renderOption={(props, opt) => (
        <Box component="li" {...props} key={opt.id}>
          <Avatar sx={{ width: 22, height: 22, fontSize: 10, mr: 1, bgcolor: 'primary.main' }}>
            {opt.name.slice(0, 2).toUpperCase()}
          </Avatar>
          {opt.name}
        </Box>
      )}
      renderInput={(params) => (
        <TextField {...params} size="small" placeholder={value.length ? '' : placeholder} label={label} />
      )}
    />
  );
}
