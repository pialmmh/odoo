# EspoCRM Email Module — React Frontend Integration Guide

> **Goal:** Build a modern React-based email client UI on top of EspoCRM's existing email backend. EspoCRM handles all the hard parts (IMAP sync, SMTP sending, MIME parsing, threading, CRM record linking, attachments). React handles the presentation, UX, and CRM-specific custom actions.

---

## 1. Architecture Overview

```
┌───────────────────────────────────────────────────────────────┐
│                     React Frontend (SPA)                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │  Folder     │  │  Message     │  │  Message Viewer    │    │
│  │  Sidebar    │  │  List        │  │  + Compose Panel   │    │
│  └─────────────┘  └──────────────┘  └────────────────────┘    │
│         │                │                     │              │
│         └────────────────┴─────────────────────┘              │
│                          │                                    │
│            ┌─────────────▼──────────────┐                     │
│            │   EspoEmailClient (adapter) │                     │
│            │   - TanStack Query cache    │                     │
│            │   - Zustand UI state        │                     │
│            └─────────────┬──────────────┘                     │
└──────────────────────────┼────────────────────────────────────┘
                           │ HTTPS + API key / session
                           ▼
┌───────────────────────────────────────────────────────────────┐
│                   EspoCRM Backend (PHP)                       │
│  - /api/v1/Email, /EmailFolder, /Attachment                   │
│  - InboundEmail (IMAP sync, background jobs)                  │
│  - OutboundEmail (SMTP sending)                               │
│  - WebSocket daemon (real-time notifications)                 │
│  - Entity relationships: Lead, Account, Opportunity, Case     │
└───────────────────────────────────────────────────────────────┘
```

**Key principle:** The React app is a *presentation layer only*. All business logic, data persistence, IMAP/SMTP protocol work, and CRM relationships stay in EspoCRM. Don't reimplement anything that EspoCRM already does.

---

## 2. Authentication Setup

### 2.1 Choose an auth method

Two realistic options. Pick one and stick with it.

| Method | Use when | Complexity |
|--------|----------|------------|
| **API key (per user)** | React SPA hosted on a different origin than EspoCRM | Low |
| **Session cookie** | React app served from the same origin as EspoCRM | Medium (CORS + CSRF considerations) |

**Recommendation:** Use API key. It's simpler for an SPA, works across origins without CORS drama, and each user gets their own key tied to their EspoCRM user account and ACL.

### 2.2 Generate API keys in EspoCRM

1. Log in as admin → **Administration → Users**
2. For each user, set **Authentication Method → API Key**, or create a companion API user
3. For richer auth, use **HMAC** (signed requests) — needed if you can't securely store plain API keys client-side

For a user-facing app where users log in with username + password, implement this flow instead:

```
React login form → POST /api/v1/App/user (with Basic Auth header)
                → EspoCRM returns user details + auth token
                → Store token in memory (or sessionStorage)
                → Send as Espo-Authorization-Token header on subsequent requests
```

### 2.3 Configure CORS in EspoCRM

Edit `data/config.php`:

```php
'cors' => [
    'allowCredentials' => true,
    'allowOrigin' => ['https://crm-ui.telcobright.com'],
    'allowMethods' => ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    'allowHeaders' => [
        'Content-Type', 'Authorization', 'Espo-Authorization',
        'Espo-Authorization-Token', 'X-Api-Key', 'X-Requested-With'
    ],
],
```

Restart nginx/Apache after changes.

### 2.4 Auth header in React

```ts
// src/api/auth.ts
export function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem('espo_auth_token');
  if (!token) throw new Error('Not authenticated');
  return {
    'Espo-Authorization-Token': token,
    'Content-Type': 'application/json',
  };
}
```

---

## 3. API Client Adapter

The adapter is the single integration surface. Every UI component consumes this interface; nothing talks to `fetch` directly.

### 3.1 Interface

