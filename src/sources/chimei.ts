const host = 'www.chimeimuseum.org';

/** Only links to individual special-exhibition pages, never activity or ticket links. */
export function extractChimeiExhibitionLinks(html: string): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi)) {
    try {
      const url = new URL(match[2].replaceAll('&amp;', '&'), `https://${host}/`);
      if (url.protocol !== 'https:' || url.hostname !== host) continue;
      if (!/^\/special-exhibition\/[^/]+\/[^/]+\/?$/.test(url.pathname)) continue;
      url.search = '';
      url.hash = '';
      url.pathname = url.pathname.replace(/\/$/, '');
      links.add(url.href);
    } catch {
      // Ignore malformed links in the source page.
    }
  }
  return [...links].sort();
}

/** Conservatively stop if wildcard or monitor-specific robots rules disallow this page. */
export function robotsAllowExhibitionPage(robots: string): boolean {
  let applies = false;
  let groupHasRules = false;
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.split('#', 1)[0].trim();
    if (!line) continue;
    const directive = line.match(/^([^:]+):\s*(.*)$/);
    if (!directive) continue;
    const [, name, value] = directive;
    if (name.trim().toLowerCase() === 'user-agent') {
      if (groupHasRules) {
        applies = false;
        groupHasRules = false;
      }
      const agent = value.trim().toLowerCase();
      applies ||= agent === '*' || agent === 'eventradarmonitor';
    } else {
      groupHasRules = true;
    }
    if (applies && name.trim().toLowerCase() === 'disallow') {
      const path = value.trim();
      if (path && '/exhibition-event'.startsWith(path)) return false;
    }
  }
  return true;
}
