import fs from 'node:fs/promises';
import path from 'node:path';

const token = process.env.AIRTABLE_TOKEN;
const baseId = process.env.AIRTABLE_BASE_ID;
const tableId = process.env.AIRTABLE_LEADS_TABLE_ID;

if (!token || !baseId || !tableId) {
  console.log(JSON.stringify({ ok: false, skipped: true, reason: 'missing_airtable_env' }));
  process.exit(0);
}

const stateFile = path.resolve('.state/reddit.json');
const actionsFile = path.resolve('.state/reddit-actions.json');

const fields = {
  lead: 'fld1QeHWJuuClr8QX',
  segmento: 'fldW0bKfiBDKhnPv5',
  canal: 'fld4dtEGDYh4Knuyf',
  perfilUrl: 'fldPwUaRS8xo5C7KB',
  estado: 'fldkWLuVW3aWH4YnD',
  prioridad: 'fldIR5jnTz2RA914c',
  ultimoContacto: 'fldfzg30r3nK6Zauy',
  proximaAccion: 'fldKK1BrZy8ZCfj6T',
  notas: 'fldAA5HmCWSOKHGHd',
  clave: 'fldy22UlMmpeFafAI',
};

type SeenItem = { firstSeen: string; lastSeen: string; url?: string; subreddit?: string; title?: string; score?: number };
type Action = { threadId: string; threadUrl: string; subreddit: string; author: string; kind: string; status: string; text: string; createdAt: string; publishedAt?: string; decision?: { reason?: string; risk?: string; objective?: string; evidenceNeeded?: string } };

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

const seen = await readJson<Record<string, SeenItem>>(stateFile, {});
const actions = await readJson<Action[]>(actionsFile, []);
const actionByThread = new Map<string, Action>();
for (const a of actions) {
  const prev = actionByThread.get(a.threadId);
  if (!prev || new Date(a.createdAt).getTime() >= new Date(prev.createdAt).getTime()) actionByThread.set(a.threadId, a);
}

const api = `https://api.airtable.com/v0/${baseId}/${tableId}`;
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function findByKey(key: string): Promise<string | null> {
  const formula = encodeURIComponent(`{Clave conversación}='${key.replace(/'/g, "\\'")}'`);
  const res = await fetch(`${api}?maxRecords=1&filterByFormula=${formula}`, { headers });
  if (!res.ok) throw new Error(`airtable_find_${res.status}:${await res.text()}`);
  const body = await res.json() as { records?: Array<{ id: string }> };
  return body.records?.[0]?.id ?? null;
}

async function upsert(key: string, item: SeenItem, action?: Action) {
  const status = action?.status === 'published' ? 'Respondido' : action?.status === 'queued' ? 'Pendiente de respuesta' : 'Radar cualificado';
  const next = action?.status === 'published' ? 'Revisar respuesta y follow-up' : action?.status === 'queued' ? 'Publicar respuesta si pasa guardas' : 'Leer hilo completo y decidir siguiente acción';
  const notes = [
    `Reddit radar. Score: ${item.score ?? 'n/a'}.`,
    item.subreddit ? `Subreddit: r/${item.subreddit}.` : '',
    action?.decision?.reason ? `Decision: ${action.decision.reason}.` : '',
    action?.decision?.risk ? `Risk: ${action.decision.risk}.` : '',
    action?.decision?.evidenceNeeded ? `Evidence needed: ${action.decision.evidenceNeeded}.` : '',
    action?.text ? `Prepared reply: ${action.text}` : '',
  ].filter(Boolean).join('\n');

  const data: Record<string, unknown> = {
    [fields.lead]: item.title || action?.author || key,
    [fields.segmento]: 'Founder / negocio digital en decisión activa',
    [fields.canal]: 'Reddit',
    [fields.perfilUrl]: item.url || action?.threadUrl || '',
    [fields.estado]: status,
    [fields.prioridad]: (item.score ?? 0) >= 6 ? 'Alta' : 'Media',
    [fields.ultimoContacto]: action?.publishedAt || item.lastSeen,
    [fields.proximaAccion]: next,
    [fields.notas]: notes,
    [fields.clave]: key,
  };

  const existingId = await findByKey(key);
  const url = existingId ? `${api}/${existingId}` : api;
  const method = existingId ? 'PATCH' : 'POST';
  const body = existingId ? { fields: data } : { records: [{ fields: data }] };
  const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`airtable_write_${res.status}:${await res.text()}`);
  return existingId ? 'updated' : 'created';
}

let created = 0;
let updated = 0;
let failed = 0;
for (const [id, item] of Object.entries(seen)) {
  if (!item.url || !item.title) continue;
  try {
    const result = await upsert(item.url, item, actionByThread.get(id));
    if (result === 'created') created++; else updated++;
    await new Promise(r => setTimeout(r, 240));
  } catch (error) {
    failed++;
    console.error(JSON.stringify({ ok: false, id, error: String(error) }));
  }
}

console.log(JSON.stringify({ ok: failed === 0, created, updated, failed, synced: created + updated }, null, 2));
