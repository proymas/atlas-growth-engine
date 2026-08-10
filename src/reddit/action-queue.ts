import fs from 'node:fs/promises';
import path from 'node:path';
import type { ThreadContext, ConversationDecision } from './conversation-core.js';

export type RedditAction = {
  id: string;
  threadId: string;
  threadUrl: string;
  subreddit: string;
  author: string;
  kind: 'reply' | 'followup';
  status: 'queued' | 'published' | 'skipped' | 'failed';
  decision: ConversationDecision;
  text: string;
  createdAt: string;
  publishedAt?: string;
  commentUrl?: string;
  error?: string;
};

const dir = path.resolve('.state');
const file = path.join(dir, 'reddit-actions.json');

async function readAll(): Promise<RedditAction[]> {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return []; }
}

export async function enqueueAction(ctx: ThreadContext, decision: ConversationDecision, text: string, kind: RedditAction['kind'] = 'reply') {
  await fs.mkdir(dir, { recursive: true });
  const all = await readAll();
  if (all.some(a => a.threadId === ctx.id && a.kind === kind && ['queued', 'published'].includes(a.status))) return null;
  const action: RedditAction = {
    id: `${ctx.id}:${kind}:${Date.now()}`,
    threadId: ctx.id,
    threadUrl: ctx.url,
    subreddit: ctx.subreddit,
    author: ctx.author,
    kind,
    status: 'queued',
    decision,
    text,
    createdAt: new Date().toISOString(),
  };
  all.push(action);
  await fs.writeFile(file, JSON.stringify(all, null, 2));
  return action;
}

export async function listQueued() { return (await readAll()).filter(a => a.status === 'queued'); }

export async function updateAction(id: string, patch: Partial<RedditAction>) {
  const all = await readAll();
  const i = all.findIndex(a => a.id === id);
  if (i < 0) return;
  all[i] = { ...all[i], ...patch };
  await fs.writeFile(file, JSON.stringify(all, null, 2));
}
