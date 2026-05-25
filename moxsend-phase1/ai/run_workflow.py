import sys
import json
import logging
import re
from moxsend_graph.graphs.personalization_graph import personalization_graph
from moxsend_graph.graphs.subject_graph import run_subject_optimizer
from utils.evaluator import evaluate_output
from utils.interpolation import interpolate_tags

# Configure logging to go to stderr so stdout is pure JSON
logging.basicConfig(level=logging.INFO, stream=sys.stderr)
logger = logging.getLogger(__name__)

def main():
    try:
        input_data = json.load(sys.stdin)
        workflow = str(input_data.get("workflow") or "").strip()
        active_lead = input_data.get("active_lead", {})

        if workflow == "subject_optimizer":
            logger.info("Received subject optimizer payload")

            result = run_subject_optimizer(
                {
                    "subject_input": input_data.get("subject_input", ""),
                    "campaign_context": input_data.get("campaign_context", ""),
                    "lead_context": input_data.get("lead_context", ""),
                    "offer_context": input_data.get("offer_context", ""),
                    "tone": input_data.get("tone", "Professional"),
                }
            )
            
            # Interpolate variants if needed (usually optimizer doesn't need it as much, but good practice)
            variants = [interpolate_tags(v, active_lead) for v in result.get("variants", [])]
            
            output = {
                "success": bool(result.get("success", False)),
                "error": result.get("error"),
                "variants": variants,
            }
        else:
            action = input_data.get("action") or "generate_base"
            logger.info(f"Received payload action={action} leads={len(input_data.get('selected_leads', []))}")

            state = {
                "action": action,
                "selected_leads": input_data.get("selected_leads", []),
                "campaign_brief": input_data.get("campaign_brief", ""),
                "tone": input_data.get("tone", "Professional"),
                "market": input_data.get("market", ""),
                "base_email": input_data.get("base_email", ""),
                "base_subject": input_data.get("base_subject", ""),
                "refinement_prompt": input_data.get("refinement_prompt", ""),
                "active_lead": active_lead,
                "model": input_data.get("model", ""),
            }

            import time
            from utils.sentence_analyzer import SentenceAnalyzer
            from utils.gcc_arabic_library import calculate_arabic_naturalness_score

            start_time = time.perf_counter()
            result = personalization_graph.invoke(state)
            latency_ms = (time.perf_counter() - start_time) * 1000
            
            # Interpolate results
            gen_base = interpolate_tags(result.get("generated_base_email", ""), active_lead)
            gen_subjects = []
            for s in result.get("generated_subject_lines", []):
                if isinstance(s, dict):
                    new_s = s.copy()
                    new_s["subject"] = interpolate_tags(s.get("subject", ""), active_lead)
                    gen_subjects.append(new_s)
                else:
                    gen_subjects.append(interpolate_tags(str(s), active_lead))
            refined = result.get("refined_email")
            if refined and isinstance(refined, dict):
                refined["bodyHtml"] = interpolate_tags(refined.get("bodyHtml", ""), active_lead)
                refined["subject"] = interpolate_tags(refined.get("subject", ""), active_lead)

            output = {
                "generated_base_email": gen_base,
                "generated_subject_lines": gen_subjects,
                "refined_email": refined,
            }

            if workflow.lower() == "benchmark":
                from benchmarking.live_evaluator import calculate_live_metrics
                output["metrics"] = calculate_live_metrics(
                    output["generated_base_email"],
                    input_data.get("language", "english"),
                    state,
                    latency_ms
                )
        
        print(json.dumps(output))

    except Exception as e:
        logger.error(f"Error in python workflow: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
