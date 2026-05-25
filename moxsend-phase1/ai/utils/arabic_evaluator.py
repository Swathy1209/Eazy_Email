"""
Arabic-specific evaluator enhancements for GCC business communication.
"""

import re
from typing import Dict, Any, List
from ai.utils.gcc_arabic_library import is_natural_arabic_flow, INDUSTRY_TERMS_ARABIC

def evaluate_arabic_fluency(content: str) -> float:
    """
    Evaluate Arabic naturalness and business appropriateness.
    """
    score = 8.0
    
    # Check for basic Arabic presence
    arabic_char_count = sum(1 for c in content if ord(c) > 127)
    total_chars = len(content.replace(' ', ''))
    
    if arabic_char_count < total_chars * 0.8:
        score -= 3
    
    # Check for natural Arabic flow
    if not is_natural_arabic_flow(content):
        score -= 2
    
    # Check for common Arabic business markers (positive signs)
    positive_markers = ['أن', 'التي', 'من خلال', 'يمكننا', 'نتطلع']
    marker_count = sum(1 for marker in positive_markers if marker in content)
    score += min(2.0, marker_count * 0.4)
    
    # Check for mistranslation patterns
    mistranslation_indicators = [
        'من قبل',  # "before" instead of "by"
        'في الواقع',  # Overused filler
        'بواسطة',  # Overly formal "by"
    ]
    
    for indicator in mistranslation_indicators:
        if indicator in content:
            score -= 0.5
    
    # Check for business terminology appropriateness
    business_words = ['تحسين', 'تطوير', 'كفاءة', 'جودة', 'خدمة']
    business_count = sum(1 for word in business_words if word in content)
    score += min(1.0, business_count * 0.2)
    
    return min(10.0, max(0.0, score))

def evaluate_gcc_tone(content: str) -> float:
    """
    Evaluate if tone is appropriate for GCC business communication.
    """
    score = 7.0
    
    # Check for respect markers
    respect_markers = ['حضرتك', 'سيادتك', 'جناب', 'الفاضل', 'الفاضلة']
    respect_count = sum(1 for marker in respect_markers if marker in content)
    
    if respect_count > 0:
        score += 1
    
    # Check for collaboration language
    collaboration = ['التعاون', 'شراكة', 'معاً', 'نتعاون', 'بالتشارك']
    collab_count = sum(1 for word in collaboration if word in content)
    score += min(1.5, collab_count * 0.3)
    
    # Check for urgency in professional way
    urgency_markers = ['بسرعة', 'دون تأخير', 'بشكل عاجل', 'الوقت الراهن']
    urgency_count = sum(1 for marker in urgency_markers if marker in content)
    
    if urgency_count > 1:
        score -= 1  # Too urgent might seem pushy
    elif urgency_count == 1:
        score += 0.5
    
    # Check for GCC-specific business phrases
    gcc_phrases = ['من هذا المنطلق', 'نود أن نشير', 'في ضوء ذلك']
    gcc_count = sum(1 for phrase in gcc_phrases if phrase in content)
    score += min(1.0, gcc_count * 0.3)
    
    return min(10.0, max(0.0, score))

def evaluate_arabic_personalization(content: str, context: Dict[str, Any]) -> float:
    """
    Evaluate personalization quality in Arabic context.
    """
    score = 6.0
    
    # Check for company/industry specific references
    company = context.get('company', '').lower() if isinstance(context.get('company'), str) else ''
    industry = context.get('industry', '').lower() if isinstance(context.get('industry'), str) else ''
    
    if company and company in content.lower():
        score += 2
    
    # Check for industry-appropriate Arabic terminology
    if industry in INDUSTRY_TERMS_ARABIC:
        industry_terms = INDUSTRY_TERMS_ARABIC[industry]
        term_count = sum(1 for term in industry_terms.values() if term in content)
        score += min(2.0, term_count * 0.3)
    
    # Check for pain point references
    pain_points = context.get('pain_points', [])
    if pain_points:
        pain_point_hits = sum(1 for pain in pain_points if str(pain).lower() in content.lower())
        score += min(1.5, pain_point_hits * 0.5)
    
    # Check for role-specific messaging
    persona = context.get('persona', '').lower() if isinstance(context.get('persona'), str) else ''
    if persona and persona in content.lower():
        score += 1
    
    return min(10.0, max(0.0, score))

