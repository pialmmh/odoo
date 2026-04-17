// DEV-ONLY email seeder.
//
// HOW TO RUN
// 1. Log in to orchestrix-v2 in the browser
// 2. Navigate to /:tenant/crm/emails so the JWT is warm
// 3. Open DevTools → Console
// 4. Paste the output of `seedEmails()` call below, or run:
//      import('/src/pages/crm/emails/__seed.js').then(m => m.seedEmails())
//
// Remove this file before production.

import { post } from '../../../services/crm';

const SENDERS = [
  { name: 'Acme Corp Billing',   email: 'billing@acme.example.com' },
  { name: 'GitHub',              email: 'noreply@github.com' },
  { name: 'Priya Sharma',        email: 'priya.sharma@techcorp.example' },
  { name: 'AWS Notifications',   email: 'no-reply@amazonaws.com' },
  { name: 'Oliver Bennett',      email: 'oliver@bennett-consulting.co' },
  { name: 'Stripe',              email: 'support@stripe.com' },
  { name: 'Marcus Chen',         email: 'm.chen@globallogistics.example' },
  { name: 'Sofia Rodriguez',     email: 'sofia@rivermarketing.example' },
  { name: 'Linear',              email: 'hello@linear.app' },
  { name: 'James Harrington',    email: 'james@techcorp.example' },
  { name: 'Slack',               email: 'feedback@slack.com' },
  { name: 'Anya Volkov',         email: 'a.volkov@nordicgroup.example' },
];

const BODIES = [
  {
    subject: 'Invoice #INV-2026-0412 is overdue',
    html: `<p>Hi there,</p><p>Our records show that <b>Invoice #INV-2026-0412</b> for $12,450.00 is now <span style="color:#dc2626;">14 days overdue</span>.</p><p>Please remit payment at your earliest convenience. You can pay online or contact us if there are any questions.</p><p>Thanks,<br>Acme Billing Team</p>`,
  },
  {
    subject: 'Your pull request has been approved',
    html: `<p>pialmmh approved your pull request <b>#482: Add Kanban view for opportunities</b> in <code>orchestrix-v2</code>.</p><blockquote>Great work on the dnd-kit integration — the optimistic updates feel really smooth. One small nit inline.</blockquote><p><a href="https://github.com">View on GitHub</a></p>`,
  },
  {
    subject: 'Proposal: Q2 infrastructure upgrade',
    html: `<p>Hi Team,</p><p>Following our call yesterday, I've attached the updated proposal for the Q2 infrastructure upgrade covering:</p><ul><li>Kubernetes migration (phase 1)</li><li>Observability stack rollout</li><li>Security audit & remediation</li></ul><p>Total estimate lands at <b>USD 184,500</b>, a 12% reduction from the previous scope. Let me know if you'd like to jump on a call.</p><p>Best,<br>Priya</p>`,
  },
  {
    subject: 'RDS CPU utilization alarm triggered',
    html: `<p><b>ALARM</b>: db-prod-primary CPU &gt; 85% for 10 minutes.</p><p>Region: ap-southeast-1<br>Time: ${new Date().toISOString()}</p><p><a href="#">View metrics</a></p>`,
  },
  {
    subject: 'Meeting summary — TechCorp Solutions',
    html: `<p>Hi,</p><p>Thanks for taking the time today. Quick recap:</p><ol><li><b>Scope:</b> agreed on 3-phase rollout starting Q2</li><li><b>Budget:</b> ceiling at $250K</li><li><b>Timeline:</b> kickoff target is 2026-05-15</li></ol><p>I'll send the signed MSA tomorrow.</p><p>Cheers,<br>Oliver</p>`,
  },
  {
    subject: 'Your Stripe payout has been sent',
    html: `<p>A payout of <b>USD 8,432.10</b> is on the way to your bank account ending in ••1234. It should arrive in 1–2 business days.</p>`,
  },
  {
    subject: 'Shipment #SH-78432 delivered',
    html: `<p>Your shipment has been delivered to the consignee at 14:32 local time.</p><p>POD attached. Please release payment per agreed terms.</p>`,
  },
  {
    subject: 'Content calendar draft for April',
    html: `<p>Hey!</p><p>Attached the draft calendar for April. Three big campaigns and a launch on the 18th. Let me know if you want to adjust the cadence before I send it to the team.</p><p>xo,<br>Sofia</p>`,
  },
  {
    subject: 'Issue ENG-4891 assigned to you',
    html: `<p><b>[Bug] Kanban column widths uneven on Firefox</b></p><p>Priority: Medium<br>Project: orchestrix-v2<br>Assignee: you</p>`,
  },
  {
    subject: 'Re: Pricing question for enterprise plan',
    html: `<p>Thanks for the thoughtful reply. One more follow-up:</p><p>Does the enterprise SLA include weekend coverage? Our ops team runs 7-day shifts so this is a must-have for us.</p><p>— James</p>`,
  },
  {
    subject: 'You have 3 unread messages in #sales',
    html: `<p>There's activity waiting for you in Slack:</p><ul><li><b>#sales</b> — 3 unread</li><li><b>#eng-backend</b> — 1 unread</li></ul>`,
  },
  {
    subject: 'Partnership inquiry — Nordic expansion',
    html: `<p>Hello,</p><p>I represent Nordic Group AS. We're evaluating CRM vendors for our Scandinavian rollout (approx. 400 seats). Your product came up in two of our reference calls.</p><p>Could we schedule a 30-min demo next week?</p><p>Warmly,<br>Anya Volkov</p>`,
  },
];

