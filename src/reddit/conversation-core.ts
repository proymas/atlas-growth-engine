export type ThreadContext = {
  id: string;
  url: string;
  subreddit: string;
  title: string;
  postBody: string;
  author: string;
  comments: Array<{ author: string; body: string; depth: number }>;
};

export type ConversationDecision = {
  shouldReply: boolean;
  reason: string;
  risk: 'demand' | 'willingness_to_pay' | 'distribution' | 'mvp_learning' | 'pivot' | 'unclear';
  objective: 'clarify' | 'test_demand' | 'test_price' | 'distribution' | 'continue_or_stop';
  question: string;
  evidenceNeeded: string;
};

const all = (ctx: ThreadContext) => `${ctx.title}\n${ctx.postBody}\n${ctx.comments.map(c => c.body).join('\n')}`.toLowerCase();

export function decideConversation(ctx: ThreadContext): ConversationDecision {
  const text = all(ctx);
  const promoOnly = /(check out my|upvote|follow|promo code|discount|newsletter)/i.test(text) && !/(feedback|validate|should i|would you pay|no users|no customers|first customer|pivot|worth)/i.test(text);
  if (promoOnly) return { shouldReply: false, reason: 'promo_without_active_decision', risk: 'unclear', objective: 'clarify', question: '', evidenceNeeded: '' };

  if (/would you pay|pricing|price|charge|subscription/.test(text)) {
    return { shouldReply: true, reason: 'active_willingness_to_pay_question', risk: 'willingness_to_pay', objective: 'test_price', question: 'Have you put a concrete price in front of the target buyer and asked for a real commitment yet?', evidenceNeeded: 'A paid pilot, deposit, preorder, checkout attempt, or explicit rejection at a real price.' };
  }
  if (/no users|zero users|no customers|zero customers|first customer|first users/.test(text)) {
    return { shouldReply: true, reason: 'active_customer_acquisition_problem', risk: 'distribution', objective: 'distribution', question: 'What is the narrowest buyer segment you have personally tried to reach, and what exact action did you ask them to take?', evidenceNeeded: 'Replies, booked calls, trial starts, or purchase attempts from one defined segment.' };
  }
  if (/pivot|keep building|continue|worth building|should i stop/.test(text)) {
    return { shouldReply: true, reason: 'active_continue_or_pivot_decision', risk: 'pivot', objective: 'continue_or_stop', question: 'What evidence would justify another month of work, and what evidence would make you stop or pivot?', evidenceNeeded: 'A pre-defined stopping rule tied to market behavior rather than encouragement.' };
  }
  if (/mvp|prototype|beta|just launched|launched/.test(text)) {
    return { shouldReply: true, reason: 'mvp_needs_learning_goal', risk: 'mvp_learning', objective: 'clarify', question: 'What single behavior from users would make this MVP a meaningful success or failure in the next two weeks?', evidenceNeeded: 'One observable behavior tied to the next product decision.' };
  }
  if (/validate|validation|feedback|should i build|thinking of building|idea/.test(text)) {
    return { shouldReply: true, reason: 'active_validation_question', risk: 'demand', objective: 'test_demand', question: 'Which assumption is actually riskiest here: that the problem is painful, that this audience has it, or that they will pay to solve it?', evidenceNeeded: 'A behavioral test against the riskiest assumption, not broad positive feedback.' };
  }

  return { shouldReply: false, reason: 'no_clear_active_business_decision', risk: 'unclear', objective: 'clarify', question: '', evidenceNeeded: '' };
}

export function buildReply(ctx: ThreadContext, d: ConversationDecision): string {
  if (!d.shouldReply) return '';
  const product = ctx.title.replace(/\s+/g, ' ').trim().slice(0, 140);
  const lead = d.risk === 'willingness_to_pay'
    ? 'The biggest unknown here is not whether people like the idea; it is whether the target buyer will accept a real price.'
    : d.risk === 'distribution'
      ? 'This sounds less like a product problem and more like a distribution test that is still too broad.'
      : d.risk === 'pivot'
        ? 'The useful thing now is a stopping rule, otherwise every encouraging comment can justify another week of building.'
        : d.risk === 'mvp_learning'
          ? 'An MVP is only useful if it is tied to one decision you are trying to make next.'
          : 'Broad feedback can feel useful without actually reducing the biggest business risk.';

  return `${product ? `On “${product}”: ` : ''}${lead} ${d.question} I’d judge the next step by ${d.evidenceNeeded.toLowerCase()}`;
}
