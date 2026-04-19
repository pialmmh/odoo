import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, Button, Alert, CircularProgress,
  Stepper, Step, StepLabel, IconButton, Divider,
} from '@mui/material';
import {
  ArrowBack as BackIcon, NavigateNext as NextIcon,
  NavigateBefore as PrevIcon,
} from '@mui/icons-material';
import {
  saveCampaign, listPolicies, listSchedulePolicies,
} from '../../../services/campaign';

import Step0Type     from './steps/Step0Type';
import Step1General  from './steps/Step1General';
import Step2Channel  from './steps/Step2Channel';
import Step3Policy   from './steps/Step3Policy';
import Step4Contacts from './steps/Step4Contacts';
import Step5Launch   from './steps/Step5Launch';

// Unified campaign wizard — 6 steps work for all 5 campaign types.
// Step 2 (Channel) renders a different sub-component depending on the
// campaignType chosen in Step 0.
//
// Backend today (SMSREST) is SMS-only and missing `campaign_type` column.
// Everything not understood by `save-campaign` is carried on the form and
// tracked in campaign/ui-vs-api-todo.md §15–§20.

const STEPS = ['Type', 'General', 'Channel', 'Policy', 'Contacts', 'Launch'];

const defaultBizHours = () => {
  const days = ['sun','mon','tue','wed','thu','fri','sat'];
  const weekday = d => !['fri','sat'].includes(d);  // BD: Fri+Sat weekend
  return Object.fromEntries(days.map(d => [d, {
    enabled: weekday(d), from: '09:00', to: '18:00', fullDay: false,
  }]));
};

const EMPTY = {
  id: null,

  // Step 0 — Type
  campaignType: 'SMS',                               // SMS | VOICE_AGENTLESS | VOICE_AGENT | EMAIL | HYBRID

  // Step 1 — General (US-centric fields dropped)
  name: '',
  description: '',
  timezone: 'UTC+06:00 Bangladesh Standard Time',
  startDate: '',
  endDate: '',
  businessHours: defaultBizHours(),

  // Step 2 — Channel (fields are type-conditional; unused ones ignored on save)
  // SMS
  senderId: '',
  message: '',
  isUnicode: false,
  isFlash: false,
  isLongSms: true,
  forbiddenWordGroupId: '',
  // Voice (agentless + agent)
  gatewayId: '',
  audioFilePath: '',
  audioFileName: '',
  amdEnabled: true,
  maxRingTime: 25,
  // Voice agent-assisted extras
  dialingMode: 'PROGRESSIVE',                        // PREVIEW | PROGRESSIVE | PREDICTIVE
  previewTime: 10,
  ringingAgentTime: 30,
  autoAnswerTimeout: 3,
  wrapUpTime: 30,
  linesPerAgent: 2,
  agentIds: [],
  // Voice shared
  defaultRetryPeriod: 30,
  maxAttempts: 3,
  // Email
  fromAddress: '',
  fromName: '',
  replyTo: '',
  subject: '',
  emailBody: '',
  emailTemplateId: '',
  // Hybrid
  channelPriority: ['SMS', 'VOICE_AGENTLESS'],       // ordered waterfall
  fallbackOn: { noRoute: true, sendFailure: true, timeout: false },

  // Step 3 — Policy
  policyId: '',
  schedulePolicyId: '',

  // Step 4 — Contacts
  phoneNumbers: '',
  emails: '',
  recordListName: '',

  // Step 5 — Launch
  scheduledAt: '',
  launchAction: 'draft',                             // draft | start | schedule
  taskBatchSize: 100,
  expireAt: '',
};

const needsPhones = (t) => t !== 'EMAIL';
const needsEmails = (t) => t === 'EMAIL' || t === 'HYBRID';

