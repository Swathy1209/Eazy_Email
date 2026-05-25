# Moxsend AI System Architecture (v1)

This document formalizes the prompt structure into stable modules for the Moxsend AI Outbound System. The transition from "prompt experimentation" to "AI PRODUCT ENGINEERING" ensures a stable, scalable, evaluated, and UX-aligned AI system.

## 1. Master Prompt Architecture (`master_prompt_v1`)

The master prompt architecture is modular, reusable, scalable, maintainable, and version-controlled. It integrates the following key sub-engines:
- Narrative Engine
- Hierarchy Inference Engine
- Subject Line Rules
- GCC Localization Rules
- Edge-Case Rules
- Token Efficiency Rules
- Output Normalization Rules
- Multilingual Generation Rules
- Evaluation Heuristics

## 2. Narrative Engine (`narrative_engine`)

To avoid repetitive workflow narratives, the system must naturally rotate between established operational storylines based on the inferred hierarchy level.
- TYPE A: Approval Bottlenecks (momentum loss, launch delays)
- TYPE B: Context Fragmentation (updates buried, teams chasing context)
- TYPE C: Coordination Drift (requests bouncing, priorities drifting)
- TYPE D: Launch Execution Stress (reactive launches, last-minute chaos)
- TYPE E: Visibility Gaps (nobody knows status, ownership unclear)
- TYPE F: Request Overload (routine asks overwhelming teams)
- TYPE G: Handoff Breakdown (tasks stalling between teams)

## 3. Hierarchy Inference Engine (`hierarchy_inference_engine`)

The AI must classify inputs into hierarchy levels before generating content to avoid premature domain narrowing.
- LEVEL 1 (Organization-Wide / Broad): Cross-team coordination, internal requests, workflow handoffs, distributed operations.
- LEVEL 2 (Functional Domain): Only use department-specific terms if explicitly implied (e.g., Marketing -> campaigns; Sales -> pipeline; HR -> onboarding).

## 4. GCC & Arabic Localization Rules (`gcc_localization_rules`)

The AI must support GCC BUSINESS LOCALIZATION:
- **UAE**: Agile, modern, fast-scaling tone. Prioritize scaling operations and fast-moving execution.
- **Saudi Arabia**: Structured, enterprise-oriented, process-aware tone. Prioritize enterprise coordination and compliance.
- **Arabic Generation (`multilingual_generation_rules`)**: Do NOT machine-translate English phrasing. Generate culturally believable Arabic business realism. Preserve RTL-safe rendering and exactly match merge-tags (e.g., `{{tag}}`). Prevent multilingual encoding artifacts.

## 5. Output Normalization Rules (`output_normalization_rules`)

Outputs must be frontend-safe, schema-safe, render-safe, and scalable:
- Normalize subject length (preferred under 7 words).
- Enforce strict structural limits (e.g., exactly 4 short paragraphs).
- Normalize CTA structures (soft, casual, operational).
- Ensure strict JSON schema compliance.
- Do not produce unstable structures, malformed HTML, or break rendering consistency.

## 6. Edge-Case Rules (`edge_case_rules`)

Handle non-standard inputs gracefully:
- **Short/Vague Inputs**: Avoid CRM defaults. Infer broad operational workflows.
- **Highly Technical Products**: Abstract technical capabilities into operational realities. Avoid jargon dumping.
- **Incomplete Data**: Handle malformed inputs or incomplete personalization gracefully without catastrophic failures.

## 7. Token Efficiency Rules (`token_efficiency_rules`)

Optimize for inference efficiency and conversational sharpness:
- Reduce filler words and redundant phrasing.
- Compress operational realism.
- Avoid repeating domain clues unnecessarily.
- Prioritize tighter paragraphs and fewer abstractions.

## 8. UX-First AI Architecture

The AI system is strictly aligned with the frontend UX:
- Outputs must render directly into UI cards.
- Support async polling, retries, and partial generation.
- Minimize transformation logic.
- **Forbidden**: Generating verbose reasoning dumps, unstable schemas, or frontend-incompatible structures.

## 9. Failure Database & Retry Intelligence

The system maintains failure intelligence to learn from recurring weaknesses:
- Track repetitive outputs, domain mismatches, malformed HTML, translation failures, and schema violations.
- Support malformed response retries, translation fallbacks, timeout recovery, and schema validation to ensure graceful degradation.

## 10. Evaluation Heuristics & Self-Evaluation (`evaluation_heuristics`)

The AI must evaluate outputs systematically before finalization based on 10 strict heuristics:
1. Is this production-stable?
2. Is this frontend-safe?
3. Is this schema-consistent?
4. Is this operationally believable?
5. Is the output compact enough?
6. Is the localization realistic?
7. Is the reasoning consistent?
8. Does this support scaling?
9. Is the UX flow preserved?
10. Would this survive real product usage?

*If the answer to any of these is NO, the AI must rewrite the output.*
