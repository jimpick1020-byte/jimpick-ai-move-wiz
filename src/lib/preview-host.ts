/** Preview classification is environment selection only, never authorization. */
export function isPreviewHost(raw: string): boolean {
  const host = raw.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (/\.(?:lovableproject|lovableproject-dev)\.com$/.test(host) || /^(?:lovableproject|lovableproject-dev)\.com$/.test(host)) return true;
  const suffix = /\.(?:lovable\.app|gpt-eng\.com|gptengineer\.run)$/;
  if (!suffix.test(host)) return false;
  const prefix = host.replace(suffix, '').split('.');
  if (/^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(prefix[0])) return prefix.length <= 2;
  if (/^project--[0-9a-f-]{36}-dev$/.test(prefix[0])) return prefix.length === 1;
  return prefix.length === 2 && /^live--[0-9a-f-]{36}(?:-thr_[a-z0-9]+)?$/.test(prefix[0]);
}