export default function CampaignEdit() {
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
    const t = form.campaignType;

    if (step === 0) {
      if (!t) return 'Pick a campaign type to continue.';
    }
    if (step === 1) {
      if (!form.name.trim()) return 'Campaign name is required.';
      if (!form.timezone)    return 'Timezone is required.';
    }
    if (step === 2) {
      if (t === 'SMS') {
        if (!form.senderId.trim()) return 'Sender ID is required.';
        if (!form.message.trim())  return 'Message body is required.';
      }
      if (t === 'VOICE_AGENTLESS' || t === 'VOICE_AGENT') {
        if (!form.audioFilePath.trim()) return 'Audio file is required.';
      }
      if (t === 'VOICE_AGENT' && form.agentIds.length === 0) {
        return 'Assign at least one agent (or pick Voice · Agentless).';
      }
      if (t === 'EMAIL') {
        if (!form.fromAddress.trim()) return 'From address is required.';
        if (!form.subject.trim())     return 'Subject is required.';
        if (!form.emailBody.trim() && !form.emailTemplateId) return 'Email body or template is required.';
      }
      if (t === 'HYBRID') {
        if (form.channelPriority.length < 2) return 'Hybrid campaigns need at least 2 channels.';
      }
    }
    if (step === 4) {
      if (needsPhones(t)) {
        const nums = form.phoneNumbers.split(/[\s,;]+/).filter(Boolean);
        if (!isEdit && nums.length === 0) return 'Upload or paste phone numbers.';
      }
      if (needsEmails(t)) {
        const addrs = form.emails.split(/[\s,;]+/).filter(Boolean);
        if (!isEdit && addrs.length === 0 && t === 'EMAIL') return 'Upload or paste email addresses.';
      }
    }
    if (step === 5) {
      if (form.launchAction === 'schedule' && !form.scheduledAt) {
        return 'Pick a scheduled start time.';
      }
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

  // Each launch action finalizes via a different call.
  const doSave = async (action) => {
    const err = validateStep();
    if (err) { setError(err); return; }

    const t = form.campaignType;
    const phones = form.phoneNumbers.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
    const mails  = form.emails.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);

    const dto = {
      ...(form.id && { id: form.id }),
      name: form.name.trim(),
      description: form.description,
      campaignType: t,
      timezone: form.timezone,
      startDate: form.startDate || null,
      endDate:   form.endDate   || null,
      businessHours: form.businessHours,

      // SMS
      ...(t === 'SMS' && {
        senderId: form.senderId.trim(),
        message: form.message,
        isUnicode: form.isUnicode,
        isFlash: form.isFlash,
        isLongSms: form.isLongSms,
        forbiddenWordGroupId: form.forbiddenWordGroupId || null,
      }),

      // Voice
      ...((t === 'VOICE_AGENTLESS' || t === 'VOICE_AGENT') && {
        senderId: form.senderId.trim(),
        gatewayId: form.gatewayId || null,
        audioFilePath: form.audioFilePath,
        amdEnabled: form.amdEnabled,
        maxRingTime: form.maxRingTime,
        defaultRetryPeriod: form.defaultRetryPeriod,
        maxAttempts: form.maxAttempts,
      }),
      ...(t === 'VOICE_AGENT' && {
        dialingMode: form.dialingMode,
        previewTime: form.previewTime,
        ringingAgentTime: form.ringingAgentTime,
        autoAnswerTimeout: form.autoAnswerTimeout,
        wrapUpTime: form.wrapUpTime,
        linesPerAgent: form.linesPerAgent,
        agentIds: form.agentIds,
      }),

      // Email
      ...(t === 'EMAIL' && {
        fromAddress: form.fromAddress,
        fromName: form.fromName,
        replyTo: form.replyTo,
        subject: form.subject,
        emailBody: form.emailBody,
        emailTemplateId: form.emailTemplateId || null,
      }),

      // Hybrid
      ...(t === 'HYBRID' && {
        channelPriority: form.channelPriority,
        fallbackOn: form.fallbackOn,
      }),

      policyId: form.policyId ? +form.policyId : null,
      schedulePolicyId: form.schedulePolicyId ? +form.schedulePolicyId : null,
      taskBatchSize: +form.taskBatchSize || 100,
      expireAt: form.expireAt || null,
      scheduledAt: form.scheduledAt || null,
      launchAction: action,

      ...(needsPhones(t) && { phoneNumberList: phones }),
      ...(needsEmails(t) && { emailList: mails }),
    };

    setSaving(true); setError(null);
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
          {isEdit ? 'Edit Campaign' : 'New Campaign'}
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
          {step === 0 && <Step0Type     {...stepProps} />}
          {step === 1 && <Step1General  {...stepProps} />}
          {step === 2 && <Step2Channel  {...stepProps} />}
          {step === 3 && <Step3Policy   {...stepProps} />}
          {step === 4 && <Step4Contacts {...stepProps} />}
          {step === 5 && <Step5Launch   {...stepProps} onLaunch={doSave} saving={saving} />}
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
            {/* Launch buttons rendered inside Step5Launch */}
          </Box>
        </Box>
      </Card>
    </Box>
  );
}
