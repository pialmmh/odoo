import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Avatar, Chip,
  CircularProgress, Divider,
} from '@mui/material';
import { getStream, postNote } from '../../services/crm';
import { Panel } from './LeadPanelPrimitives';

// Mirrors EspoCRM's stream panel (bottom of detail page).
// - Comment composer at the top
// - Feed of Note records below, most recent first
// - Supports these Note types at minimum: Post (comment), Update (field change),
//   Create, Status, Assign, Relate — others render as "event"

export default function StreamPanel({ entityType, id, onCommented }) {
  const [notes, setNotes]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getStream(entityType, id, { maxSize: 30 });
      setNotes(res.list || []);
    } catch {
      setNotes([]);
    }
    setLoading(false);
  }, [entityType, id]);

  useEffect(() => { load(); }, [load]);

  const submitComment = async () => {
    const text = comment.trim();
    if (!text) return;
    setPosting(true);
    try {
      await postNote(entityType, id, text);
      setComment('');
      load();
      onCommented?.();
    } catch {
      // error surfaced via comment staying
    }
    setPosting(false);
  };

  return (
    <Panel title="Stream">
      {/* Composer */}
      <TextField
        fullWidth multiline minRows={1} maxRows={4}
        placeholder="Write your comment here"
        size="small"
        value={comment}
        onChange={e => setComment(e.target.value)}
        sx={{ mb: comment.trim() ? 1 : 0 }}
      />
      {comment.trim() && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button variant="contained" size="small" onClick={submitComment} disabled={posting}>
            {posting ? 'Posting…' : 'Post'}
          </Button>
          <Button size="small" onClick={() => setComment('')}>Cancel</Button>
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Feed */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={20} /></Box>
      ) : notes.length === 0 ? (
        <Typography variant="body2" color="text.disabled">No activity yet.</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {notes.map(n => <StreamNote key={n.id} note={n} />)}
        </Box>
      )}
    </Panel>
  );
}

function StreamNote({ note }) {
  const who = note.createdByName || 'System';
  const when = formatShortDate(note.createdAt);

  let body;
  let headline;
  if (note.type === 'Post') {
    headline = <><strong>{who}</strong> commented</>;
    body = <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{note.post}</Typography>;
  } else if (note.type === 'Create') {
    headline = <><strong>{who}</strong> created this lead</>;
  } else if (note.type === 'Update') {
    headline = <><strong>{who}</strong> updated this lead</>;
    const val = note.data?.value;
    if (val != null && val !== '') {
      body = <Chip label={String(val)} size="small" sx={{ mt: 0.5 }} />;
    }
  } else if (note.type === 'Status') {
    headline = <><strong>{who}</strong> changed status</>;
    if (note.data?.value != null) {
      body = <Chip label={String(note.data.value)} size="small" color="success" sx={{ mt: 0.5 }} />;
    }
  } else if (note.type === 'Assign') {
    headline = <><strong>{who}</strong> assigned the lead{note.data?.assignedUserName ? ` to ${note.data.assignedUserName}` : ''}</>;
  } else if (note.type === 'CreateRelated' || note.type === 'Relate') {
    headline = <><strong>{who}</strong> linked {note.relatedType || 'a record'}{note.relatedName ? ` — ${note.relatedName}` : ''}</>;
  } else {
    headline = <><strong>{who}</strong> {note.type || 'event'}</>;
  }

  return (
    <Box sx={{ display: 'flex', gap: 1.25 }}>
      <Avatar sx={{ width: 32, height: 32, fontSize: 12, bgcolor: 'primary.main' }}>
        {(who.match(/\b[a-z]/gi) || []).slice(0, 2).join('').toUpperCase() || '?'}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontSize: 13 }}>{headline}</Typography>
        {body}
        <Typography variant="caption" color="text.secondary">{when}</Typography>
      </Box>
    </Box>
  );
}

function formatShortDate(ts) {
  if (!ts) return '';
  // ts from EspoCRM is like "2026-04-15 12:51:44" (UTC)
  const d = new Date(ts.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return ts;
  const opts = { day: '2-digit', month: 'short' };
  return d.toLocaleDateString(undefined, opts);
}
