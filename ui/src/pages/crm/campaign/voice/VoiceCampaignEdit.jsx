import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, Button, Alert, CircularProgress,
  Stepper, Step, StepLabel, IconButton, Divider,
} from '@mui/material';
import {
  ArrowBack as BackIcon, NavigateNext as NextIcon,
  NavigateBefore as PrevIcon, Check as CheckIcon,
} from '@mui/icons-material';
import {
  saveCampaign, listPolicies, listSchedulePolicies,
} from '../../../../services/voiceCampaign';

import Step1General  from './steps/Step1General';
import Step2Dialer   from './steps/Step2Dialer';
import Step3Agents   from './steps/Step3Agents';
import Step4Records  from './steps/Step4Records';

// 4-step campaign wizard, modelled on the MightyCall dialer wiki:
//   1 General Settings  2 Dialer Settings  3 Agents  4 Record List
//
// Backend today only accepts a subset of these fields (name, senderId,
// policyId, schedulePolicyId, audioFilePath, taskBatchSize, expireAt,
// phoneNumberList). Everything else is stored locally in form state and
// tracked in campaign/ui-vs-api-todo.md until the backend catches up.

const STEPS = ['General', 'Dialer', 'Agents', 'Record List'];

const defaultBizHours = () => {
  const days = ['sun','mon','tue','wed','thu','fri','sat'];
  const weekday = d => !['sun','sat'].includes(d);
  return Object.fromEntries(days.map(d => [d, {
    enabled: weekday(d), from: '08:00', to: '17:00', fullDay: false,
  }]));
};

const EMPTY = {
  id: null,
  // Step 1
  name: '',
  description: '',
  timezone: 'UTC-06:00 Central Time (US & Canada)',
  startDate: '',
  endDate: '',
  businessHours: defaultBizHours(),
  businessNumbers: [],      // [{ label, number }]
  autoRotate: false,
  localPresence: false,
  // Step 2
  dialingMode: 'PROGRESSIVE',   // PREVIEW | PROGRESSIVE | PREDICTIVE | AGENTLESS
  previewTime: 10,
  ringingAgentTime: 30,
  autoAnswerTimeout: 3,
  wrapUpTime: 30,
  maxRingTime: 25,
  linesPerAgent: 2,
  defaultRetryPeriod: 30,       // minutes
  maxAttempts: 3,
  amdEnabled: true,
  senderId: '',
  gatewayId: '',
  audioFilePath: '',
  audioFileName: '',
  policyId: '',
  schedulePolicyId: '',
  taskBatchSize: 100,
  expireAt: '',
  // Step 3
  agentIds: [],
  // Step 4
  recordListName: '',
  phoneNumbers: '',
};

export default function VoiceCampaignEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [policies, setPolicies] = useState([]);
  const [schedulePolicies, setSchedulePolicies] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.allSettled([listPolicies(), listSchedulePolicies()]).then(([p, s]) => {
      if (p.status === 'fulfilled') setPolicies(p.value?.content || p.value || []);
      if (s.status === 'fulfilled') setSchedulePolicies(s.value?.content || s.value || []);
    });
  }, []);

  const update = (patch) => setForm(f => ({ ...f, ...patch }));

  const validateStep = () => {
    if (step === 0) {
      if (!form.name.trim()) return 'Campaign name is required.';
      if (!form.timezone)    return 'Timezone is required.';
    }
    if (step === 1) {
      if (!form.senderId.trim())     return 'Sender CLI is required.';
      if (!form.audioFilePath.trim())return 'Audio file is required (upload WAV or enter path).';
    }
    if (step === 2 && form.dialingMode !== 'AGENTLESS') {
      if (form.agentIds.length === 0) return 'Assign at least one agent (or switch to Agentless mode).';
    }
    if (step === 3) {
      const nums = form.phoneNumbers.split(/[\s,;]+/).filter(Boolean);
      if (!isEdit && nums.length === 0) return 'Upload a record list or paste phone numbers.';
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError(null);
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };
  const goPrev = () => { setError(null); setStep(s => Math.max(s - 1, 0)); };

  const submit = async () => {
    const err = validateStep();
    if (err) { setError(err); return; }

    const numbers = form.phoneNumbers.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);

    // Backend DTO — only the fields SMSREST understands today.
    const dto = {
      ...(form.id && { id: form.id }),
      name: form.name.trim(),
      senderId: form.senderId.trim(),
      campaignType: 'VOICE',
      audioFilePath: form.audioFilePath,
      policyId: form.policyId ? +form.policyId : null,
      schedulePolicyId: form.schedulePolicyId ? +form.schedulePolicyId : null,
      gatewayId: form.gatewayId || null,
      taskBatchSize: +form.taskBatchSize || 100,
      expireAt: form.expireAt || null,
      phoneNumberList: numbers,
    };

    setSaving(true);
    setError(null);
    try {
      const res = await saveCampaign(dto);
      const newId = res?.campaignId || form.id;
      navigate(newId ? `../${newId}` : '..');
    } catch (e) {
      setError('Save failed: ' + (e?.response?.data?.message || e.message));
    }
    setSaving(false);
  };

  const stepProps = { form, update, policies, schedulePolicies };
  const isLast = step === STEPS.length - 1;

  return (
    <Box sx={{ px: 4, py: 3, maxWidth: 1060, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton size="small" onClick={() => navigate('..')}><BackIcon /></IconButton>
        <Typography variant="h6">
          {isEdit ? 'Edit Voice Campaign' : 'New Voice Campaign'}
        </Typography>
      </Box>

      <Card sx={{ px: 4, py: 3 }}>
        <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
          {STEPS.map(label => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box sx={{ minHeight: 420 }}>
          {step === 0 && <Step1General {...stepProps} />}
          {step === 1 && <Step2Dialer  {...stepProps} />}
          {step === 2 && <Step3Agents  {...stepProps} />}
          {step === 3 && <Step4Records {...stepProps} />}
        </Box>

        <Divider sx={{ my: 3 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={() => navigate('..')} disabled={saving}>Cancel</Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined" startIcon={<PrevIcon />}
              onClick={goPrev} disabled={step === 0 || saving}
            >
              Previous
            </Button>
            {!isLast && (
              <Button
                variant="contained" endIcon={<NextIcon />}
                onClick={goNext}
              >
                Next
              </Button>
            )}
            {isLast && (
              <Button
                variant="contained" color="primary"
                startIcon={saving ? <CircularProgress size={14} /> : <CheckIcon />}
                onClick={submit} disabled={saving}
              >
                {isEdit ? 'Save changes' : 'Create campaign'}
              </Button>
            )}
          </Box>
        </Box>
      </Card>
    </Box>
  );
}
