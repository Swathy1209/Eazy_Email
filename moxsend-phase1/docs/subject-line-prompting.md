# Moxsend AI: Outbound Intelligence Layer

## 1. Project Overview
This document outlines the architecture and prompting constraints for Moxsend's Phase 1 AI Email Generation Layer. The core objective of this system is to eliminate generic SaaS marketing copy and replace it with elite, operationally grounded outbound writing that reads like peer-to-peer observations.

## 2. Architecture
The AI prompt engine is modularized across the following domains to support seamless transition to OpenAI/Claude SDKs:
- **`/prompts/systemPrompt.js`**: Core behavioral constraints (Operational Realism, 60/40 rule, Forbidden Phrases).
- **`/prompts/subjectPrompts.js`**: Drives the 5-variant psychological subject line logic.
- **`/prompts/bodyPrompts.js`**: Enforces the 4-paragraph structural constraint and product transition rules.
- **`/prompts/rewritePrompts.js`**: Surgical editing constraints for user-driven UI regeneration.
- **`/prompts/scoringPrompts.js`**: The self-critique heuristics used before final JSON generation.

## 3. Prompting Philosophy
Marketing language ("empower teams", "drive growth") sells a theoretical vision. Operational language ("scattered follow-ups", "pipeline momentum slowing") describes a concrete nightmare. The AI is positioned as a **Senior Sales Operator**, not a copywriter.

## 4. Anti-Generic System
The system utilizes a hardcoded `FORBIDDEN_PHRASES` regex matrix. Any output containing "accelerate growth", "maximize efficiency", "streamline operations", "innovative solution", or similar tokens is aggressively rejected.

## 5. Operational Realism Framework
The AI follows a strict 4-step generation framework:
1. **Workflow bottleneck**: Isolate a realistic operational pressure.
2. **Business consequence**: Expose the hidden outcome of that bottleneck.
3. **Operational outcome**: Calmly introduce a functional resolution (avoiding feature-stacking).
4. **Soft CTA**: Conversational, low-friction (e.g., "Worth exploring whether this could simplify things?").

## 6. Few-Shot Strategy & Style Locking
LLMs drift toward marketing language by default. We lock the tone using negative/positive few-shot pairs. By explicitly showing the AI what "brochure writing" looks like vs "observational writing", the LLM correctly anchors its tone.

## 7. Rewrite Logic
Generation mode aims for variety across psychological triggers. **Rewrite mode** acts as a ruthless editor: stripping out buzzwords, shortening sentences, and intensifying the operational diagnosis while preserving user intent and `{{merge_tags}}`.

## 8. Scoring System & Self-Critique
Before returning output, the AI triggers a "Self-Critique Mode". It internally asks:
- Does this sound AI-generated?
- Does it sound like a landing page?
- Are there startup buzzwords?
If YES, it triggers an internal rewrite before returning the JSON payload to the user.

## 9. Validation Layer
Output validator logic intercepts the AI payload and checks regex rules against the `FORBIDDEN_PHRASES` array. Outputs exceeding a 35% product-description ratio or containing hardcoded CTAs ("Book a demo") are flagged for regeneration.

## 10. Backend Integration
The UI (Next.js) calls `geminiGenerateJson` passing the modularized prompts. The `aiGeneration.service` maps this exact logic for background CSV-batch processing, ensuring consistency whether processing 1 row manually or 10,000 rows async.

## 11. Example Outputs
*Subject*: Why follow-ups start slipping
*Body*: As outreach volume grows, follow-ups usually become harder to maintain once conversations start spreading across inboxes, spreadsheets, and CRMs. Teams often spend more time updating records than actually moving conversations forward.

## 12. Future Improvements
- Zod integration for strict JSON schema runtime validation.
- Migration to Redis for persistent background job state.
- Dynamic localized prompt overriding for MENA (Arabic context shifts).
