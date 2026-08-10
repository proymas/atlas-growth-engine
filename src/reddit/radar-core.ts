export type RedditCandidate = {
  id: string;
  subreddit: string;
  title: string;
  body: string;
  author: string;
  url: string;
  createdUtc?: number;
};

export type ScoredCandidate = RedditCandidate & {
  score: number;
  signals: string[];
  risk: string;
  nextQuestion: string;
};

const positiveSignals: Array<[RegExp, number, string]> = [
  [/validate|validation|validating|would you pay|pay for|idea feedback|roast my|should i build|should we build|thinking of building|worth building/i, 4, 'active_validation'],
  [/mvp|just launched|launched|launching|beta|prototype|first version|shipping|shipped/i, 3, 'mvp_or_launch'],
  [/zero customers|no customers|no users|0 users|first customer|first users|first paying|customers?\b|users?\b/i, 3, 'customer_problem'],
  [/pivot|should i continue|should we continue|keep building|stop building|worth continuing|give up/i, 4, 'continue_or_pivot'],
  [/feedback|looking for feedback|need feedback|thoughts\?|what do you think|any advice|advice\?|opinions?\?|critique|tear.*apart/i, 2, 'asks_feedback'],
  [/struggling|stuck|can't get|cannot get|not getting|hard to get|how do i get|how can i get/i, 2, 'active_problem'],
  [/idea|concept|building|built|product|tool|platform|service/i, 1, 'building_context'],
  [/saas|micro-?saas|app|ecommerce|marketplace|software|startup|indie hacker|side project/i, 1, 'digital_business'],
  [/pricing|price|charge|subscription|monetiz|revenue|paid|paying/i, 2, 'commercial_question'],
  [/customer acquisition|distribution|marketing|sales|traction|growth|acquire users|find users|find customers/i, 2, 'go_to_market_problem'],
];

const weakOrLowIntent: Array<[RegExp, number, string]> = [
  [/showcase|check out my|upvote|follow me|newsletter|promo code|discount|lifetime deal/i, -2, 'promo_heavy'],
  [/hiring|job|resume|cv|salary|internship/i, -4, 'not_icp'],
  [/course|agency for hire|dm me|book a call/i, -2, 'seller_not_buyer'],
];

export function scoreCandidate(candidate: RedditCandidate): ScoredCandidate {
  const text = `${candidate.title}\n${candidate.body}`;
  let score = 0;
  const signals: string[] = [];

  for (const [rx, points, signal] of positiveSignals) {
    if (rx.test(text)) {
      score += points;
      signals.push(signal);
    }
  }
  for (const [rx, points, signal] of weakOrLowIntent) {
    if (rx.test(text)) {
      score += points;
      signals.push(signal);
    }
  }

  const lower = text.toLowerCase();
  let risk = 'unclear_business_risk';
  let nextQuestion = 'What is the single assumption you most need the market to prove before you invest more time in this?';

  if (/no users|zero customers|no customers|first customer|first users|traction|customer acquisition|distribution|can't get|cannot get|not getting/.test(lower)) {
    risk = 'demand_or_distribution';
    nextQuestion = 'What have you already asked a prospect to do that would count as real commitment, not just positive feedback?';
  } else if (/would you pay|pay for|pricing|price|charge|subscription|monetiz|paying/.test(lower)) {
    risk = 'willingness_to_pay';
    nextQuestion = 'Have you tested a concrete price and asked anyone to commit money, a deposit, or a pre-order?';
  } else if (/mvp|prototype|beta|just launched|launched|launching|shipping|shipped/.test(lower)) {
    risk = 'mvp_learning_goal';
    nextQuestion = 'What specific behavior would make this MVP a success or failure for you in the next two weeks?';
  } else if (/pivot|continue|keep building|stop building|worth building|give up/.test(lower)) {
    risk = 'continue_vs_pivot';
    nextQuestion = 'What evidence would justify another month of building, and what evidence would make you stop or pivot?';
  } else if (/validate|validation|validating|should i build|should we build|thinking of building|idea feedback|feedback/.test(lower)) {
    risk = 'problem_and_demand_validation';
    nextQuestion = 'What is the riskiest assumption here: that the problem is painful, that this audience has it, or that they will pay to solve it?';
  }

  return { ...candidate, score, signals, risk, nextQuestion };
}

export function buildValueFirstDraft(item: ScoredCandidate): string {
  const specific = item.title.trim();
  const observation = item.risk === 'demand_or_distribution'
    ? 'The key risk here looks less like product quality and more like whether you can get a specific buyer to take a meaningful action.'
    : item.risk === 'willingness_to_pay'
      ? 'The biggest unknown is not whether people like the idea, but whether they will accept a real price and commit.'
      : item.risk === 'mvp_learning_goal'
        ? 'An MVP only helps if it is tied to one decision; otherwise you can collect feedback without learning whether to keep building.'
        : item.risk === 'continue_vs_pivot'
          ? 'You probably need a stopping rule more than more opinions, otherwise every new comment can justify another week of building.'
          : 'The useful next step is to isolate the riskiest assumption and test that directly instead of asking for broad feedback.';

  return `${specific ? `On “${specific}”: ` : ''}${observation} ${item.nextQuestion}`;
}
