import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type XStateRecord = {
  id: string;
  url: string;
  username: string;
  status: 'seen' | 'qualified' | 'replied' | 'followup_due' | 'closed';
  score: number;
  firstSeenAt: string;
  updatedAt: string;
  lastReplyText?: string;
};

type XState = { records: Record<string, XStateRecord> };

const dir = path.resolve('.state');
const file = path.join(dir, 'x.json');

export async function loadXState(): Promise<XState> {
  await mkdir(dir, { recursive: true });
  try {
    return JSON.parse(await readFile(file, 'utf8')) as XState;
  } catch {
    return { records: {} };
  }
}

export async function saveXState(state: XState): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(file, JSON.stringify(state, null, 2), 'utf8');
}

export function upsertRecord(state: XState, input: Omit<XStateRecord, 'firstSeenAt' | 'updatedAt'> & Partial<Pick<XStateRecord, 'firstSeenAt'>>): XStateRecord {
  const now = new Date().toISOString();
  const existing = state.records[input.id];
  const record: XStateRecord = {
    ...existing,
    ...input,
    firstSeenAt: existing?.firstSeenAt ?? input.firstSeenAt ?? now,
    updatedAt: now,
  };
  state.records[input.id] = record;
  return record;
}
