/**
 * Lecture de la première feuille d'un fichier `.xlsx`, sans dépendance.
 *
 * Un `.xlsx` est une archive ZIP de fichiers XML :
 *  - `xl/workbook.xml` liste les feuilles, chacune désignée par un identifiant de relation ;
 *  - `xl/_rels/workbook.xml.rels` donne le chemin du fichier de chaque feuille ;
 *  - `xl/sharedStrings.xml` regroupe les textes, que les cellules désignent par leur rang ;
 *  - `xl/worksheets/….xml` contient les lignes et les cellules.
 *
 * On lit l'archive avec `DecompressionStream` et le XML avec `DOMParser`, deux API natives du
 * navigateur. Le résultat est un tableau rectangulaire de chaînes (cases vides = `''`).
 */

/** Le fichier n'a pas pu être lu comme un classeur `.xlsx`. */
export class XlsxError extends Error {
  constructor(
    message = "Le fichier n'a pas pu être lu : ce n'est pas un classeur Excel (.xlsx) valide.",
  ) {
    super(message);
    this.name = 'XlsxError';
  }
}

const RELATIONSHIPS_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export async function readFirstSheet(data: ArrayBuffer): Promise<string[][]> {
  try {
    const zip = readZip(new Uint8Array(data));
    const workbook = parseXml(await text(zip, 'xl/workbook.xml'));
    const sheet = first(workbook, 'sheet');
    const relId =
      sheet?.getAttributeNS(RELATIONSHIPS_NS, 'id') ?? attributeByLocalName(sheet, 'id');
    if (!relId) throw new XlsxError();

    const rels = parseXml(await text(zip, 'xl/_rels/workbook.xml.rels'));
    const target = all(rels, 'Relationship')
      .find((r) => r.getAttribute('Id') === relId)
      ?.getAttribute('Target');
    if (!target) throw new XlsxError();

    const shared = zip.has('xl/sharedStrings.xml')
      ? all(parseXml(await text(zip, 'xl/sharedStrings.xml')), 'si').map(richText)
      : [];
    return readSheet(parseXml(await text(zip, resolvePath(target))), shared);
  } catch (e) {
    throw e instanceof XlsxError ? e : new XlsxError();
  }
}

// ---------------------------------------------------------------- Feuille

function readSheet(doc: Document, shared: readonly string[]): string[][] {
  const cells = new Map<number, Map<number, string>>();
  let width = 0;
  let nextRow = 0;
  for (const row of all(doc, 'row')) {
    const r = Number(row.getAttribute('r'));
    const rowIndex = Number.isInteger(r) && r > 0 ? r - 1 : nextRow;
    nextRow = rowIndex + 1;
    let nextCol = 0;
    for (const cell of children(row, 'c')) {
      // Les cellules vides sont souvent absentes : la colonne vient de la référence (« B2 »), pas de la position.
      const ref = cell.getAttribute('r');
      const col = ref ? columnIndex(ref) : nextCol;
      nextCol = col + 1;
      const value = cellValue(cell, shared);
      if (value === '') continue;
      if (!cells.has(rowIndex)) cells.set(rowIndex, new Map());
      cells.get(rowIndex)!.set(col, value);
      width = Math.max(width, col + 1);
    }
  }
  // Les lignes vides de la fin (mise en forme sans contenu) ne comptent pas.
  const height = cells.size === 0 ? 0 : Math.max(...cells.keys()) + 1;
  return Array.from({ length: height }, (_, r) =>
    Array.from({ length: width }, (_, c) => cells.get(r)?.get(c) ?? ''),
  );
}

function cellValue(cell: Element, shared: readonly string[]): string {
  const type = cell.getAttribute('t');
  if (type === 'inlineStr') {
    const is = children(cell, 'is')[0];
    return is ? richText(is) : '';
  }
  const v = children(cell, 'v')[0]?.textContent ?? '';
  if (type === 's') return shared[Number(v)] ?? '';
  // Nombres, booléens, formules (valeur en cache) et erreurs : le texte brut.
  return v;
}

/** Un texte enrichi est découpé en morceaux (`<r><t>`) ; on ignore les annotations phonétiques (`<rPh>`). */
function richText(el: Element): string {
  return Array.from(el.getElementsByTagNameNS('*', 't'))
    .filter((t) => t.parentElement?.localName !== 'rPh')
    .map((t) => t.textContent ?? '')
    .join('');
}

