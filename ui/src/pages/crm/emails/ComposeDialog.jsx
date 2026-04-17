import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog, DialogContent, Box, Typography, IconButton, TextField, Button,
  CircularProgress, Alert, Chip, Avatar, Divider, Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon, Send as SendIcon, Save as SaveIcon,
  AttachFile as AttachIcon, FormatBold, FormatItalic, FormatUnderlined,
  FormatListBulleted, FormatListNumbered, Link as LinkIcon,
} from '@mui/icons-material';
import {
  sendEmailMsg, saveEmailDraft, uploadAttachment, attachmentDownloadUrl,
  getCurrentUser,
} from '../../../services/crm';

// EspoCRM accepts addressBook format: { name: 'Name', emailAddress: 'x@y.z' }[] or plain comma-separated string
function parseAddressList(s) {
  if (!s) return '';
  return s.split(/[,;]/).map(x => x.trim()).filter(Boolean).join(';');
}

export default function ComposeDialog({ open, onClose, initial = {}, onSent }) {
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');
  const [cc, setCc]     = useState('');
  const [bcc, setBcc]   = useState('');
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [attachmentsIds, setAttachmentsIds] = useState([]);
  const [attachmentsNames, setAttachmentsNames] = useState({});
  const [id, setId]     = useState(null);
  const [saving, setSaving]  = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState(null);
  const [uploading, setUploading] = useState(false);
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const draftTimerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setTo(initial.to || '');
    setCc(initial.cc || '');
    setBcc(initial.bcc || '');
    setShowCc(!!(initial.cc || initial.bcc));
    setSubject(initial.subject || '');
    setBodyHtml(initial.body || '');
    setAttachmentsIds(initial.attachmentsIds || []);
    setAttachmentsNames(initial.attachmentsNames || {});
    setId(initial.id || null);
    setErr(null);
    getCurrentUser().then(u => u?.emailAddress && setFrom(u.emailAddress)).catch(() => {});
    // Populate editor content
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = initial.body || '';
    }, 50);
  }, [open, initial]);

  // Debounced draft auto-save
  useEffect(() => {
    if (!open) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    if (!to.trim() && !subject.trim() && !bodyHtml.trim()) return;
    draftTimerRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        const payload = buildPayload();
        const saved = await saveEmailDraft(payload);
        if (saved?.id && !id) setId(saved.id);
      } catch { /* silent */ } finally { setSaving(false); }
    }, 5000);
    return () => clearTimeout(draftTimerRef.current);
  }, [to, cc, bcc, subject, bodyHtml, attachmentsIds, open]);

  const buildPayload = useCallback(() => {
    const payload = {
      to: parseAddressList(to),
      cc: parseAddressList(cc),
      bcc: parseAddressList(bcc),
      name: subject || '(no subject)',
      body: bodyHtml,
      bodyPlain: bodyHtml.replace(/<[^>]+>/g, ''),
      isHtml: true,
      attachmentsIds,
      attachmentsNames,
    };
    if (id) payload.id = id;
    if (initial.parentType && initial.parentId) {
      payload.parentType = initial.parentType;
      payload.parentId   = initial.parentId;
    }
    if (initial.replied) payload.replied = initial.replied;
    return payload;
  }, [to, cc, bcc, subject, bodyHtml, attachmentsIds, attachmentsNames, id, initial]);

  const doSend = async () => {
    if (!to.trim()) { setErr('At least one recipient is required'); return; }
    setSending(true); setErr(null);
    try {
      const payload = buildPayload();
      await sendEmailMsg(payload);
      onSent?.();
      onClose?.();
    } catch (e) { setErr(e?.response?.data?.message || e.message || 'Send failed'); }
    setSending(false);
  };

  const doSaveDraft = async () => {
    setSaving(true); setErr(null);
    try {
      const saved = await saveEmailDraft(buildPayload());
      if (saved?.id) setId(saved.id);
      onClose?.();
    } catch (e) { setErr(e?.response?.data?.message || e.message); }
    setSaving(false);
  };

  const doAttach = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true); setErr(null);
    try {
      for (const f of files) {
        const att = await uploadAttachment(f, 'Email', 'attachments');
        if (att?.id) {
          setAttachmentsIds(ids => [...ids, att.id]);
          setAttachmentsNames(names => ({ ...names, [att.id]: att.name || f.name }));
        }
      }
    } catch (err) { setErr(err?.response?.data?.message || err.message || 'Upload failed'); }
    setUploading(false);
    e.target.value = '';
  };

  const removeAttachment = (attId) => {
    setAttachmentsIds(ids => ids.filter(x => x !== attId));
    setAttachmentsNames(names => { const n = { ...names }; delete n[attId]; return n; });
  };

  // Toolbar format actions
  const exec = (cmd, value = null) => {
    document.execCommand(cmd, false, value);
    syncBody();
  };
  const syncBody = () => {
    if (editorRef.current) setBodyHtml(editorRef.current.innerHTML);
  };
  const insertLink = () => {
    const url = prompt('Enter URL');
    if (url) exec('createLink', url);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false}
      PaperProps={{ sx: { width: '82vw', maxWidth: 900, height: '85vh',
        display: 'flex', flexDirection: 'column' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1, bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
        <Typography sx={{ fontWeight: 700 }}>
          {initial.replied ? 'Reply' : initial.forward ? 'Forward' : 'New Message'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {saving && <Typography variant="caption" color="text.secondary" sx={{ mr: 1, alignSelf: 'center' }}>Saving draft…</Typography>}
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Box>
      </Box>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <Box sx={{ px: 2, pt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <AddrRow label="From" value={from} readOnly />
          <AddrRow label="To" value={to} onChange={setTo}
            trailing={
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {!showCc && (
                  <Button size="small" sx={{ minWidth: 0, px: 0.5, fontSize: 11 }}
                    onClick={() => setShowCc(true)}>Cc / Bcc</Button>
                )}
              </Box>
            } />
          {showCc && <AddrRow label="Cc" value={cc} onChange={setCc} />}
          {showCc && <AddrRow label="Bcc" value={bcc} onChange={setBcc} />}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider', pb: 0.5 }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', width: 40, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Subject</Typography>
            <TextField fullWidth size="small" variant="standard" value={subject}
              onChange={e => setSubject(e.target.value)}
              InputProps={{ disableUnderline: true, sx: { fontSize: 14 } }} />
          </Box>
        </Box>

        {/* Toolbar */}
        <Box sx={{ display: 'flex', gap: 0.25, px: 1.5, py: 0.5, borderBottom: 1, borderColor: 'divider',
          bgcolor: 'background.default' }}>
          <Tooltip title="Bold"><IconButton size="small" onClick={() => exec('bold')}><FormatBold fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Italic"><IconButton size="small" onClick={() => exec('italic')}><FormatItalic fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Underline"><IconButton size="small" onClick={() => exec('underline')}><FormatUnderlined fontSize="small" /></IconButton></Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Tooltip title="Bullet list"><IconButton size="small" onClick={() => exec('insertUnorderedList')}><FormatListBulleted fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Numbered list"><IconButton size="small" onClick={() => exec('insertOrderedList')}><FormatListNumbered fontSize="small" /></IconButton></Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Tooltip title="Insert link"><IconButton size="small" onClick={insertLink}><LinkIcon fontSize="small" /></IconButton></Tooltip>
        </Box>

        {err && <Alert severity="error" sx={{ m: 1 }} onClose={() => setErr(null)}>{err}</Alert>}

        {/* Body editor (contentEditable) */}
        <Box ref={editorRef}
          contentEditable suppressContentEditableWarning
          onInput={syncBody}
          sx={(theme) => ({
            flex: 1, overflowY: 'auto', px: 2, py: 1.5,
            fontSize: 14, lineHeight: 1.55, outline: 'none',
            '&:empty:before': {
              content: '"Write your message…"',
              color: theme.palette.text.disabled,
            },
          })}
        />

        {/* Attachment chips */}
        {attachmentsIds.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, px: 2, py: 1, borderTop: 1, borderColor: 'divider' }}>
            {attachmentsIds.map(aid => (
              <Chip key={aid} size="small"
                avatar={<Avatar sx={{ bgcolor: 'primary.main', fontSize: 10 }}>📎</Avatar>}
                label={attachmentsNames[aid] || aid}
                onDelete={() => removeAttachment(aid)}
                component="a" clickable
                href={attachmentDownloadUrl(aid)} target="_blank" />
            ))}
          </Box>
        )}

        {/* Footer */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          px: 2, py: 1, borderTop: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" color="primary" size="small"
              startIcon={sending ? <CircularProgress size={14} color="inherit" /> : <SendIcon />}
              onClick={doSend} disabled={sending}>
              {sending ? 'Sending…' : 'Send'}
            </Button>
            <input type="file" hidden multiple ref={fileInputRef} onChange={doAttach} />
            <Tooltip title="Attach files">
              <span>
                <IconButton size="small" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <CircularProgress size={16} /> : <AttachIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" variant="outlined" startIcon={<SaveIcon />} onClick={doSaveDraft} disabled={saving}>
              Save draft
            </Button>
            <Button size="small" onClick={onClose}>Discard</Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function AddrRow({ label, value, onChange, readOnly, trailing }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider', pb: 0.5 }}>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', width: 40, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
        {label}
      </Typography>
      <TextField fullWidth size="small" variant="standard" value={value || ''}
        onChange={e => onChange?.(e.target.value)}
        placeholder={readOnly ? '' : 'email@example.com, another@example.com'}
        InputProps={{ disableUnderline: true, readOnly, sx: { fontSize: 13 } }} />
      {trailing}
    </Box>
  );
}