def evaluate_arabic_clarity(content: str) -> float:
    """
    Evaluate clarity of Arabic messaging.
    """
    score = 8.0
    
    # Check length
    words = content.split()
    word_count = len(words)
    
    if word_count < 3:
        score -= 3
    elif word_count > 20:  # Overly long for subject line
        score -= 1
    
    # Check for complex grammar that might reduce clarity
    complex_patterns = [
        r'الذي.*الذي',  # Multiple 'which' can be confusing
        r'من.*من.*من',  # Multiple 'from/of'
    ]
    
    for pattern in complex_patterns:
        if re.search(pattern, content):
            score -= 0.5
    
    # Check for balance between Arabic and English
    english_words = sum(1 for word in words if ord(word[0]) < 128 and word not in [',', '.', '-', ':'])
    english_ratio = english_words / len(words) if words else 0
    
    if english_ratio > 0.15:
        score -= 1  # Too many English words mixed in
    
    return min(10.0, max(0.0, score))

def evaluate_arabic_naturalness(content: str) -> float:
    """
    Evaluate how natural and human-like the Arabic sounds.
    """
    score = 7.0
    
    # Check for overly formal/robotic patterns
    robotic_patterns = [
        r'نود أن نعلمكم',  # Overly formal
        r'الرجاء منكم',  # Too formal request
        r'بموجب',  # Legal/bureaucratic
    ]
    
    for pattern in robotic_patterns:
        if re.search(pattern, content, re.IGNORECASE):
            score -= 0.5
    
    # Check for natural conversational markers
    conversational = ['أعتقد', 'في رأيي', 'ربما', 'من الممكن']
    conv_count = sum(1 for marker in conversational if marker in content)
    score += min(1.0, conv_count * 0.25)
    
    # Check for varied sentence structure (difficult to assess in Arabic)
    # Look for variation in diacritical marks or word endings
    sentences = re.split(r'[.!?؟]+', content)
    if len(sentences) > 1:
        sentence_variety = len(set(s.strip()[:3] for s in sentences if s.strip()))
        variety_score = min(2.0, (sentence_variety / len(sentences)) * 2)
        score += variety_score
    
    return min(10.0, max(0.0, score))

def evaluate_arabic_output(content: str, language: str, personalization_context: Dict = None, 
                          narrative_context: Dict = None) -> Dict[str, Any]:
    """
    Comprehensive Arabic output evaluation.
    """
    if language != "arabic":
        return {}
    
    personalization_context = personalization_context or {}
    
    # Calculate individual scores
    fluency_score = evaluate_arabic_fluency(content)
    tone_score = evaluate_gcc_tone(content)
    personalization_score = evaluate_arabic_personalization(content, personalization_context)
    clarity_score = evaluate_arabic_clarity(content)
    naturalness_score = evaluate_arabic_naturalness(content)
    
    # Weighted average
    total_score = (
        fluency_score * 0.25 +
        tone_score * 0.25 +
        personalization_score * 0.20 +
        clarity_score * 0.15 +
        naturalness_score * 0.15
    )
    
    approved = total_score >= 7.0
    issues = []
    
    if fluency_score < 6:
        issues.append("Arabic fluency issues")
    if tone_score < 6:
        issues.append("GCC tone not appropriate")
    if personalization_score < 5:
        issues.append("weak personalization")
    if clarity_score < 6:
        issues.append("clarity issues")
    if naturalness_score < 6:
        issues.append("sounds robotic")
    
    return {
        "approved": approved,
        "score": round(total_score, 1),
        "issues": issues,
        "retry_recommended": not approved,
        "detailed_scores": {
            "arabic_fluency": fluency_score,
            "gcc_tone": tone_score,
            "personalization": personalization_score,
            "clarity": clarity_score,
            "naturalness": naturalness_score
        }
    }