import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const documents = [
  join(root, 'README.md'),
  join(root, 'STATUS.md'),
  ...readdirSync(join(root, 'docs'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => join(root, 'docs', name)),
];
const missing = [];

for (const document of documents) {
  const content = readFileSync(document, 'utf8');
  const links = content.matchAll(/!?\[[^\]\n]*\]\((<[^>]+>|[^)\n]+)\)/g);
  for (const match of links) {
    const target = match[1].replace(/^<|>$/g, '').split('#', 1)[0].trim();
    if (!target || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) continue;
    const path = resolve(dirname(document), decodeURIComponent(target));
    if (!existsSync(path)) missing.push(`${document.slice(root.length + 1)} → ${target}`);
  }
}

if (missing.length > 0) {
  process.stderr.write(`找不到 ${missing.length} 個本機文件連結：\n${missing.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`本機文件連結檢查通過（${documents.length} 份 Markdown）。\n`);
}