```ts
// src/api/types.ts
export interface EmailSummary {
  id: string;
  subject: string;
  fromName: string;
  fromAddress: string;
  dateSent: string;
  isRead: boolean;
  isImportant: boolean;
  hasAttachment: boolean;
  status: 'Sent' | 'Received' | 'Draft' | 'Sending';
  parentType?: string;   // e.g. 'Lead', 'Account'
  parentId?: string;
  parentName?: string;
}

export interface Email extends EmailSummary {
  body: string;        // HTML
  bodyPlain: string;   // plain text fallback
  to: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  attachmentsIds: string[];
  attachmentsNames: Record<string, string>;
  replied?: string;    // id of email this replies to
  messageId?: string;
}

export interface Folder {
  id: string;
  name: string;
  type: 'inbox' | 'sent' | 'drafts' | 'trash' | 'archive' | 'custom';
  unreadCount: number;
}

export interface ListOpts {
  offset?: number;
  limit?: number;
  search?: string;
  orderBy?: string;
  order?: 'asc' | 'desc';
  filters?: Record<string, unknown>;
}
```

### 3.2 Implementation

```ts
// src/api/espo-email-client.ts
import { getAuthHeaders } from './auth';
import type { Email, EmailSummary, Folder, ListOpts } from './types';

const BASE = import.meta.env.VITE_ESPO_BASE_URL;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...getAuthHeaders(), ...(init.headers || {}) },
  });
  if (!res.ok) {
    throw new EspoApiError(res.status, await res.text());
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export class EspoEmailClient {
  async listFolders(): Promise<Folder[]> {
    const res = await request<{ list: any[] }>('/api/v1/EmailFolder?maxSize=200');
    return res.list.map(normalizeFolder);
  }

  async listEmails(folderId: string, opts: ListOpts = {}): Promise<EmailSummary[]> {
    const params = new URLSearchParams({
      'orderBy': opts.orderBy ?? 'dateSent',
      'order': opts.order ?? 'desc',
      'offset': String(opts.offset ?? 0),
      'maxSize': String(opts.limit ?? 50),
      'select': 'id,subject,fromName,fromEmailAddress,dateSent,isRead,isImportant,hasAttachment,status,parentType,parentId,parentName',
    });
    // Folder filter — EspoCRM uses special values for system folders
    if (folderId === 'inbox') {
      params.set('where[0][type]', 'isNull');
      params.set('where[0][attribute]', 'folderId');
    } else {
      params.set('where[0][type]', 'equals');
      params.set('where[0][attribute]', 'folderId');
      params.set('where[0][value]', folderId);
    }
    if (opts.search) {
      params.set('where[1][type]', 'textSearch');
      params.set('where[1][value]', opts.search);
    }
    const res = await request<{ list: any[]; total: number }>(
      `/api/v1/Email?${params}`
    );
    return res.list.map(normalizeEmailSummary);
  }

  async getEmail(id: string): Promise<Email> {
    const raw = await request<any>(`/api/v1/Email/${id}`);
    // Auto-mark as read (EspoCRM does this server-side, but we trigger it)
    if (!raw.isRead) {
      this.updateEmail(id, { isRead: true }).catch(() => {});
    }
    return normalizeEmail(raw);
  }

  async sendEmail(draft: Partial<Email>): Promise<Email> {
    const body = JSON.stringify({ ...draft, status: 'Sending' });
    const raw = await request<any>('/api/v1/Email', { method: 'POST', body });
    return normalizeEmail(raw);
  }

  async saveDraft(draft: Partial<Email>): Promise<Email> {
    const body = JSON.stringify({ ...draft, status: 'Draft' });
    if (draft.id) {
      return normalizeEmail(
        await request<any>(`/api/v1/Email/${draft.id}`, { method: 'PUT', body })
      );
    }
    return normalizeEmail(await request<any>('/api/v1/Email', { method: 'POST', body }));
  }

  async updateEmail(id: string, patch: Partial<Email>): Promise<Email> {
    const raw = await request<any>(`/api/v1/Email/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    return normalizeEmail(raw);
  }

  async deleteEmail(id: string): Promise<void> {
    await request<void>(`/api/v1/Email/${id}`, { method: 'DELETE' });
  }

  async moveToFolder(ids: string[], folderId: string | null): Promise<void> {
    // EspoCRM supports mass update via a dedicated endpoint
    await request<void>('/api/v1/Email/action/massUpdate', {
      method: 'POST',
      body: JSON.stringify({
        ids,
        data: { folderId },
      }),
    });
  }

  async markRead(ids: string[], isRead: boolean): Promise<void> {
    await request<void>('/api/v1/Email/action/massUpdate', {
      method: 'POST',
      body: JSON.stringify({ ids, data: { isRead } }),
    });
  }

  async linkToParent(
    id: string,
    parentType: 'Lead' | 'Account' | 'Contact' | 'Opportunity' | 'Case',
    parentId: string
  ): Promise<void> {
    await request<void>(`/api/v1/Email/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ parentType, parentId }),
    });
  }

  // Attachments — two-step: upload first, then attach IDs to email
  async uploadAttachment(file: File, relatedType = 'Email'): Promise<{ id: string; name: string }> {
    const base64 = await fileToBase64(file);
    const raw = await request<any>('/api/v1/Attachment', {
      method: 'POST',
      body: JSON.stringify({
        name: file.name,
        type: file.type,
        size: file.size,
        role: 'Attachment',
        relatedType,
        file: base64,
      }),
    });
    return { id: raw.id, name: raw.name };
  }

  getAttachmentDownloadUrl(attachmentId: string): string {
    return `${BASE}/api/v1/Attachment/file/${attachmentId}`;
  }

  // For reply/forward — copy attachments so they can be resent
  async copyAttachments(fromEmailId: string): Promise<Record<string, string>> {
    const res = await request<{ ids: string[]; names: Record<string, string> }>(
      `/api/v1/Email/action/getCopiedAttachments?id=${fromEmailId}`
    );
    return res.names;
  }
}

// Helpers
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function normalizeFolder(raw: any): Folder { /* ... */ }
function normalizeEmail(raw: any): Email { /* ... */ }
function normalizeEmailSummary(raw: any): EmailSummary { /* ... */ }

class EspoApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`Espo API ${status}: ${body}`);
  }
}
```

---

## 4. HTML Email Rendering — Security Critical

**This is the single biggest risk area. Do not skip.**

Email HTML comes from untrusted senders and may contain tracking pixels, JS, CSS that breaks your app, phishing links, and other surprises. Render it in a sandboxed iframe with sanitization.

### 4.1 Sanitization + iframe pattern

```tsx
// src/components/MessageBody.tsx
import DOMPurify from 'dompurify';
import { useEffect, useRef, useState } from 'react';

interface Props {
  html: string;
  showRemoteImages: boolean;
  onRemoteImagesDetected: () => void;
}

export function MessageBody({ html, showRemoteImages, onRemoteImagesDetected }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);

  useEffect(() => {
    const hasRemoteImages = /<img[^>]+src=["']https?:\/\//i.test(html);
    if (hasRemoteImages && !showRemoteImages) {
      onRemoteImagesDetected();
    }

    const cleaned = DOMPurify.sanitize(html, {
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
      ALLOW_DATA_ATTR: false,
    });

    const finalHtml = showRemoteImages
      ? cleaned
      : cleaned.replace(/<img([^>]+)src=["']https?:\/\/[^"']+["']/gi, '<img$1src=""');

    const doc = `<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <base target="_blank">
      <style>
        body { font-family: system-ui, sans-serif; margin: 0; padding: 16px;
               color: #222; word-wrap: break-word; }
        img { max-width: 100%; height: auto; }
        a { color: #0066cc; }
        blockquote { border-left: 3px solid #ddd; margin-left: 0;
                     padding-left: 12px; color: #666; }
      </style>
    </head><body>${finalHtml}</body></html>`;

    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.srcdoc = doc;

    const onLoad = () => {
      const body = iframe.contentDocument?.body;
      if (body) setHeight(body.scrollHeight + 32);
    };
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [html, showRemoteImages]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-same-origin allow-popups"
      style={{ width: '100%', border: 'none', height: `${height}px` }}
      title="Email body"
    />
  );
}
```

**Key points:**
- `sandbox="allow-same-origin allow-popups"` blocks scripts but lets links open in new tabs (via `<base target="_blank">`)
- Remote images blocked by default with an opt-in banner ("Show images from this sender")
- DOMPurify strips dangerous tags and attributes
- `srcdoc` keeps the whole thing out of the main document — styles can't leak in or out
- Iframe height auto-adjusts to content to avoid nested scrollbars

### 4.2 Handling cid: inline images

Emails embed images using `<img src="cid:abc123">` where `abc123` is an attachment's content-id. Resolve these before sanitizing:

```ts
function resolveCidImages(html: string, attachments: Record<string, string>): string {
  return html.replace(/src=["']cid:([^"']+)["']/gi, (_, cid) => {
    const attachmentId = findAttachmentByContentId(cid, attachments);
    return attachmentId
      ? `src="${espoClient.getAttachmentDownloadUrl(attachmentId)}"`
      : 'src=""';
  });
}
```

EspoCRM's attachment metadata includes `contentId` — use it for the lookup.

---

## 5. Data Layer — TanStack Query + Zustand

### 5.1 Why this split

- **TanStack Query** — server state (emails, folders, attachments). Handles caching, background refetch, optimistic updates, invalidation.
- **Zustand** — pure UI state (selected email, compose panel open/closed, sidebar width, keyboard focus). No server data here.

### 5.2 Query hooks

```ts
// src/queries/emails.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { espoClient } from '@/api/client';

export function useFolders() {
  return useQuery({
    queryKey: ['folders'],
    queryFn: () => espoClient.listFolders(),
    staleTime: 60_000,
  });
}

export function useEmailList(folderId: string, search?: string) {
  return useQuery({
    queryKey: ['emails', folderId, search],
    queryFn: () => espoClient.listEmails(folderId, { search, limit: 50 }),
    staleTime: 30_000,
    refetchInterval: 60_000,  // poll for new mail
  });
}

export function useEmail(id: string | null) {
  return useQuery({
    queryKey: ['email', id],
    queryFn: () => espoClient.getEmail(id!),
    enabled: !!id,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, isRead }: { ids: string[]; isRead: boolean }) =>
      espoClient.markRead(ids, isRead),
    onMutate: async ({ ids, isRead }) => {
      // Optimistic update — the list updates instantly
      await qc.cancelQueries({ queryKey: ['emails'] });
      qc.setQueriesData({ queryKey: ['emails'] }, (old: any) =>
        old?.map((e: any) => (ids.includes(e.id) ? { ...e, isRead } : e))
      );
    },
    onError: () => qc.invalidateQueries({ queryKey: ['emails'] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] }); // unread counts
    },
  });
}
```

### 5.3 UI state store

```ts
// src/state/ui-store.ts
import { create } from 'zustand';

interface UIState {
  selectedFolderId: string;
  selectedEmailId: string | null;
  selectedIds: Set<string>;  // for batch operations
  composeOpen: boolean;
  composeDraft: Partial<Email> | null;

  selectFolder: (id: string) => void;
  selectEmail: (id: string | null) => void;
  toggleSelect: (id: string) => void;
  openCompose: (prefill?: Partial<Email>) => void;
  closeCompose: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedFolderId: 'inbox',
  selectedEmailId: null,
  selectedIds: new Set(),
  composeOpen: false,
  composeDraft: null,

  selectFolder: (id) => set({ selectedFolderId: id, selectedEmailId: null }),
  selectEmail: (id) => set({ selectedEmailId: id }),
  toggleSelect: (id) => set((s) => {
    const next = new Set(s.selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    return { selectedIds: next };
  }),
  openCompose: (prefill) => set({ composeOpen: true, composeDraft: prefill ?? {} }),
  closeCompose: () => set({ composeOpen: false, composeDraft: null }),
}));
```

---

## 6. Compose Panel — Send Flow

The compose flow has a few gotchas around EspoCRM's two-step attachment handling and its async send semantics.

### 6.1 Flow

```
1. User clicks Compose / Reply / Forward
2. UI opens compose panel (Zustand: composeOpen = true)
3. For reply/forward: prefill To, Subject (Re:/Fwd:), quoted body
   For forward: also call copyAttachments() to duplicate originals
4. User attaches files → each file goes through uploadAttachment() immediately,
   returning an ID. UI shows chip with filename + remove button.
5. On Send:
   - POST /api/v1/Email with status=Sending and attachmentsIds
   - EspoCRM background job picks it up, sends via configured SMTP, 
     updates status to Sent (or Failed)
   - UI shows "Sending..." state, polls status every few seconds
6. On Save Draft:
   - POST or PUT /api/v1/Email with status=Draft
   - User can reopen from Drafts folder
```

### 6.2 Rich text editor

Use **TipTap** (built on ProseMirror). It's the most production-ready option for a Gmail-style composer and handles the HTML generation cleanly. Configure it to output the HTML shape EspoCRM expects (inline styles, no classes).

Avoid:
- ~~Slate~~ — too low-level, you'll rebuild half of TipTap
- ~~Quill~~ — old architecture, hard to extend for features like @-mentions
- ~~Draft.js~~ — abandoned

TipTap extensions worth enabling: StarterKit, Link, Image, Placeholder, Table. Skip Collaboration unless you actually need it.

### 6.3 Draft auto-save

Debounced auto-save every 5 seconds while compose is open:

```ts
useEffect(() => {
  if (!composeDraft || !composeDraft.body) return;
  const timer = setTimeout(() => {
    espoClient.saveDraft(composeDraft).then((saved) => {
      if (!composeDraft.id) {
        useUIStore.setState({ composeDraft: { ...composeDraft, id: saved.id } });
      }
    });
  }, 5000);
  return () => clearTimeout(timer);
}, [composeDraft]);
```

---

## 7. CRM-Specific Features

This is where your custom frontend earns its keep versus a generic webmail.

### 7.1 Link email to a CRM record

```tsx
function LinkToRecordButton({ email }: { email: Email }) {
  const [picker, setPicker] = useState<{ type: string } | null>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownItem onClick={() => setPicker({ type: 'Lead' })}>Link to Lead</DropdownItem>
        <DropdownItem onClick={() => setPicker({ type: 'Account' })}>Link to Account</DropdownItem>
        <DropdownItem onClick={() => setPicker({ type: 'Opportunity' })}>Link to Opportunity</DropdownItem>
        <DropdownItem onClick={() => setPicker({ type: 'Case' })}>Link to Case</DropdownItem>
      </DropdownMenu>
      {picker && (
        <RecordPickerModal
          entityType={picker.type}
          onSelect={async (id) => {
            await espoClient.linkToParent(email.id, picker.type as any, id);
            queryClient.invalidateQueries({ queryKey: ['email', email.id] });
            setPicker(null);
          }}
        />
      )}
    </>
  );
}
```

The `RecordPickerModal` queries `/api/v1/{EntityType}?q={searchTerm}` with debounced input.

### 7.2 Auto-suggest linked record from sender

When opening an email, check if the sender's address matches a known Contact/Lead:

```ts
async function suggestParent(fromAddress: string) {
  const [contacts, leads] = await Promise.all([
    request(`/api/v1/Contact?where[0][type]=equals&where[0][attribute]=emailAddress&where[0][value]=${fromAddress}&maxSize=1`),
    request(`/api/v1/Lead?where[0][type]=equals&where[0][attribute]=emailAddress&where[0][value]=${fromAddress}&maxSize=1`),
  ]);
  return contacts.list[0] || leads.list[0] || null;
}
```

Show a subtle banner: *"This email is from John Doe (Lead). [Link to this record]"*

### 7.3 Convert email to a new record

Quick action: **"Create Lead from this email"**:

```ts
async function createLeadFromEmail(email: Email) {
  const lead = await request('/api/v1/Lead', {
    method: 'POST',
    body: JSON.stringify({
      firstName: parseFirstName(email.fromName),
      lastName: parseLastName(email.fromName),
      emailAddress: email.fromAddress,
      description: `Created from email: ${email.subject}`,
    }),
  });
  await espoClient.linkToParent(email.id, 'Lead', lead.id);
  return lead;
}
```

### 7.4 Activity timeline on message view

When an email has a parent record, show related activities inline:

```ts
useQuery({
  queryKey: ['activities', email.parentType, email.parentId],
  queryFn: () => request(
    `/api/v1/Activities/${email.parentType}/${email.parentId}?maxSize=10`
  ),
  enabled: !!email.parentId,
});
```

Render recent calls, meetings, other emails, tasks — gives the agent immediate context without leaving the inbox.

---

## 8. Real-Time Updates

### 8.1 Option A — Polling (simplest, recommended to start)

Already built in via TanStack Query's `refetchInterval: 60_000` on the email list. Good enough for most use cases. Add `refetchOnWindowFocus: true` so the list refreshes when the user returns to the tab.

### 8.2 Option B — EspoCRM WebSocket

EspoCRM has a built-in WebSocket daemon for real-time notifications. Enable in config:

```php
// data/config.php
'useWebSocket' => true,
'webSocketUrl' => 'wss://crm.telcobright.com/wss',
```

Then subscribe in React:

```ts
// src/hooks/useEspoWebSocket.ts
export function useEspoWebSocket(onMessage: (evt: any) => void) {
  useEffect(() => {
    const token = sessionStorage.getItem('espo_auth_token');
    const ws = new WebSocket(
      `wss://crm.telcobright.com/wss?authToken=${token}`
    );
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.category === 'notification' && data.type === 'Email') {
        onMessage(data);
      }
    };
    return () => ws.close();
  }, []);
}
```

On new mail event, invalidate the email list and folder counts:

```ts
useEspoWebSocket((evt) => {
  queryClient.invalidateQueries({ queryKey: ['emails'] });
  queryClient.invalidateQueries({ queryKey: ['folders'] });
});
```

---

## 9. Threading / Conversation View

EspoCRM doesn't do Gmail-style thread grouping out of the box; it tracks reply chains via the `replied` field and `messageId` / `parentMessageId` headers. You have two options:

**Flat with reply indicators (easier, ship first):** Show emails as a flat list, with a small "↩ reply to: {subject}" badge on replies. Clicking it scrolls to or opens the parent email.

**Conversation grouping (nicer UX, more work):** Client-side group emails by normalized subject + participants, then order by date within each group. EspoCRM also exposes `groupFolderId` which helps here. Render as a collapsed thread that expands on click.

Ship flat first. Upgrade to threads in a second iteration once the base UI is stable.

---

## 10. Keyboard Shortcuts

Non-negotiable for a serious email client. Power users expect them.

| Key | Action |
|-----|--------|
| `j` / `k` | Next / previous email |
| `Enter` / `o` | Open selected email |
| `Esc` | Close viewer / deselect |
| `c` | Compose new |
| `r` | Reply |
| `R` (shift+r) | Reply all |
| `f` | Forward |
| `e` | Archive |
| `#` | Delete |
| `s` | Star / flag |
| `u` | Mark unread |
| `/` | Focus search |
| `g` then `i` | Go to Inbox |
| `g` then `s` | Go to Sent |
| `?` | Show shortcut help |

