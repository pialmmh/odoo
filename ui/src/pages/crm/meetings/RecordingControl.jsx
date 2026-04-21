import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Chip, IconButton, Snackbar, Tooltip, CircularProgress } from '@mui/material';
import {
  FiberManualRecord as RecIcon, StopCircle as StopIcon,
} from '@mui/icons-material';
import { listRecordings, startRecording, stopRecording } from '../../../services/crm';

const ACTIVE = new Set(['STARTING', 'ACTIVE', 'ENDING']);

/**
 * In-call recording indicator + (host-only) start/stop control.
 *
 * Everyone in the room sees the REC chip and gets a toast when state flips
 * (transparency); only hosts get the button. Stop is allowed even during
 * STARTING (labelled "Cancel starting") so a hung egress can be aborted.
 */
export default function RecordingControl({ meetingId, isHost }) {
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const prevStatusRef = useRef(null);

  const refresh = async () => {
    try {
      const r = await listRecordings(meetingId);
      const raw = r?.recordings;
      const list = Array.isArray(raw) ? raw
                 : Array.isArray(raw?.list) ? raw.list
                 : [];
      const a = list.find((x) => ACTIVE.has(x.status));
      setActive(a || null);

      const prev = prevStatusRef.current;
      const now = a?.status ?? null;
      if (prev !== now) {
        if (prev == null && now === 'STARTING') {
          setToast({ severity: 'warning', msg: 'Recording is starting…' });
        } else if (now === 'ACTIVE' && prev !== 'ACTIVE') {
          setToast({ severity: 'error', msg: 'This meeting is being recorded' });
        } else if (prev != null && now == null) {
          setToast({ severity: 'info', msg: 'Recording stopped' });
        }
        prevStatusRef.current = now;
      }
    } catch {
      // non-auth'd peers may 401 here; silent is correct
    }
  };

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 5000);
    return () => clearInterval(iv);
  }, [meetingId]);

  const recording = !!active;
  const starting = active?.status === 'STARTING';
  const ending   = active?.status === 'ENDING';

  const onClick = async () => {
    if (!isHost) return;
    setBusy(true);
    setError(null);
    try {
      if (recording) await stopRecording(meetingId);
      else           await startRecording(meetingId);
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  let tip;
  if (error)        tip = `Failed: ${error}`;
  else if (starting) tip = isHost ? 'Cancel starting' : 'Recording is starting…';
  else if (ending)   tip = 'Stopping…';
  else if (recording) tip = isHost ? 'Stop recording' : 'Recording in progress';
  else tip = isHost ? 'Start recording' : 'No active recording';

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {recording && (
          <Chip
            size="small"
            color={starting ? 'warning' : ending ? 'default' : 'error'}
            icon={<RecIcon sx={{ animation: starting || ending ? 'none' : 'pulse 1.5s infinite' }} />}
            label={starting ? 'STARTING' : ending ? 'STOPPING' : 'REC'}
            sx={{
              fontWeight: 600,
              '@keyframes pulse': {
                '0%,100%': { opacity: 1 },
                '50%':     { opacity: 0.5 },
              },
            }}
          />
        )}
        {isHost && (
          <Tooltip title={tip}>
            <span>
              <IconButton
                size="small" onClick={onClick}
                disabled={busy || ending}
                color={recording ? 'error' : 'default'}
              >
                {busy ? <CircularProgress size={18} />
                  : recording ? <StopIcon /> : <RecIcon />}
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>
      <Snackbar
        open={!!toast} autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        {toast && (
          <Alert severity={toast.severity} onClose={() => setToast(null)} variant="filled">
            {toast.msg}
          </Alert>
        )}
      </Snackbar>
    </>
  );
}
