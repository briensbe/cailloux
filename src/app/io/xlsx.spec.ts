import { readFirstSheet, XlsxError } from './xlsx';

// ---------------------------------------------------------------- Fabrication d'archives de test

interface Entry {
  name: string;
  content: string;
  /** 0 = stocké tel quel, 8 = compressé (deflate). */
  method?: 0 | 8;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new ReadableStream<BufferSource>({
    start(c) {
      c.enqueue(new Uint8Array(data));
      c.close();
    },
  }).pipeThrough(new CompressionStream('deflate-raw'));
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (let r = await reader.read(); !r.done; r = await reader.read()) chunks.push(r.value);
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** Une archive ZIP minimale (sans CRC : le lecteur ne le vérifie pas). */
async function zip(entries: Entry[]): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = encoder.encode(e.name);
    const raw = encoder.encode(e.content);
    const method = e.method ?? 8;
    const data = method === 8 ? await deflate(raw) : raw;

    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, method, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, method, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);

    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const parts = [...locals, ...centrals, eocd];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out.buffer;
}

const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** Un classeur dont la première feuille est `xl/<sheetPath>`, désignée par la relation `rId3`. */
function workbook(
  sheetXml: string,
  opts: { shared?: string[]; sheetPath?: string; method?: 0 | 8 } = {},
): Entry[] {
  const sheetPath = opts.sheetPath ?? 'worksheets/sheet1.xml';
  const entries: Entry[] = [
    {
      name: 'xl/workbook.xml',
      content: `<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets><sheet name="Projets" sheetId="1" r:id="rId3"/><sheet name="Autre" sheetId="2" r:id="rId4"/></sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId4" Target="worksheets/autre.xml"/><Relationship Id="rId3" Target="${sheetPath}"/></Relationships>`,
    },
    {
      name: `xl/${sheetPath}`,
      content: `<worksheet xmlns="${MAIN}"><sheetData>${sheetXml}</sheetData></worksheet>`,
    },
  ];
  if (opts.shared) {
    const items = opts.shared
      .map((s) => (s.startsWith('<') ? `<si>${s}</si>` : `<si><t>${s}</t></si>`))
      .join('');
    entries.push({ name: 'xl/sharedStrings.xml', content: `<sst xmlns="${MAIN}">${items}</sst>` });
  }
  return entries.map((e) => ({ ...e, method: opts.method ?? 8 }));
}

// ---------------------------------------------------------------- Tests

describe('readFirstSheet', () => {
  const sheet =
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
    '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>12.5</v></c></row>';
  const shared = ['Nom Projet', 'Charge', 'Fermeture anticipée des places'];

  it('lit une archive compressée', async () => {
    const table = await readFirstSheet(await zip(workbook(sheet, { shared })));
    expect(table).toEqual([
      ['Nom Projet', 'Charge'],
      ['Fermeture anticipée des places', '12.5'],
    ]);
  });

  it('lit une archive stockée sans compression', async () => {
    const table = await readFirstSheet(await zip(workbook(sheet, { shared, method: 0 })));
    expect(table[1][0]).toBe('Fermeture anticipée des places');
  });

  it('place les cellules d’après leur référence quand des cases manquent', async () => {
    const xml =
      '<row r="1"><c r="A1" t="inlineStr"><is><t>a</t></is></c><c r="C1" t="inlineStr"><is><t>c</t></is></c></row>' +
      '<row r="3"><c r="B3" t="inlineStr"><is><t>b</t></is></c></row>';
    expect(await readFirstSheet(await zip(workbook(xml)))).toEqual([
      ['a', '', 'c'],
      ['', '', ''],
      ['', 'b', ''],
    ]);
  });

  it('recolle les morceaux d’un texte enrichi', async () => {
    const xml = '<row r="1"><c r="A1" t="s"><v>0</v></c></row>';
    const rich =
      '<r><t>Offre </t></r><r><rPr><b/></rPr><t xml:space="preserve">crypto</t></r><rPh><t>ignoré</t></rPh>';
    expect(await readFirstSheet(await zip(workbook(xml, { shared: [rich] })))).toEqual([
      ['Offre crypto'],
    ]);
  });

  it('suit la relation vers une feuille qui ne s’appelle pas sheet1.xml', async () => {
    const xml = '<row r="1"><c r="A1" t="str"><v>ok</v></c></row>';
    const table = await readFirstSheet(
      await zip(workbook(xml, { sheetPath: 'worksheets/projets.xml' })),
    );
    expect(table).toEqual([['ok']]);
  });

  it('ignore les lignes vides de la fin', async () => {
    const xml = '<row r="1"><c r="A1" t="str"><v>x</v></c></row><row r="2"><c r="A2" s="3"/></row>';
    expect(await readFirstSheet(await zip(workbook(xml)))).toEqual([['x']]);
  });

  it('refuse un fichier qui n’est pas une archive', async () => {
    const pdf = new TextEncoder().encode('%PDF-1.7\n1 0 obj << >> endobj\n%%EOF').buffer;
    await expect(readFirstSheet(pdf)).rejects.toBeInstanceOf(XlsxError);
  });

  it('refuse une archive qui n’est pas un classeur', async () => {
    const other = await zip([{ name: 'readme.txt', content: 'bonjour' }]);
    await expect(readFirstSheet(other)).rejects.toBeInstanceOf(XlsxError);
  });
});
