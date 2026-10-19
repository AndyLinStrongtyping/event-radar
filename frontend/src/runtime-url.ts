const configuredBackend = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '') ?? '';

if (configuredBackend && !/^https:\/\/[^/]+$/i.test(configuredBackend)) {
  throw new Error('VITE_API_BASE_URL 必須是 HTTPS 網站根網址');
}

/**
 * The React app normally shares an origin with the Node service. A static mirror
 * can set VITE_API_BASE_URL so public API and guide requests still use the
 * canonical Render service while the application shell and images load from a CDN.
 */
export function backendUrl(path: string): string {
  if (!path.startsWith('/')) throw new Error('後端路徑必須以 / 開頭');
  return configuredBackend ? `${configuredBackend}${path}` : path;
}

export function appUrl(path = ''): string {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}${path.replace(/^\//, '')}`;
}
