# Atlas Distribution Engine v1

## Objective

Automate B2B distribution for Atlas without requiring a local computer, browser session, X, LinkedIn, or Playwright.

The system optimizes for commercial evidence, not impressions or follower growth.

## End-to-end pipeline

1. Radar
2. Enrichment
3. Scoring
4. Offer selection
5. Deduplication
6. Outreach
7. CRM registration
8. Follow-up
9. Partner attribution
10. Learning

## Operating rules

### ICP
Prioritize distributors whose audience contains founders actively validating, building an MVP, searching for first customers, considering a pivot, or deciding whether to keep investing time or money in a SaaS, micro-SaaS, app, ecommerce, or digital business.

### Radar targets
- Founder newsletters
- Founder communities
- Incubators / accelerators
- Cohorts / bootcamps
- Creators serving early-stage founders
- MVP / no-code agencies
- Product studios
- Fractional CTOs
- Startup consultants
- Complementary founder tools

Exclude generic directories, audiences without founder concentration, and targets without a plausible contact path.

### Qualification
Atlas Score 0-10 based on:
- ICP fit
- Incentive to collaborate
- Access / contactability
- Commercial potential

Only prospects scoring >= 8 with a verifiable contact proceed to outreach.

### Offers
- Community / incubator: Validation Clinic or cohort pilot
- MVP agency: pre-build validation or referral
- Newsletter: co-branded diagnostic
- Complementary tool: referral / co-marketing

### Outreach
- Maximum 3 new emails per engine run
- Highly personalized
- No generic sales copy
- Transparent Atlas affiliation
- Signature: Roger — Atlas

### Idempotency
Before sending, deduplicate against both Airtable and Gmail using organization, domain, email, and subject/context.

If Airtable is unavailable, Gmail becomes the sending source of truth so the same prospect is not contacted twice.

### Follow-ups
- First follow-up: >= 72h of silence
- Final follow-up: >= 120h after first follow-up
- Maximum 2 follow-ups
- Stop permanently after rejection
- Responses are classified as interested, question, objection, rejection, or irrelevant

### Partner attribution
Partner links use:

`?ref=<partner_id>&utm_source=partner&utm_campaign=<campaign>`

Partner IDs must be stable, short, and contain no personal data.

Atlas stores attribution for 30 days and attaches it to downstream events.

### Failure policy
Fail closed commercially: if contact identity, context, deduplication, or fit is uncertain, do not send.

Fail open operationally: if one source fails, continue with independent steps without repeating already completed actions.

## Cloud execution

Primary orchestrator: ChatGPT automation `Atlas Distribution Engine`, hourly, Europe/Madrid.

The previous standalone `Atlas Distribution Radar` and `Atlas Partner Follow-ups` automations are disabled to prevent duplicate work.

The engine uses connected web search, Gmail, and Airtable and does not depend on the HP, local Chrome, Playwright, X API, or LinkedIn sessions.

## Current product tracking

Atlas attribution accepts `ref`/`partner`, `source`/`utm_source`, and `campaign`/`utm_campaign`, stores attribution for 30 days, and attaches it to behavioral events including landing, validator, report, pricing, commercial intent, checkout, and payment-related events.

## Success metric

Do not scale because the engine creates activity. Scale only when a segment / offer produces behavior compatible with paying for Atlas: partner activation, qualified visits, completed diagnoses, pricing views, commercial intent, checkout, or payment.
