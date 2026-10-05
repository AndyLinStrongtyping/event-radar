const base = 'https://www.nmns.edu.tw/backend/opendata/';

export async function fetchNmnsApi(path: 'Exhibition/list' | 'Calendar/weekHours',
  params: Record<string, string> = {}): Promise<unknown> {
  const key = process.env.NMNS_API_KEY;
  if (!key) throw new Error('NMNS_API_KEY 尚未設定');
  const url = new URL(path, base);
  url.searchParams.set('key', key);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  // 館方文字說明寫 apiKey header，但實測回「未傳入金鑰」；Swagger 的 query key 可用。
  // 呼叫僅到館方 HTTPS，絕不輸出含金鑰的完整 URL 或底層 fetch 錯誤。
  let response: Response;
  try { response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000),
    headers: { Accept: 'application/json' } }); }
  catch { throw new Error('科博館 API 連線失敗'); }
  if (new URL(response.url).hostname !== 'www.nmns.edu.tw' || !response.ok) {
    throw new Error(`科博館 API 回應失敗（HTTP ${response.status}）`);
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 10_000_000) throw new Error('科博館 API 回應過大');
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Error('科博館 API 回應不是 JSON'); }
}
