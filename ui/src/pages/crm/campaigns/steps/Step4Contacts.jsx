import { useRef, useState } from 'react';
import {
  Box, Typography, Button, TextField, Alert, Divider, Chip, Stack,
  LinearProgress, Link as MuiLink, Tabs, Tab,
} from '@mui/material';
import {
  UploadFile as UploadIcon, InsertDriveFile as FileIcon,
} from '@mui/icons-material';

// Step 4 — Contacts. For SMS and Voice: phone numbers. For Email: addresses.
// For Hybrid: both. CSV is parsed client-side; resulting list ships as a
// `phoneNumberList` / `emailList` field in the save-campaign DTO.

const parsePhones = (text) => {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const startIdx = /\d/.test(lines[0]) ? 0 : 1;
  const out = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(/[,;\t]/);
    const cand = cols.find(c => /^\+?\d[\d\s\-()]{5,}$/.test(c.trim()));
    if (cand) out.push(cand.replace(/[\s\-()]/g, ''));
  }
  return out;
};

const parseEmails = (text) => {
  const re = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
  return Array.from(new Set(text.match(re) || []));
};

export default function Step4Contacts({ form, update }) {
  const t = form.campaignType;
  const needsPhones = t !== 'EMAIL';
  const needsEmails = t === 'EMAIL' || t === 'HYBRID';

  const [tab, setTab] = useState(needsPhones ? 0 : 1);
  const phoneInput = useRef(null);
  const emailInput = useRef(null);
  const [parsing, setParsing] = useState(false);
  const [warn, setWarn] = useState(null);

  const handlePhoneFile = async (file) => {
    if (!file) return;
    setParsing(true); setWarn(null);
    try {
      const text = await file.text();
      const nums = parsePhones(text);
      if (nums.length === 0) setWarn('No phone numbers detected in file.');
      else update({ recordListName: file.name, phoneNumbers: nums.join('\n') });
    } catch (e) { setWarn('Failed to read file: ' + e.message); }
    setParsing(false);
  };

  const handleEmailFile = async (file) => {
    if (!file) return;
    setParsing(true); setWarn(null);
    try {
      const text = await file.text();
      const list = parseEmails(text);
      if (list.length === 0) setWarn('No email addresses detected in file.');
      else update({ recordListName: file.name, emails: list.join('\n') });
    } catch (e) { setWarn('Failed to read file: ' + e.message); }
    setParsing(false);
  };

  const phoneCount = form.phoneNumbers.split(/[\s,;]+/).filter(Boolean).length;
  const emailCount = form.emails.split(/[\s,;]+/).filter(Boolean).length;

  const Dropzone = ({ onFile, accept, label, hint }) => {
    const [over, setOver] = useState(false);
    const ref = useRef(null);
    return (
      <Box
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); onFile(e.dataTransfer.files?.[0]); }}
        onClick={() => ref.current?.click()}
        sx={{
          border: 2, borderStyle: 'dashed',
          borderColor: over ? 'primary.main' : 'divider',
          bgcolor: over ? 'action.hover' : 'background.default',
          borderRadius: 1, p: 4, textAlign: 'center', cursor: 'pointer',
          transition: 'all 150ms',
        }}
      >
        <UploadIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
        <Typography variant="body2"><strong>Click to upload</strong> or drag a file</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {hint}
        </Typography>
        <input ref={ref} hidden type="file" accept={accept}
          onChange={e => onFile(e.target.files?.[0])} />
      </Box>
    );
  };

  return (
    <Box>
      {(needsPhones && needsEmails) && (
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Phone numbers" />
          <Tab label="Email addresses" />
        </Tabs>
      )}

      {needsPhones && (tab === 0 || !needsEmails) && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
            Phone numbers
          </Typography>
          <Dropzone onFile={handlePhoneFile}
            accept=".csv,.xlsx,text/csv"
            hint="CSV / Excel with a phone-number column (msisdn, phone, number)" />
          {parsing && <LinearProgress sx={{ mt: 1 }} />}
          {warn && tab === 0 && <Alert severity="warning" sx={{ mt: 2 }}>{warn}</Alert>}
          {form.recordListName && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
              <FileIcon color="primary" fontSize="small" />
              <Typography variant="body2">{form.recordListName}</Typography>
              <Chip size="small" label={`${phoneCount} numbers`} />
            </Stack>
          )}

          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
            Or paste numbers directly
          </Typography>
          <TextField fullWidth multiline rows={8}
            placeholder="8801711111111&#10;8801811111111"
            value={form.phoneNumbers}
            onChange={e => update({ phoneNumbers: e.target.value })}
            helperText={`${phoneCount} numbers · one per line`}
          />
        </Box>
      )}

      {needsEmails && (tab === 1 || !needsPhones) && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
            Email addresses
          </Typography>
          <Dropzone onFile={handleEmailFile}
            accept=".csv,.xlsx,.txt"
            hint="CSV / TXT with email addresses — any column containing `@` is picked up" />
          {parsing && <LinearProgress sx={{ mt: 1 }} />}
          {warn && tab === 1 && <Alert severity="warning" sx={{ mt: 2 }}>{warn}</Alert>}

          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
            Or paste addresses
          </Typography>
          <TextField fullWidth multiline rows={8}
            placeholder="user@example.com&#10;other@example.com"
            value={form.emails}
            onChange={e => update({ emails: e.target.value })}
            helperText={`${emailCount} addresses`}
          />
        </Box>
      )}
    </Box>
  );
}