/** « AB12 » → 27 (colonnes numérotées à partir de 0). */
function columnIndex(ref: string): number {
  let col = 0;
  for (const ch of ref.toUpperCase()) {
    if (ch < 'A' || ch > 'Z') break;
    col = col * 26 + (ch.charCodeAt(0) - 64);
  }
  return col - 1;
}

/** Les cibles des relations sont relatives au dossier `xl/`, ou absolues depuis la racine de l'archive. */
function resolvePath(target: string): string {
  const parts = (target.startsWith('/') ? target.slice(1) : `xl/${target}`).split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '..') out.pop();
    else if (part !== '.' && part !== '') out.push(part);
  }
  return out.join('/');
}

// ---------------------------------------------------------------- XML

function parseXml(source: string): Document {
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) throw new XlsxError();
  return doc;
}

// Recherche par nom local : les préfixes d'espace de noms (`x:row`…) varient d'un producteur à l'autre.
function all(doc: Document | Element, localName: string): Element[] {
  return Array.from(doc.getElementsByTagNameNS('*', localName));
}

function first(doc: Document, localName: string): Element | undefined {
  return all(doc, localName)[0];
}

function children(el: Element, localName: string): Element[] {
  return Array.from(el.children).filter((c) => c.localName === localName);
}

function attributeByLocalName(el: Element | undefined, localName: string): string | null {
  return Array.from(el?.attributes ?? []).find((a) => a.localName === localName)?.value ?? null;
}

// ---------------------------------------------------------------- ZIP

interface ZipEntry {
  method: number;
  /** Position des données compressées dans l'archive. */
  offset: number;
  size: number;
}

type Zip = Map<string, { bytes: Uint8Array; entry: ZipEntry }>;

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

/**
 * Parcourt le répertoire central de l'archive, à la fin du fichier. Les tailles des en-têtes
 * locaux peuvent valoir 0 (elles sont alors écrites après les données) : celles du répertoire
 * central font foi.
 */
function readZip(bytes: Uint8Array): Zip {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view);
  const count = view.getUint16(eocd + 10, true);
  let pos = view.getUint32(eocd + 16, true);
  if (count === 0xffff || pos === 0xffffffff) throw new XlsxError(); // ZIP64 : non pris en charge.

  const decoder = new TextDecoder();
  const zip: Zip = new Map();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(pos, true) !== CENTRAL_SIGNATURE) throw new XlsxError();
    const flags = view.getUint16(pos + 8, true);
    const method = view.getUint16(pos + 10, true);
    const size = view.getUint32(pos + 20, true);
    const nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    const local = view.getUint32(pos + 42, true);
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLength));
    pos += 46 + nameLength + extraLength + commentLength;

    if (flags & 1) throw new XlsxError(); // Archive chiffrée.
    if (view.getUint32(local, true) !== LOCAL_SIGNATURE) throw new XlsxError();
    const offset = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    zip.set(name, { bytes, entry: { method, offset, size } });
  }
  return zip;
}

function findEndOfCentralDirectory(view: DataView): number {
  // L'enregistrement fait 22 octets, suivis d'un commentaire de 65 535 octets au plus.
  const lowest = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let pos = view.byteLength - 22; pos >= lowest; pos--) {
    if (view.getUint32(pos, true) === EOCD_SIGNATURE) return pos;
  }
  throw new XlsxError();
}

async function text(zip: Zip, name: string): Promise<string> {
  const file = zip.get(name);
  if (!file) throw new XlsxError();
  const { bytes, entry } = file;
  const raw = bytes.subarray(entry.offset, entry.offset + entry.size);
  if (entry.method === 0) return new TextDecoder().decode(raw);
  if (entry.method !== 8) throw new XlsxError();
  return new TextDecoder().decode(await inflate(raw));
}

/** Décompresse un flux « deflate » brut (méthode 8 du ZIP). */
async function inflate(raw: Uint8Array): Promise<Uint8Array> {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(new Uint8Array(raw)); // Copie : le flux veut un tampon `ArrayBuffer` propre.
      controller.close();
    },
  });
  return collect(source.pipeThrough(new DecompressionStream('deflate-raw')));
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
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