Use **react-hotkeys-hook** — simple, well-maintained, handles input-field edge cases correctly.

---

## 11. Recommended Tech Stack

| Concern | Choice | Why |
|---------|--------|-----|
| Build tool | **Vite** | Fast dev, simple config, no Next.js overhead needed |
| Router | **TanStack Router** or **React Router v7** | Type-safe routing |
| Server state | **TanStack Query** | Caching, optimistic updates, polling built-in |
| UI state | **Zustand** | Minimal, no boilerplate |
| Components | **shadcn/ui** + **Radix** | Copy-paste, fully customizable, accessible |
| Styling | **Tailwind CSS v4** | Fast, consistent, composable |
| Rich text | **TipTap** | Production-ready composer |
| Virtualization | **TanStack Virtual** | For 10k+ email lists |
| HTML sanitization | **DOMPurify** | Industry standard |
| Keyboard | **react-hotkeys-hook** | Clean API |
| Icons | **Lucide** | Large set, tree-shakeable |
| Date formatting | **date-fns** | Modular, small bundle |

---

## 12. Project Structure

```
src/
├── api/
│   ├── auth.ts
│   ├── client.ts              # espoClient singleton
│   ├── espo-email-client.ts   # adapter class
│   ├── types.ts
│   └── normalizers.ts         # normalizeEmail, normalizeFolder etc.
├── components/
│   ├── layout/
│   │   ├── ThreePaneLayout.tsx
│   │   └── FolderSidebar.tsx
│   ├── list/
│   │   ├── EmailList.tsx
│   │   └── EmailRow.tsx
│   ├── viewer/
│   │   ├── MessageView.tsx
│   │   ├── MessageBody.tsx    # sandboxed iframe
│   │   ├── MessageHeader.tsx
│   │   └── AttachmentList.tsx
│   ├── compose/
│   │   ├── ComposePanel.tsx
│   │   ├── RichTextEditor.tsx # TipTap
│   │   └── AttachmentChips.tsx
│   ├── crm/
│   │   ├── LinkToRecordButton.tsx
│   │   ├── RecordPickerModal.tsx
│   │   ├── ParentSuggestionBanner.tsx
│   │   └── ActivityTimeline.tsx
│   └── shared/
├── queries/
│   ├── emails.ts
│   ├── folders.ts
│   └── records.ts
├── state/
│   ├── ui-store.ts
│   └── auth-store.ts
├── hooks/
│   ├── useKeyboardShortcuts.ts
│   ├── useEspoWebSocket.ts
│   └── useDebounce.ts
├── lib/
│   ├── sanitize-html.ts
│   ├── parse-addresses.ts
│   └── thread-grouping.ts
└── App.tsx
```

