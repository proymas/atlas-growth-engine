import { buildSearchQueries, draftReply, scoreCandidate, type XCandidate } from './growth-core.js';
import { loadXState, saveXState, upsertRecord } from './state.js';

const samples: XCandidate[] = [
  {
    id: 'sample-1',
    url: 'https://x.com/example/status/1',
    username: 'examplefounder',
    text: 'Thinking of building a micro-SaaS for agencies. Should I build this or validate demand first? Looking for feedback.',
    discoveredAt: new Date().toISOString(),
  },
  {
    id: 'sample-2',
    url: 'https://x.com/example/status/2',
    username: 'promobot',
    text: 'Huge giveaway! Follow for follow and use my discount code.',
    discoveredAt: new Date().toISOString(),
  },
];

const state = await loadXState();
const decisions = samples.map(scoreCandidate);
for (const d of decisions) {
  upsertRecord(state, {
    id: d.candidate.id,
    url: d.candidate.url,
    username: d.candidate.username,
    status: d.qualified ? 'qualified' : 'seen',
    score: d.score,
    ...(d.qualified ? { lastReplyText: draftReply(d) } : {}),
  });
}
await saveXState(state);

console.log(JSON.stringify({
  mode: 'dry-run',
  searchQueries: buildSearchQueries(),
  decisions: decisions.map((d) => ({
    id: d.candidate.id,
    username: d.candidate.username,
    score: d.score,
    qualified: d.qualified,
    nextAction: d.nextAction,
    reasons: d.reasons,
    proposedReply: d.qualified ? draftReply(d) : null,
  })),
}, null, 2));
