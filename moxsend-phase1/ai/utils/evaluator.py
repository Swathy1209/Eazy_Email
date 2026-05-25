from providers.model_router import ModelRouter
from schemas.evaluation import EvaluationResult
from benchmarking.datasets import QUALITY_CRITERIA
from typing import Dict, Any, List

def evaluate_output(output: Dict[str, Any], language: str, personalization_context: Dict = None, narrative_context: Dict = None) -> Dict[str, Any]:
    """
    Evaluate the generated output using detailed criteria.
    """
    if not output:
        return EvaluationResult(
            approved=False,
            score=0.0,
            issues=["No output to evaluate"],
            retry_recommended=True,
            detailed_scores={}
        ).dict()

    content = output.get('content', '')
    
    # Detailed evaluation criteria
    scores = {}
    issues = []
    
    # 1. Personalization (0.25 weight)
    personalization_score = evaluate_personalization(content, personalization_context or {})
    scores["personalization"] = personalization_score
    
    # 2. Tone Quality (0.20 weight)
    tone_score = evaluate_tone_quality(content, language)
    scores["tone_quality"] = tone_score
    
    # 3. Naturalness (0.20 weight)
    naturalness_score = evaluate_naturalness(content)
    scores["naturalness"] = naturalness_score
    
    # 4. Business Relevance (0.15 weight)
    relevance_score = evaluate_business_relevance(content, narrative_context or {})
    scores["business_relevance"] = relevance_score
    
    # 5. Clarity (0.10 weight)
    clarity_score = evaluate_clarity(content)
    scores["clarity"] = clarity_score
    
    # 6. Formatting (0.10 weight)
    formatting_score = evaluate_formatting(content, language)
    scores["formatting"] = formatting_score
    
    # Calculate weighted score
    total_score = sum(scores[criterion] * QUALITY_CRITERIA[criterion]["weight"] 
                     for criterion in scores)
    
    # Determine approval and issues
    approved = total_score >= 7.0
    
    if personalization_score < 6:
        issues.append("insufficient personalization")
    if tone_score < 6:
        issues.append("tone quality issues")
    if naturalness_score < 6:
        issues.append("sounds too robotic")
    if relevance_score < 6:
        issues.append("low business relevance")
    if clarity_score < 6:
        issues.append("unclear messaging")
    if formatting_score < 6:
        issues.append("formatting issues")
    
    # Model-based evaluation for complex cases
    reasoning = ""
    try:
        router = ModelRouter({})
        eval_prompt = f"Evaluate this {language} email content for outbound effectiveness. Content: '{content}'. Provide a 1-sentence reasoning summary and a score (1-10)."
        eval_response = router.invoke_model('evaluate', eval_prompt)
        content_res = eval_response.get('content', '')
        
        # Simple extraction logic for score and reasoning
        import re
        score_match = re.search(r'(\d+(\.\d+)?)', content_res)
        model_score = float(score_match.group(1)) if score_match else 7.0
        reasoning = content_res.split('\n')[0] # Take first line as reasoning
        
        # Blend with calculated score
        total_score = (total_score * 0.7) + (model_score * 0.3)
    except:
        pass  # Use calculated score
    
    return EvaluationResult(
        approved=approved,
        score=round(total_score, 1),
        issues=issues,
        retry_recommended=not approved,
        detailed_scores=scores,
        reasoning_summary=reasoning
    ).dict()

def evaluate_personalization(content: str, context: Dict[str, Any]) -> float:
    """Evaluate personalization quality."""
    score = 5.0
    
    # Check for company/lead-specific references
    company = context.get('company', '').lower()
    industry = context.get('industry', '').lower()
    
    if company and company in content.lower():
        score += 2
    if industry and industry in content.lower():
        score += 1
    
    # Check for generic vs specific language
    generic_words = ['company', 'business', 'organization', 'client']
    specific_indicators = [company, industry] if company and industry else []
    
    generic_count = sum(1 for word in generic_words if word in content.lower())
    specific_count = sum(1 for word in specific_indicators if word and word in content.lower())
    
    if specific_count > generic_count:
        score += 1
    elif generic_count > specific_count:
        score -= 1
    
    return min(10.0, max(0.0, score))

