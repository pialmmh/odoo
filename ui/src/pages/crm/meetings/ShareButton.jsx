import { useState } from 'react';
import { Alert, Button, IconButton, Snackbar, Tooltip } from '@mui/material';
import { Share as ShareIcon } from '@mui/icons-material';
import { createShareLink } from '../../../services/crm';

/**
 * Generates (or reuses) the reusable share link for this meeting and copies
 * the full URL to the clipboard. Host-or-admin gated server-side; non-hosts
 * see the 403 as an Alert.
 *
 * Props:
 *   - meetingId: required
 *   - variant:   'button' (default) | 'icon' for compact toolbars
 *   - label:     override button label
 */
export default function ShareButton({ meetingId, variant = 'button', label }) {
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState(null);

  const onShare = async () => {
    setBusy(true);
    try {
      const res = await createShareLink(meetingId);
      const url = res?.url;
      if (!url) throw new Error('server did not return a URL');
      try {
        await navigator.clipboard.writeText(url);
        setSnack({ severity: 'success', msg: 'Share link copied' });
      } catch {
        setSnack({ severity: 'warning', msg: `Link created but couldn't auto-copy: ${url}` });
      }
    } catch (e) {
      setSnack({ severity: 'error', msg: e?.response?.data?.error || e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {variant === 'icon' ? (
        <Tooltip title="Copy share link">
          <span>
            <IconButton size="small" onClick={onShare} disabled={busy}>
              <ShareIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      ) : (
        <Button
          variant="outlined" size="small" startIcon={<ShareIcon />}
          onClick={onShare} disabled={busy}
        >
          {label ?? 'Share meeting'}
        </Button>
      )}
      <Snackbar
        open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack && (
          <Alert severity={snack.severity} onClose={() => setSnack(null)}>
            {snack.msg}
          </Alert>
        )}
      </Snackbar>
    </>
  );
}
