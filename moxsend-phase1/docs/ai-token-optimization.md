# AI token optimization (Moxsend)

This document explains **how this repo reduces LLM token use** (input + output) for the personalize and related flows. It complements [`ai-personalize-workflow.md`](./ai-personalize-workflow.md).

---

## 1. Trim system / instruction text

| Area | Approach |
|------|-----------|
| **Personalize email** | `ai/prompts/personalize-email.prompt.ts` uses a **compact** rule set: merged bullets, no long duplicated “good/bad” email examples, forbidden phrases summarized as a **short buzzword line** instead of a long quoted list. |
| **Arabic translate** | `ai/prompts/translate-ar.prompt.ts` — shorter translator preamble; same contract (JSON + merge tokens). |
| **Rewrite** | `ai/prompts/rewrite.prompt.ts` — single-paragraph rules per field instead of long numbered lists. |

**Why it matters:** Input tokens are charged on **every** request. Shorter prompts are the highest-leverage savings when the model behavior stays acceptable.

---

## 2. Tighten `max_tokens` and output shape

| Call site | Setting |
|-----------|---------|
| **Personalize email** (`POST .../personalize-email`) | `maxOutputTokens` scales with **email length**: short ≈ **1200**, medium ≈ **1800**, long ≈ **2600** (see `personalizeMaxOutputTokens` in `frontend/app/api/gemini/personalize-email/route.ts`). Much lower than the Groq default **8192**. |
| **Rewrite subject** | `maxOutputTokens: **128**` (plain line only). |
| **Rewrite body** | `maxOutputTokens: **3072**` (was 8192). |
| **Translate AR** | `generateJson(..., { maxOutputTokens: **4096**, temperature: 0.65 })`. |

**Implementation:** `generateJson` and `generateJsonWithMeta` accept optional `GenerateOptions` (`ai/model/types.ts`, `ai/model/groq.ts`, `ai/model/index.ts`).

**Why it matters:** Output token caps stop the model from **over-generating** and reduce completion cost; JSON subject+body has a predictable upper size if paragraphs are bounded in the prompt.

---

## 3. Split workflows (fewer expensive calls)

| Before | After |
|--------|--------|
| **Generate:** one `POST /api/groq/personalize-email` **per selected lead** (same cohort repeated in every prompt). | **One** generation call per click: `sampleRow` = **reference lead** (`safeRef`), `cohortRows` = full selection when size > 1. Result is **replicated** to every row (one merge-tag template for the cohort). |
| **Translate:** N parallel calls when every row held the same English. | If all rows share identical `subject` + `bodyHtml`, **one** translate call; Arabic result copied to all rows. |

**Why it matters:** Duplicate full prompts × N dominated cost. One template + merge tags matches the product model documented in `ai-personalize-workflow.md`.

---

## 4. Operational notes

- **Retries** on personalize-email still repeat the full prompt; keep validation and timeouts healthy to avoid double-billing.
- **Env:** `GROQ_MODEL` unchanged; tuning `maxOutputTokens` is independent of model id.
- If outputs truncate mid-JSON, **raise** the length-specific cap in `personalizeMaxOutputTokens` slightly or tighten body paragraph rules in the prompt.

---

## 5. File index

| Concern | File(s) |
|---------|---------|
| Personalize prompt size | `ai/prompts/personalize-email.prompt.ts` |
| Translate / rewrite prompt size | `ai/prompts/translate-ar.prompt.ts`, `ai/prompts/rewrite.prompt.ts` |
| Groq max tokens + options plumbing | `ai/model/groq.ts`, `ai/model/index.ts`, `ai/model/types.ts` |
| Personalize + translate + rewrite routes | `frontend/app/api/gemini/personalize-email/route.ts`, `translate-ar/route.ts`, `rewrite/route.ts` |
| Single generate + batched translate | `frontend/app/leads/personalize/page.tsx` |

Update this doc when caps or call patterns change.
