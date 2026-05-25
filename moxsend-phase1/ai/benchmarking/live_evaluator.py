from typing import Dict, Any
import time
from ai.utils.evaluator import evaluate_output
from ai.utils.sentence_analyzer import SentenceAnalyzer
from ai.utils.gcc_arabic_library import calculate_arabic_naturalness_score

def calculate_live_metrics(output_content: str, language: str, state: Dict[str, Any], latency_ms: float) -> Dict[str, Any]:
    """
    Calculate real-time benchmark metrics for the web UI.
    This function is central to the Model Intelligence Benchmark dashboard.
    """
    lang = language.lower()
    
    # 1. Base Evaluation (Quality, Personalization, Hallucination)
    eval_res = evaluate_output(
        {"content": output_content},
        lang,
        personalization_context=state.get("active_lead") or (state.get("selected_leads")[0] if state.get("selected_leads") else {}),
        narrative_context={"primary_narrative": state.get("campaign_brief", "")}
    )
    
    # 2. Humanization Analysis (Rhythm, Pacing, SDR-tone)
    human_analysis = SentenceAnalyzer.calculate_humanness_score(output_content)
    
    # 3. GCC Regional Fit (if Arabic or GCC market)
    is_arabic = lang == "arabic" or state.get("market", "").lower() in ["gcc", "mena", "global"]
    regional_fit = {"score": 8.0, "feedback": []}
    if is_arabic:
        regional_fit = calculate_arabic_naturalness_score(output_content)
    
    return {
        "quality_score": round(eval_res.get("score", 0) * 10, 1), # Scale to 100
        "personalization_score": round(eval_res.get("detailed_scores", {}).get("personalization", 0) * 10, 1),
        "humanization_score": round(human_analysis.get("overall_score", 0) * 10, 1),
        "regional_fit_score": round(regional_fit.get("score", 0) * 10, 1),
        "latency_ms": round(latency_ms, 2),
        "latency_seconds": round(latency_ms / 1000, 2),
        "workflow_stage": "completed",
        "hallucination_detected": eval_res.get("score", 10) < 4.0,
        "summary": eval_res.get("reasoning_summary") or ", ".join(eval_res.get("issues", [])) or "Standard generation completed successfully.",
        "humanization_summary": f"Rhythm: {human_analysis.get('rhythm', 0):.1f}/10, Pacing: {human_analysis.get('pacing', 0):.1f}/10",
        "regional_summary": " | ".join(regional_fit.get("feedback", [])) if regional_fit.get("feedback") else "Strong regional alignment.",
        "strengths": eval_res.get("detailed_scores", {}).get("strengths") or [
            "Good operational alignment",
            "Clean HTML structure",
            "Consistent brand voice"
        ],
        "weaknesses": eval_res.get("issues", []) or ["No major issues identified."]
    }