def evaluate_tone_quality(content: str, language: str) -> float:
    """Evaluate tone appropriateness."""
    score = 7.0
    
    # Check for professional language
    professional_indicators = ['improve', 'optimize', 'enhance', 'streamline', 'efficiency']
    unprofessional_indicators = ['awesome', 'amazing', 'fantastic', 'urgent!', 'act now']
    
    prof_count = sum(1 for word in professional_indicators if word in content.lower())
    unprof_count = sum(1 for word in unprofessional_indicators if word in content.lower())
    
    score += prof_count * 0.5
    score -= unprof_count * 1.0
    
    # Language-specific checks
    if language == "arabic":
        # Check for GCC business tone
        arabic_business_indicators = ['تحسين', 'تطوير', 'كفاءة']  # improvement, development, efficiency
        arabic_count = sum(1 for word in arabic_business_indicators if word in content)
        score += arabic_count * 0.5
    
    return min(10.0, max(0.0, score))

def evaluate_naturalness(content: str) -> float:
    """Evaluate how human-like the content sounds."""
    score = 7.0
    
    # Check sentence structure variety
    sentences = content.split('.')
    if len(sentences) > 1:
        lengths = [len(s.strip().split()) for s in sentences if s.strip()]
        if lengths and max(lengths) - min(lengths) > 3:  # Good length variation
            score += 1
    
    # Check for robotic patterns
    robotic_patterns = ['optimize your', 'improve your', 'enhance your']
    robotic_count = sum(1 for pattern in robotic_patterns if pattern in content.lower())
    score -= robotic_count * 0.5
    
    # Check for natural transitions
    natural_transitions = ['and', 'but', 'however', 'also', 'moreover']
    transition_count = sum(1 for word in natural_transitions if word in content.lower())
    score += min(1.0, transition_count * 0.2)
    
    return min(10.0, max(0.0, score))

def evaluate_business_relevance(content: str, narrative_context: Dict[str, Any]) -> float:
    """Evaluate business relevance."""
    score = 6.0
    
    # Check narrative alignment
    primary_narrative = narrative_context.get('primary_narrative', '')
    business_focus = narrative_context.get('business_focus', '')
    
    if primary_narrative and primary_narrative.replace('_', ' ') in content.lower():
        score += 2
    if business_focus and business_focus in content.lower():
        score += 1
    
    # Check for business value indicators
    value_indicators = ['save', 'reduce', 'increase', 'improve', 'optimize', 'ROI', 'efficiency']
    value_count = sum(1 for word in value_indicators if word in content.lower())
    score += min(2.0, value_count * 0.5)
    
    return min(10.0, max(0.0, score))

def evaluate_clarity(content: str) -> float:
    """Evaluate clarity of messaging."""
    score = 8.0
    
    # Length check
    word_count = len(content.split())
    if word_count < 3:
        score -= 3
    elif word_count > 15:
        score -= 1
    
    # Check for ambiguous language
    ambiguous_words = ['things', 'stuff', 'issues', 'problems']
    ambiguous_count = sum(1 for word in ambiguous_words if word in content.lower())
    score -= ambiguous_count * 0.5
    
    return min(10.0, max(0.0, score))

def evaluate_formatting(content: str, language: str) -> float:
    """Evaluate formatting quality."""
    score = 9.0
    
    # Check for proper punctuation
    if not content.endswith(('.', '!', '?')):
        score -= 1
    
    # Check for proper capitalization
    if not content[0].isupper():
        score -= 1
    
    # Language-specific formatting
    if language == "arabic":
        # RTL-safe check (simplified)
        if any(ord(c) > 127 for c in content):  # Contains Arabic
            score += 0.5  # Bonus for Arabic characters
    
    return min(10.0, max(0.0, score))