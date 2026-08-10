import type { ThreadContext, ConversationDecision } from './conversation-core.js';

export type GeminiDecision = ConversationDecision & {
  replyText: string;
  mentionAtlas: boolean;
  confidence: number;
  summary: string;
};

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    shouldReply: { type: 'boolean' },
    reason: { type: 'string' },
    risk: { type: 'string', enum: ['demand', 'willingness_to_pay', 'distribution', 'mvp_learning', 'pivot', 'unclear'] },
    objective: { type: 'string', enum: ['clarify', 'test_demand', 'test_price', 'distribution', 'continue_or_stop'] },
    question: { type: 'string' },
    evidenceNeeded: { type: 'string' },
    replyText: { type: 'string' },
    mentionAtlas: { type: 'boolean' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    summary: { type: 'string' },
  },
  required: ['shouldReply', 'reason', 'risk', 'objective', 'question', 'evidenceNeeded', 'replyText', 'mentionAtlas', 'confidence', 'summary'],
};

const systemInstruction = `You are the reasoning engine for Atlas Growth OS.

MISSION
Atlas helps founders identify what a business idea must prove before investing more time or money. Atlas does NOT predict success. The goal of growth outreach is evidence of demand and eventual willingness to pay, not attention or vanity metrics.

ICP
Prioritize people actively deciding whether to build, validate, launch, pivot, continue, find first customers, or test willingness to pay for SaaS, micro-SaaS, apps, ecommerce, or digital businesses.

INTERACTION PRINCIPLE
VALUE -> CONVERSATION -> DIAGNOSIS -> ATLAS -> COMMERCIAL INTENT.
Never spam, never lead with a product link, never pretend to be an independent user, and never mention Atlas unless it is a natural next step.

FOR EACH THREAD
1. Understand what they are building.
2. Identify the most important unvalidated assumption or business risk.
3. Give one specific useful observation grounded in their exact context.
4. Prefer a concrete behavioral test over generic advice.
5. Ask at most one useful question when a question naturally advances the decision.
6. Do not reply merely to keep a conversation alive.
7. A polite thank-you is not a conversion signal.
8. Mention Atlas only when the founder has enough context and a structured diagnosis/testing workflow is genuinely relevant.
9. If there is no clear active business decision or useful next step, set shouldReply=false and replyText="".

STYLE
Human, direct, curious, intelligent, useful. No corporate language, no hype, no generic templates. Match the founder's language. Keep Reddit replies concise and specific. Avoid em dashes and salesy CTAs.

SAFETY / QUALITY GATES
- Do not fabricate facts about the product or founder.
- Do not claim evidence that is not in the thread.
- Do not mention Atlas in an initial reply unless there is an unusually strong natural reason.
- If confidence is below 0.65, set shouldReply=false.
- replyText must be ready to post as-is and should normally be 45-160 words when shouldReply=true.`;

function threadToPrompt(ctx: ThreadContext, kind: 'reply' | 'followup') {
  const comments = ctx.comments.slice(-40).map((c, i) => `[${i + 1}] ${c.author || 'unknown'}: ${c.body}`).join('\n');
  return `TASK: Decide whether Atlas should ${kind === 'followup' ? 'send a follow-up in' : 'reply to'} this Reddit thread, and if so write the exact response.\n\nTHREAD URL: ${ctx.url}\nSUBREDDIT: r/${ctx.subreddit}\nAUTHOR: ${ctx.author}\nTITLE: ${ctx.title}\nPOST:\n${ctx.postBody || '(no body extracted)'}\n\nCOMMENTS:\n${comments || '(no comments extracted)'}\n\nReturn only the structured decision.`;
}

function extractText(body: any): string {
  const parts = body?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((p: any) => typeof p?.text === 'string' ? p.text : '').join('').trim();
}

function validate(x: any): GeminiDecision {
  if (!x || typeof x !== 'object') throw new Error('gemini_invalid_json');
  const requiredStrings = ['reason', 'risk', 'objective', 'question', 'evidenceNeeded', 'replyText', 'summary'];
  for (const key of requiredStrings) if (typeof x[key] !== 'string') throw new Error(`gemini_missing_${key}`);
  if (typeof x.shouldReply !== 'boolean' || typeof x.mentionAtlas !== 'boolean' || typeof x.confidence !== 'number') throw new Error('gemini_invalid_types');
  x.confidence = Math.max(0, Math.min(1, x.confidence));
  if (x.confidence < 0.65) { x.shouldReply = false; x.replyText = ''; }
  if (!x.shouldReply) x.replyText = '';
  if (x.shouldReply && (x.replyText.trim().length < 40 || x.replyText.length > 1800)) throw new Error('gemini_reply_length_guard');
  return x as GeminiDecision;
}

export async function reasonWithGemini(ctx: ThreadContext, kind: 'reply' | 'followup' = 'reply'): Promise<GeminiDecision> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('missing_GEMINI_API_KEY');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: threadToPrompt(ctx, kind) }] }],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 1800,
        responseFormat: { text: { mimeType: 'application/json', schema } },
      },
    }),
  });

  if (!response.ok) throw new Error(`gemini_http_${response.status}:${(await response.text()).slice(0, 500)}`);
  const body = await response.json();
  const raw = extractText(body);
  if (!raw) throw new Error('gemini_empty_response');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error(`gemini_non_json:${raw.slice(0, 300)}`); }
  return validate(parsed);
}
