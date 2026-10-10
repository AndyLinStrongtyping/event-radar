import { readFile } from 'node:fs/promises';

// Only the isolated integration-test child process imports this module.
globalThis.fetch = async (requested) => {
  const url = String(requested);
  let path;
  if (url === 'https://websrv.nstm.gov.tw/OtherInfo/OpenData/ExhibitionInfoOpenData.ashx') {
    path = process.env.TEST_NSTM_JSON;
  } else if (url === 'https://www.nstm.gov.tw/ExhibitionList.aspx?ExhibitionType=2&Period=2&Pindex=1') {
    path = process.env.TEST_NSTM_HTML;
  } else {
    throw new Error(`Unexpected mocked source: ${url}`);
  }
  if (!path) throw new Error(`Missing source fixture for ${url}`);
  const bytes = await readFile(path);
  return { ok: true, url, headers: new Headers(), arrayBuffer: async () => bytes.buffer.slice(
    bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
};
