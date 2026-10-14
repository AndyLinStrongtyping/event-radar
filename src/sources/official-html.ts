type FetchOptions = {
  fetcher?: typeof fetch;
  wait?: (delayMs: number) => Promise<void>;
};

const retryDelaysMs = [2_000, 8_000] as const;
const sleep = (delayMs: number) => new Promise<void>((resolve) => setTimeout(resolve, delayMs));

function transientFetchError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError'
    || error.name === 'AbortError' || error instanceof TypeError);
}

export async function fetchOfficialHtml(url: string, hostname: string,
  options: FetchOptions = {}): Promise<string> {
  const requested = new URL(url);
  if (requested.protocol !== 'https:' || requested.hostname !== hostname
    || requested.username || requested.password) throw new Error('來源網址不是預期館方 HTTPS 主機');
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? sleep;
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    try {
      const response = await fetcher(requested.href, { headers: {
        'User-Agent': 'EventRadar/0.1 (+https://github.com/AndyLinStrongtyping)',
        Accept: 'text/html',
      }, redirect: 'manual', signal: AbortSignal.timeout(15_000) });
      if (!response.ok) {
        if (response.status >= 500 && response.status <= 599 && attempt < retryDelaysMs.length) {
          await wait(retryDelaysMs[attempt]);
          continue;
        }
        throw new Error(`官方網頁 HTTP ${response.status}：${requested.href}`);
      }
      if (new URL(response.url).hostname !== hostname) throw new Error('官方網頁回應主機不符');
      const html = await response.text();
      if (html.length > 2_000_000) throw new Error('官方網頁超過大小限制');
      return html;
    } catch (error) {
      if (transientFetchError(error) && attempt < retryDelaysMs.length) {
        await wait(retryDelaysMs[attempt]);
        continue;
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`官方網頁取得失敗：${requested.href}（第 ${attempt + 1} 次；${reason}）`,
        { cause: error });
    }
  }
  throw new Error(`官方網頁取得失敗：${requested.href}`);
}
