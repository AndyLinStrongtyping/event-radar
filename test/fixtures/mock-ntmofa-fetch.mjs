import { readFile } from 'node:fs/promises';
import { ntmofaPages } from '../../src/sources/ntmofa.ts';

// Deliberately offline: any unknown or missing detail fails instead of contacting the museum.
const snapshot = JSON.parse(await readFile(process.env.TEST_NTMOFA_SNAPSHOT, 'utf8'));
globalThis.fetch = async (requested) => {
  const url = String(requested);
  const index = ntmofaPages.indexOf(url);
  const text = index >= 0 ? snapshot.pages[index] : snapshot.details[url];
  if (typeof text !== 'string') throw new TypeError('Offline detail connection failure');
  const bytes = new TextEncoder().encode(text);
  return { ok: true, url, headers: new Headers(), arrayBuffer: async () => bytes.buffer };
};
