export type XCandidate = {
  id: string;
  url: string;
  username: string;
  text: string;
  discoveredAt: string;
};

export type XDecision = {
  candidate: XCandidate;
  score: number;
  reasons: string[];
  qualified: boolean;
  nextAction: 'reply' | 'observe' | 'skip';
};

const strongSignals = [
  'validate my idea', 'validate this idea', 'would you pay', 'should i build',
  'looking for feedback', 'need feedback', 'roast my startup', 'roast my idea',
  'zero customers', 'no customers', 'no users', 'first customers',
  'should i pivot', 'thinking of building', 'just launched', 'mvp feedback',
  'product market fit', 'product-market fit', 'validate demand', 'validation',
];

const businessSignals = [
  'saas', 'micro-saas', 'startup', 'mvp', 'app', 'ecommerce', 'e-commerce',
  'founder', 'customers', 'users', 'launch', 'build', 'building', 'product',
];

const weakOrBadSignals = [
  'giveaway', 'airdrop', 'crypto pump', 'follow for follow', 'job opening',
  'hiring', 'coupon', 'discount code', 'affiliate link',
];

export function scoreCandidate(candidate: XCandidate): XDecision {
  const text = candidate.text.toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  for (const signal of strongSignals) {
    if (text.includes(signal)) {
      score += 4;
      reasons.push(`active-decision:${signal}`);
    }
  }
  for (const signal of businessSignals) {
    if (text.includes(signal)) {
      score += 1;
      reasons.push(`business-context:${signal}`);
    }
  }
  for (const signal of weakOrBadSignals) {
    if (text.includes(signal)) {
      score -= 5;
      reasons.push(`low-fit:${signal}`);
    }
  }

  if (text.includes('?')) {
    score += 1;
    reasons.push('explicit-question');
  }
  if (text.length >= 80) {
    score += 1;
    reasons.push('enough-context');
  }

  const qualified = score >= 5;
  return {
    candidate,
    score,
    reasons,
    qualified,
    nextAction: qualified ? 'reply' : score >= 3 ? 'observe' : 'skip',
  };
}

export function buildSearchQueries(): string[] {
  return [
    '"validate my idea" OR "should I build" OR "would you pay" -filter:replies',
    '"looking for feedback" (saas OR startup OR app OR mvp) -filter:replies',
    '"zero customers" OR "no users" (saas OR startup OR mvp) -filter:replies',
    '"should I pivot" OR "thinking of building" (saas OR startup OR app) -filter:replies',
    '"just launched" (mvp OR saas OR app) feedback -filter:replies',
  ];
}

export function draftReply(decision: XDecision): string {
  const t = decision.candidate.text.toLowerCase();
  let hypothesis = 'the riskiest assumption behind the idea';
  let experiment = 'get 5–10 target users to make a concrete commitment before building more';

  if (t.includes('no users') || t.includes('zero customers') || t.includes('first customers')) {
    hypothesis = 'whether the problem is urgent enough for someone to change behaviour or pay';
    experiment = 'contact a narrow ICP with one concrete pain statement and ask for a call/demo rather than generic feedback';
  } else if (t.includes('would you pay') || t.includes('validate demand') || t.includes('validation')) {
    hypothesis = 'willingness to pay, not whether people say the idea sounds useful';
    experiment = 'put a price or paid pilot in front of the exact buyer and measure commitments';
  } else if (t.includes('should i build') || t.includes('thinking of building')) {
    hypothesis = 'whether the target user already feels this problem strongly enough to seek a workaround';
    experiment = 'interview people currently facing the problem and look for existing spend/workarounds before coding';
  } else if (t.includes('pivot')) {
    hypothesis = 'whether the current failure is segment, problem, positioning, or distribution';
    experiment = 'change one variable at a time and compare response/commitment rates rather than doing a full pivot immediately';
  }

  return `The part I'd try to prove first is ${hypothesis}. Before investing more, I'd ${experiment}. What evidence do you already have from people in the exact segment you're targeting?`;
}