const SUBJECTS_SHORT = BODIES.map(b => b.subject);

function randomPast(days) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * days));
  d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function createEmail(overrides = {}) {
  const sender = pick(SENDERS);
  const body = pick(BODIES);
  const payload = {
    name: body.subject,
    from: sender.email,
    fromName: sender.name,
    fromEmailAddress: sender.email,
    to: 'me@orchestrix.example',
    status: 'Received',
    dateSent: randomPast(30),
    isRead: Math.random() > 0.4,
    isImportant: Math.random() > 0.8,
    body: body.html,
    bodyPlain: body.html.replace(/<[^>]+>/g, ''),
    isHtml: true,
    ...overrides,
  };
  try {
    const created = await post('/Email', payload);
    return created;
  } catch (e) {
    console.error('Failed to create email:', e?.response?.data || e.message);
    return null;
  }
}

export async function seedEmails(count = 30) {
  console.log(`Seeding ${count} sample emails…`);
  const results = [];
  for (let i = 0; i < count; i++) {
    // Some as Sent, some Draft, most Received
    const roll = Math.random();
    let overrides = {};
    if (roll < 0.15) overrides = { status: 'Sent', fromName: 'You', fromEmailAddress: 'me@orchestrix.example', to: pick(SENDERS).email };
    else if (roll < 0.20) overrides = { status: 'Draft' };
    const r = await createEmail(overrides);
    if (r) results.push(r);
    // small gap to avoid rate limits
    await new Promise(r => setTimeout(r, 80));
  }
  console.log(`Done — created ${results.length} emails. Refresh /crm/emails to see them.`);
  return results;
}

// Delete seeded emails (only those with our synthetic sender addresses).
export async function unseedEmails() {
  const { listEmails, deleteEmail } = await import('../../../services/crm');
  const senderEmails = SENDERS.map(s => s.email);
  const toDelete = [];
  for (const addr of senderEmails) {
    const res = await listEmails({
      maxSize: 100,
      'where[0][type]': 'equals',
      'where[0][attribute]': 'fromEmailAddress',
      'where[0][value]': addr,
      select: 'id',
    });
    (res.list || []).forEach(e => toDelete.push(e.id));
  }
  console.log(`Deleting ${toDelete.length} seeded emails…`);
  for (const id of toDelete) {
    try { await deleteEmail(id); } catch { /* ignore */ }
  }
  console.log('Done.');
}

// Attach to window for easy console access in dev.
if (typeof window !== 'undefined') {
  window.seedEmails  = seedEmails;
  window.unseedEmails = unseedEmails;
}
