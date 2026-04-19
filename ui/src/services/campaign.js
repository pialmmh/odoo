import axios from 'axios';
import { getToken } from './keycloak';

// ── Voice Campaign client ──
//
// All calls route through APISIX gateway:
//   /api/smsrest/...        → SMSREST service       (campaign + policy + task CRUD)
//   /api/freeswitchrest/... → FreeSwitchREST service (audio upload, live metrics)
//
// Backend reference: /tmp/shared-instruction/voice-campaign-backend-integration.md
// Pending backend items tracked in: routesphere-architect/campaign/ui-vs-api-todo.md

const sms = axios.create({
  baseURL: '/api/smsrest',
  headers: { 'Content-Type': 'application/json' },
});

const fs = axios.create({
  baseURL: '/api/freeswitchrest',
});

// Attach Keycloak JWT — save-campaign and mutating endpoints require it.
for (const client of [sms, fs]) {
  client.interceptors.request.use(async (config) => {
    let token = getToken();
    if (!token) {
      for (let i = 0; i < 6; i++) {
        await new Promise(r => setTimeout(r, 500));
        token = getToken();
        if (token) break;
      }
    }
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
}

// ── Campaign CRUD ──
// POST /SMSREST/campaign/get-campaigns         — paged list
// POST /SMSREST/campaign/save-campaign         — upsert (requires jwt)
// POST /SMSREST/campaign/enableCampaign        — mark active
// POST /SMSREST/campaign/disableCampaign       — mark inactive

export const listCampaigns = (page = 0, size = 25) =>
  sms.post('/campaign/get-campaigns', { page, size }).then(r => r.data);

/**
 * Save (create or update) a campaign.
 * For voice campaigns, set campaignType='VOICE' and provide audioFilePath
 * (as returned by uploadAudio()). Backend schema addition pending — see TODO.
 */
export const saveCampaign = (dto) =>
  sms.post('/campaign/save-campaign', dto).then(r => r.data);

export const enableCampaign  = (dto) => sms.post('/campaign/enableCampaign',  dto).then(r => r.data);
export const disableCampaign = (dto) => sms.post('/campaign/disableCampaign', dto).then(r => r.data);

// ── Campaign Tasks ──
// POST /SMSREST/campaignTask/get-campaign-tasks-by-campaignId
//      { page, size, startTime?, endTime?, phoneNumber?, campaignId }

export const listCampaignTasks = (campaignId, filters = {}) => {
  const body = {
    page: filters.page ?? 0,
    size: filters.size ?? 25,
    campaignId,
    ...(filters.startTime   && { startTime:   filters.startTime   }),
    ...(filters.endTime     && { endTime:     filters.endTime     }),
    ...(filters.phoneNumber && { phoneNumber: filters.phoneNumber }),
  };
  return sms.post('/campaignTask/get-campaign-tasks-by-campaignId', body).then(r => r.data);
};

// ── Policy engine ──
// Full CRUD for each axis — Policy, TimeBand, RetryInterval, RetryCauseCode, SchedulePolicy.
// For now UI reads list endpoints; full CRUD wiring is a later task.

export const listPolicies         = () => sms.get('/api/policies').then(r => r.data);
export const listTimeBands        = () => sms.get('/api/timeBands').then(r => r.data);
export const listRetryIntervals   = () => sms.get('/api/retry-intervals').then(r => r.data);
export const listRetryCauseCodes  = () => sms.get('/api/retry-cause-codes').then(r => r.data);
export const listSchedulePolicies = () => sms.get('/api/schedulePolicies').then(r => r.data);
export const listThrottlingRules  = () => sms.get('/api/throttlingRules').then(r => r.data);
export const listEnumSmsErrors    = () => sms.get('/api/enumSmsErrors').then(r => r.data);

// ── Audio upload (FreeSwitchREST) ──
// Pending backend: dedicated upload endpoint POST /api/broadcast/upload-audio
// that ONLY uploads and returns the relative path (e.g. 'custom/april_promo.wav').
// Today only /play-audio exists and combines upload + dispatch.
// UI uses the pending endpoint; until wired, saveCampaign() with audioFilePath
// should still work if the file is pre-placed on the FS host.

export const uploadAudio = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return fs.post('/api/broadcast/upload-audio', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data); // expected: { path: 'custom/foo.wav' }
};

// ── Live metrics (pre-dispatch throttle) ──
export const getConcurrentCall         = ()          => fs.get('/api/broadcast/getConcurrentCall').then(r => r.data);
export const getPartnerConcurrentLimit = (partnerId) => fs.get('/api/broadcast/get-partner-concurrent-call-limit', { params: { partnerId } }).then(r => r.data);

// ── FreeSwitchREST infrastructure ──
// VGateway (outbound trunks) and VRecording (audio prompt library) come from
// the FusionPBX postgres via FreeSwitchREST. Used in the campaign wizard to
// replace free-text audio paths and sender CLI assumptions with real pickers.

export const listGateways   = () => fs.get('/api/v1/gateways').then(r => r.data);
export const listRecordings = () => fs.get('/api/v1/recordings').then(r => r.data);

// ── Launch actions ──
// Schedule a campaign for a future start. Backend endpoint pending — today
// `scheduledAt` is stored as part of save-campaign DTO. See gap tracker §16.
export const scheduleCampaign = (id, scheduledAt) =>
  sms.post('/campaign/schedule-campaign', { id, scheduledAt }).then(r => r.data);

// ── Constants ──

export const CAMPAIGN_TYPES = [
  'SMS',
  'VOICE_AGENTLESS',
  'VOICE_AGENT',
  'EMAIL',
  'HYBRID',
];

// Channels selectable as hybrid fallback steps.
export const CHANNELS = ['SMS', 'VOICE_AGENTLESS', 'VOICE_AGENT', 'EMAIL'];

// Triggers that advance to the next channel in a hybrid waterfall.
export const HYBRID_FALLBACK_TRIGGERS = {
  noRoute:     'No route available',
  sendFailure: 'Send failure',
  timeout:     'Delivery timeout',
};

// UI-level synthetic "campaign status" derived from enabled + expireAt.
// Actual DB column is `enabled` boolean; no unified status column exists.
export const CAMPAIGN_STATUS = {
  ENABLED:  'Enabled',
  DISABLED: 'Disabled',
  EXPIRED:  'Expired',
};

// Disposition values the runner should write on CHANNEL_HANGUP_COMPLETE.
// See voice-campaign-backend-integration.md §4c.
export const DISPOSITIONS = [
  'ANSWERED_HUMAN',
  'ANSWERED_MACHINE',
  'BUSY',
  'NO_ANSWER',
  'REJECTED',
  'INVALID_NUMBER',
  'CARRIER_FAILURE',
];

export const DISPOSITION_COLOR = {
  ANSWERED_HUMAN:   { bg: 'success.light', color: 'success.dark' },
  ANSWERED_MACHINE: { bg: 'info.light',    color: 'info.dark'    },
  BUSY:             { bg: 'warning.light', color: 'warning.dark' },
  NO_ANSWER:        { bg: 'warning.light', color: 'warning.dark' },
  REJECTED:         { bg: 'error.light',   color: 'error.dark'   },
  INVALID_NUMBER:   { bg: 'error.light',   color: 'error.dark'   },
  CARRIER_FAILURE:  { bg: 'error.light',   color: 'error.dark'   },
};

// campaign_task.state values used by the runner.
// Copied from RTC-Manager/smsrest conventions.
export const TASK_STATE = {
  PENDING:   6,   // ready to dispatch
  IN_FLIGHT: 1,   // dispatched, awaiting result
  SUCCESS:   2,
  FAILED:    3,
  TIMEOUT:   16,
};
