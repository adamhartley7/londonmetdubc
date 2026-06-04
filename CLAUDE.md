# CLAUDE.md — Oara Analysis / OmniRow (New Age Solutions)

A subscription platform for rowing clubs, coaches and rowers: evidence-grounded analysis of
individual performance, races, training, attendance and the season, with a friendly animated UI.
Built by Adam (TCD medicine, DUBC) — solo, non-CS. Roadmap: `C:\Users\adam1\.claude\plans\i-want-to-build-sharded-elephant.md`.

## Strategic thesis & non-negotiable design laws

**Strategy:** don't build all 10+ "Omni" modules at once. Nail **one** end-to-end — post-race analysis (the CoxBox engine = **OmniRace**) — as the template, prove the hardest problem (trustworthy analysis) on it, then **clone the pattern**. The static `index.html` dashboard is not throwaway: its analysis is pure JavaScript that ports 1:1 into the eventual app.

These four laws shape the **architecture**, not just features:

1. **Evidence-grounding / zero hallucination.** Every number is deterministic math on real uploaded data; every scientific claim is looked up from a **curated store of papers Adam has personally vetted** (`evidence/evidence.json` — seeded with real verified sources, **not** `Oara_Seven_Papers.pdf`, which is an AI/LLM field guide, not rowing literature). No AI-written citations, splits, or "facts" ever reach the screen. *(Detail: "The First Law" below.)*
2. **Multi-tenant from the data model up.** The goal is multi-club paid, so the very first table designs must isolate data per club (a coach at Club A must never see Club B). Retrofitting this later is the #1 thing that sinks solo SaaS.
3. **Privacy by default.** Rower performance, bodyweight, nutrition and recovery are sensitive (medical-adjacent). Boat consensus defaults to anonymous. Least-access from day one.
4. **One module template, cloned.** Every module is the same pipeline: **upload real data → deterministic analysis → evidence-linked insight → friendly UI.** Build it once (OmniRace), reuse it everywhere.

## The First Law — never fabricate

- Output **only** what is confidently true and backed by real data or vetted literature.
- **Never invent** results, splits, times, rates, statistics, study findings, or citations — any number, ever.
- If a number wasn't in data the user or app supplied, it does not appear. If a source isn't a real vetted entry, it does not appear.
- When unsure, **say so plainly and flag it**. Under-claiming beats hallucinating. This is the product's core trust promise, not a preference.

## How we enforce it (from Adam's own AI field guide, `Oara_Seven_Papers.pdf`)

- **Retrieve, then generate (ReAct).** Pull the real numbers / the real source first; the model only ever quotes data it was given — it never fills gaps from memory.
- **Reason step-by-step (Chain-of-Thought).** For any analysis: first list *what the data shows* → then *interpret* → then *conclude*. No verdicts in one leap.
- **Place key info at the edges (Lost in the Middle).** Put the most important instruction and numbers at the **start or end** of a long prompt; retrieve only the relevant slice rather than dumping everything.

## Analysis is deterministic math, not LLM estimation

- Every metric (sectional times, 500 m splits, distance-per-stroke/"run", boat speed, fade, rate mean/SD, comparisons) is computed **by code from real inputs**.
- `500 m split = time × 500 ÷ distance` = **average pace**. Never present average pace as if it were a measured intermediate split.
- Keep analysis logic as **pure functions** so it ports unchanged from today's static page into the eventual app.

## Voice & audience

- Reader has **no CS background**; explain plainly. Biology/clinical and rowing analogies land well.
- Feedback framing: **praise what went well first**, then areas to improve.
- Concise, friendly, jargon defined when used.

## Evidence store (rowing science)

- Any scientific claim must map to a **real, vetted entry**. No entry → no claim.
- **Location & format:** `evidence/evidence.json` is the **single source of truth** — two lists, `papers[]` (real sources) and `claims[]` (citable findings, each `paperId`-linked and `tags`-matched to an analysis observation). Schema + Adam's "how to add a paper" checklist + the controlled `tags` vocabulary live in `evidence/README.md`. The store is **empty until Adam verifies a real source**; the dashboard loads it at runtime and shows the arithmetic always, the science only when a claim matches (mechanical "no entry → no claim"). It becomes a Supabase table in Phase 1 — rows map 1:1, so no rework.
- **Important:** `Oara_Seven_Papers.pdf` is an **AI/LLM field guide** (Transformer, InstructGPT, DPO, LoRA, CoT, ReAct, Lost-in-the-Middle) — **not** rowing literature. The rowing evidence store must be built from **real rowing-science sources**, supplied by Adam or retrieved-and-verified. Do not fabricate rowing citations.

## Architecture direction (when a feature needs a backend)

- **Multi-tenant from the data model up** — strict per-club isolation.
- **Privacy by default** — boat consensus is anonymous by default; rower data is sensitive.
- Planned stack: **Supabase** (auth/db/storage/row-level security) + **Next.js/Vercel** + **Stripe**.

## Current focus

- **Phase 0:** build the **OmniRace** post-race CoxBox engine on the static dashboard (`index.html`) — parse the pasted 100 m table (`Distance | Time | Split | Rate`), compute the metrics above, visualise, and produce a literature-cited pacing analysis once real rowing sources exist.
