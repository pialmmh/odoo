import { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box,
  Typography, Chip, LinearProgress, Collapse, IconButton,
} from '@mui/material';
import {
  CheckCircle, Error as ErrorIcon, HourglassEmpty, PlayArrow,
  ExpandMore, ExpandLess, Cancel as CancelIcon, SkipNext,
} from '@mui/icons-material';
import { getPipeline, getPipelineSteps, cancelPipeline } from '../../services/artifacts';

const STATUS_ICON = {
  pending: <HourglassEmpty fontSize="small" sx={{ color: '#9e9e9e' }} />,
  running: <PlayArrow fontSize="small" sx={{ color: '#1565c0' }} />,
  success: <CheckCircle fontSize="small" sx={{ color: '#2e7d32' }} />,
  failed: <ErrorIcon fontSize="small" sx={{ color: '#c62828' }} />,
  skipped: <SkipNext fontSize="small" sx={{ color: '#ff9800' }} />,
};

const STATUS_COLORS = { pending: 'default', running: 'info', success: 'success', failed: 'error', skipped: 'warning', cancelled: 'default' };

function StepRow({ step, isLast }) {
  const [expanded, setExpanded] = useState(step.status === 'running' || step.status === 'failed');
  const outputRef = useRef(null);

  useEffect(() => {
    if (step.status === 'running' || step.status === 'failed') setExpanded(true);
  }, [step.status]);

  useEffect(() => {
    if (expanded && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [expanded, step.stdout, step.stderr]);

  const hasOutput = step.stdout || step.stderr;
  const duration = step.duration_seconds ? `${step.duration_seconds.toFixed(1)}s` : '';

  return (
    <Box sx={{ borderLeft: '2px solid', borderColor: step.status === 'failed' ? '#c62828' : step.status === 'success' ? '#2e7d32' : step.status === 'running' ? '#1565c0' : '#e0e0e0', pl: 2, pb: isLast ? 0 : 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: hasOutput ? 'pointer' : 'default' }}
        onClick={() => hasOutput && setExpanded(!expanded)}>
        {STATUS_ICON[step.status] || STATUS_ICON.pending}
        <Typography fontSize={13} fontWeight={600} sx={{ flexGrow: 1 }}>
          {step.sequence / 10}. {step.name}
        </Typography>
        {duration && <Typography fontSize={11} color="text.secondary">{duration}</Typography>}
        {step.exit_code !== undefined && step.exit_code !== 0 && step.status !== 'pending' && (
          <Chip label={`exit ${step.exit_code}`} size="small" color="error" sx={{ height: 18, fontSize: 10 }} />
        )}
        <Chip label={step.status} size="small" color={STATUS_COLORS[step.status] || 'default'} sx={{ height: 18, fontSize: 10 }} />
        {hasOutput && (
          <IconButton size="small">{expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}</IconButton>
        )}
      </Box>

      {step.status === 'running' && <LinearProgress sx={{ mt: 0.5, borderRadius: 1 }} />}

      <Collapse in={expanded}>
        {step.command && (
          <Typography fontSize={11} fontFamily="monospace" sx={{ mt: 0.5, color: '#8b8b8b' }}>
            $ {step.command.length > 200 ? step.command.substring(0, 200) + '...' : step.command}
          </Typography>
        )}
        {(step.stdout || step.stderr) && (
          <Box ref={outputRef} sx={{
            mt: 0.5, p: 1, bgcolor: '#1a1a2e', color: '#e0e0e0', borderRadius: 1,
            fontFamily: 'monospace', fontSize: 11, maxHeight: 250, overflow: 'auto',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {step.stdout && <Box component="span" sx={{ color: '#c8e6c9' }}>{step.stdout}</Box>}
            {step.stderr && <Box component="span" sx={{ color: '#ef9a9a' }}>{step.stderr}</Box>}
          </Box>
        )}
      </Collapse>
    </Box>
  );
}

export default function PipelineViewer({ open, onClose, pipelineId }) {
  const [pipeline, setPipeline] = useState(null);
  const [steps, setSteps] = useState([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!open || !pipelineId) return;

    const poll = async () => {
      try {
        const [p, s] = await Promise.all([getPipeline(pipelineId), getPipelineSteps(pipelineId)]);
        setPipeline(p);
        setSteps(s);
        if (p && (p.status === 'success' || p.status === 'failed' || p.status === 'cancelled')) {
          clearInterval(intervalRef.current);
        }
      } catch (e) {
        console.error('Pipeline poll error', e);
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 2000);
    return () => clearInterval(intervalRef.current);
  }, [open, pipelineId]);

  const handleCancel = async () => {
    if (!confirm('Cancel this deployment?')) return;
    try { await cancelPipeline(pipelineId); } catch (e) { alert(e.message); }
  };

  const isRunning = pipeline?.status === 'running';
  const progress = pipeline && pipeline.total_steps > 0
    ? ((pipeline.current_step || 0) / pipeline.total_steps) * 100 : 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" fontWeight={700} fontSize={15}>
            {pipeline?.name || 'Pipeline'}
          </Typography>
          {pipeline && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Chip label={pipeline.status} size="small" color={STATUS_COLORS[pipeline.status] || 'default'} />
              {pipeline.current_step > 0 && (
                <Typography fontSize={12} color="text.secondary">
                  Step {pipeline.current_step} / {pipeline.total_steps}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </DialogTitle>
      <DialogContent>
        {isRunning && <LinearProgress variant="determinate" value={progress} sx={{ mb: 2, borderRadius: 1 }} />}
        {steps.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Loading pipeline steps...</Typography>
        ) : (
          <Box sx={{ py: 1 }}>
            {steps.map((s, i) => <StepRow key={s.id} step={s} isLast={i === steps.length - 1} />)}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {isRunning && (
          <Button color="error" startIcon={<CancelIcon />} onClick={handleCancel}>Cancel</Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
