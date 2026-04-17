import { useEffect, useRef, useState } from 'react';
import { Box, Button } from '@mui/material';
import DOMPurify from 'dompurify';

// Renders email HTML inside a sandboxed iframe with DOMPurify sanitization.
// Blocks remote images by default; shows opt-in banner when detected.
export default function MessageBody({ html, plainText, themeMode = 'light' }) {
  const iframeRef = useRef(null);
  const [height, setHeight]  = useState(220);
  const [showRemote, setShowRemote] = useState(false);
  const [hasRemote, setHasRemote]   = useState(false);

  useEffect(() => {
    const raw = html && html.trim()
      ? html
      : `<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(plainText || '')}</pre>`;
    const detectRemote = /<img[^>]+src=["']https?:\/\//i.test(raw);
    setHasRemote(detectRemote);

    const cleaned = DOMPurify.sanitize(raw, {
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
      ALLOW_DATA_ATTR: false,
    });
    const finalHtml = (detectRemote && !showRemote)
      ? cleaned.replace(/<img([^>]+)src=["']https?:\/\/[^"']+["']/gi, '<img$1src="" data-blocked="1"')
      : cleaned;

    const isDark = themeMode === 'dark';
    const bodyColor = isDark ? '#e5e7eb' : '#1f2328';
    const linkColor = isDark ? '#60a5fa' : '#0066cc';
    const quoteCol  = isDark ? '#374151' : '#ddd';
    const mutedCol  = isDark ? '#9ca3af' : '#666';

    const doc = `<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <base target="_blank">
      <style>
        html,body{margin:0;padding:0;background:transparent;color:${bodyColor};
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
          font-size:14px;line-height:1.5;word-wrap:break-word;}
        body{padding:16px;}
        img{max-width:100%;height:auto;}
        img[data-blocked="1"]{display:none;}
        a{color:${linkColor};}
        blockquote{border-left:3px solid ${quoteCol};margin:8px 0 8px 0;
          padding:4px 12px;color:${mutedCol};}
        table{border-collapse:collapse;max-width:100%;}
        pre{white-space:pre-wrap;}
      </style>
    </head><body>${finalHtml}</body></html>`;

    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.srcdoc = doc;
    const onLoad = () => {
      const b = iframe.contentDocument?.body;
      if (b) setHeight(Math.max(120, b.scrollHeight + 32));
    };
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [html, plainText, showRemote, themeMode]);

  return (
    <Box sx={{ position: 'relative' }}>
      {hasRemote && !showRemote && (
        <Box sx={(theme) => ({
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 1.5, py: 0.75, mb: 1,
          bgcolor: theme.palette.warning.light || 'warning.main',
          color: theme.palette.getContrastText(theme.palette.warning.main),
          borderRadius: 1, fontSize: 12,
        })}>
          <span>Images have been blocked to protect your privacy.</span>
          <Button size="small" variant="contained" color="warning"
            onClick={() => setShowRemote(true)}>Show images</Button>
        </Box>
      )}
      <iframe
        ref={iframeRef}
        sandbox="allow-same-origin allow-popups"
        style={{ width: '100%', border: 'none', height: `${height}px`,
          display: 'block', background: 'transparent' }}
        title="Email body"
      />
    </Box>
  );
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
