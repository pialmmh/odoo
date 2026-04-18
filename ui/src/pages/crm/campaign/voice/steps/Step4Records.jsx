import { useRef, useState } from 'react';
import {
  Box, Typography, Button, TextField, Alert, Divider, Chip, Stack,
  LinearProgress, Link as MuiLink,
} from '@mui/material';
import {
  UploadFile as UploadIcon, InsertDriveFile as FileIcon,
} from '@mui/icons-material';

// Step 4 — Record list. CSV upload is UI-only today (backend accepts
// phoneNumberList on save-campaign). CSV parse extracts the first column
// that looks like a phone number.

const parseCsv = (text) => {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  // Heuristic: skip header if first line has no digits.
  const first = lines[0];
  const startIdx = /\d/.test(first) ? 0 : 1;
  const out = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(/[,;\t]/);
    // Pick first column that contains mostly digits.
    const candidate = cols.find(c => /^\+?\d[\d\s\-()]{5,}$/.test(c.trim()));
    if (candidate) out.push(candidate.replace(/[\s\-()]/g, ''));
  }
  return out;
};

export default function Step4Records({ form, update }) {
  const fileInputRef = useRef(null);
  const [parsing, setParsing] = useState(false);
  const [warn, setWarn] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setParsing(true); setWarn(null);
    try {
      const text = await file.text();
      const numbers = parseCsv(text);
      if (numbers.length === 0) {
        setWarn('No phone numbers detected in CSV. Check the file format.');
      } else {
        update({
          recordListName: file.name,
          phoneNumbers: numbers.join('\n'),
        });
      }
    } catch (e) {
      setWarn('Failed to read file: ' + e.message);
    }
    setParsing(false);
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const numberCount = form.phoneNumbers.split(/[\s,;]+/).filter(Boolean).length;

  // Coverage score = (unique area codes in list that match a business number) / (unique area codes in list)
  const coverage = () => {
    const nums = form.phoneNumbers.split(/[\s,;]+/).filter(Boolean);
    const listAreas = new Set(nums.map(n => n.replace(/\D/g,'').slice(0,3)).filter(Boolean));
    if (listAreas.size === 0) return null;
    const bizAreas = new Set(
      form.businessNumbers.map(b => b.number.replace(/\D/g,'').slice(0,3)).filter(Boolean)
    );
    const covered = [...listAreas].filter(a => bizAreas.has(a)).length;
    return { covered, total: listAreas.size, pct: Math.round(100 * covered / listAreas.size) };
  };
  const cov = coverage();

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
        Upload record list
      </Typography>

      <Box
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        sx={{
          border: 2, borderStyle: 'dashed',
          borderColor: dragOver ? 'primary.main' : 'divider',
          bgcolor: dragOver ? 'action.hover' : 'background.default',
          borderRadius: 1, p: 4, textAlign: 'center', cursor: 'pointer',
          transition: 'all 150ms',
        }}
      >
        <UploadIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
        <Typography variant="body2">
          <strong>Click to upload</strong> or drag and drop a CSV file
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Files over 15 MB may take 5–7 minutes.{' '}
          <MuiLink component="button" onClick={(e) => { e.stopPropagation(); alert('Template TBD'); }}>
            Download template
          </MuiLink>
        </Typography>
        <input
          ref={fileInputRef} hidden type="file" accept=".csv,text/csv"
          onChange={e => handleFile(e.target.files?.[0])}
        />
      </Box>

      {parsing && <LinearProgress sx={{ mt: 1 }} />}
      {warn && <Alert severity="warning" sx={{ mt: 2 }}>{warn}</Alert>}

      {form.recordListName && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
          <FileIcon color="primary" fontSize="small" />
          <Typography variant="body2">{form.recordListName}</Typography>
          <Chip size="small" label={`${numberCount} records`} />
          {cov && (
            <Chip
              size="small"
              label={`Coverage ${cov.covered}/${cov.total} (${cov.pct}%)`}
              sx={{
                bgcolor: cov.pct >= 80 ? 'success.light'
                       : cov.pct >= 40 ? 'warning.light' : 'error.light',
              }}
            />
          )}
        </Stack>
      )}

      {cov && cov.pct < 80 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Local presence may be less effective if some contact area codes aren't covered by your selected business numbers.
        </Alert>
      )}

      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
        Or paste numbers directly
      </Typography>
      <TextField
        fullWidth multiline rows={8}
        placeholder="8801711111111&#10;8801811111111&#10;8801911111111"
        value={form.phoneNumbers}
        onChange={e => update({ phoneNumbers: e.target.value })}
        helperText={`${numberCount} numbers · one per line (comma and space also accepted)`}
      />
    </Box>
  );
}