---

## 13. Phased Delivery Plan

**Phase 1 — Read-only MVP (2 weeks)**
- Auth + API adapter
- Three-pane layout
- Folder list, email list (virtualized), message viewer with sandboxed HTML
- Polling for new mail
- Basic keyboard shortcuts (j/k, Enter, Esc)

**Phase 2 — Write actions (2 weeks)**
- Mark read/unread, star, move to folder, delete
- Batch selection
- Compose / Reply / Forward with TipTap + attachments
- Draft auto-save

**Phase 3 — CRM integration (1–2 weeks)**
- Link to parent record
- Auto-suggest parent from sender
- Create Lead/Case from email
- Activity timeline on message view

**Phase 4 — Polish (1–2 weeks)**
- WebSocket real-time updates
- Thread / conversation view
- Advanced search UI
- Signatures, templates (reuses EspoCRM's `EmailTemplate` entity)
- Print view, export

**Total: 6–8 weeks for one focused developer.** Parallelize and halve if you have two.

---

## 14. Gotchas & Things to Validate Early

Quick hit list of things that have bitten every team building on EspoCRM's email module — prototype these first before committing to the full build.

- **Inbound email group folders.** If you're using shared inboxes (`InboundEmail` with `status = Active` + `useSmtp = true`), `folderId` is `null` on received emails; they're grouped via `groupFolderId` instead. Handle both paths in your list query.
- **`fromEmailAddress` shape.** EspoCRM's email address storage uses a separate entity. When filtering by sender, use `fromEmailAddress` attribute name, not `from`.
- **HTML body can be empty.** Some emails arrive with only `bodyPlain`. Fall back gracefully: render `<pre>` with the plain text.
- **Attachment size limits.** EspoCRM's `attachmentUploadMaxSize` config (default 50MB) plus your PHP `upload_max_filesize` and `post_max_size`. Test with realistic files.
- **Character encoding.** Non-ASCII subjects/bodies should come through as UTF-8, but some mail servers butcher this. Test with Bangla text from day one.
- **Time zones.** EspoCRM stores `dateSent` as UTC. Format in user's local tz using `Intl.DateTimeFormat` with the user's preference from `/api/v1/App/user`.
- **ACL.** Email list queries already respect ACL server-side — don't re-implement permission checks in React. Just handle 403 responses gracefully.
- **Rate limiting.** If you hammer the API during development (hot reload + broken polling), EspoCRM may throttle you. Set `staleTime` generously and don't refetch more than every 30 seconds for list views.

---

## 15. References

- EspoCRM API documentation: https://docs.espocrm.com/development/api/
- EspoCRM Email entity: https://docs.espocrm.com/administration/emails/
- EspoCRM WebSocket: https://docs.espocrm.com/administration/websocket/
- TanStack Query: https://tanstack.com/query/latest
- TipTap: https://tiptap.dev/
- DOMPurify: https://github.com/cure53/DOMPurify
- Bulwark Mail (reference UI to study): https://github.com/bulwarkmail/webmail

---

*Document owner: Telcobright CRM team — last updated for initial integration planning.*
