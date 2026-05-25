from typing import List, Dict, Any
import re

# GCC Business Communication Styles
GCC_BUSINESS_PHRASES = {
    "greetings": [
        "السلام عليكم ورحمة الله",
        "تحياتي الطيبة",
        "مع أطيب التحيات"
    ],
    "respect_markers": [
        "حضرتك",
        "سيادتك",
        "جناب",
        "الفاضل/الفاضلة"
    ],
    "business_transitions": [
        "بناءً على ذلك",
        "من هذا المنطلق",
        "وعليه",
        "لذا فإننا",
        "أود أن أشير إلى"
    ],
    "urgency_markers": [
        "في الوقت الراهن",
        "في الوقت الحاضر",
        "بشكل عاجل",
        "دون تأخير"
    ],
    "value_propositions": [
        "تحسين الكفاءة",
        "زيادة الإيرادات",
        "تقليل التكاليف",
        "تطوير العمليات",
        "تحسين الخدمات",
        "زيادة رضا العملاء"
    ],
    "collaboration_markers": [
        "التعاون المثمر",
        "الشراكة الاستراتيجية",
        "التعاون البناء",
        "العمل المشترك"
    ],
    "closings": [
        "نتطلع لتعاونكم",
        "نتمنى التعاون معكم",
        "في انتظار ردكم الكريم",
        "شاكرين لكم",
        "تفضلوا بقبول احترامي"
    ]
}

# Industry-specific Arabic terminology
INDUSTRY_TERMS_ARABIC = {
    "healthcare": {
        "clinic": "عيادة",
        "hospital": "مستشفى",
        "patient": "مريض",
        "care": "رعاية",
        "treatment": "علاج",
        "operations": "العمليات",
        "efficiency": "كفاءة الخدمات",
        "quality": "جودة الرعاية"
    },
    "hospitality": {
        "hotel": "فندق",
        "resort": "منتجع",
        "guest": "ضيف",
        "experience": "التجربة",
        "service": "الخدمة",
        "reservation": "الحجز",
        "customer_satisfaction": "رضا الضيوف",
        "operations": "العمليات الفندقية"
    },
    "logistics": {
        "shipment": "الشحنة",
        "delivery": "التسليم",
        "supply": "سلسلة التوريد",
        "warehouse": "المستودع",
        "efficiency": "كفاءة التسليم",
        "tracking": "تتبع الشحنات",
        "operations": "العمليات اللوجستية"
    },
    "real_estate": {
        "property": "العقار",
        "investment": "الاستثمار",
        "client": "العميل",
        "transaction": "العملية",
        "development": "التطوير",
        "management": "الإدارة"
    },
    "saas": {
        "platform": "منصة",
        "solution": "حل",
        "integration": "التكامل",
        "automation": "الأتمتة",
        "analytics": "التحليلات",
        "efficiency": "الكفاءة"
    }
}

# GCC-appropriate emotional markers
EMOTIONAL_MARKERS_ARABIC = {
    "concern": ["يقلقنا", "نرى بأن", "من أهم التحديات"],
    "opportunity": ["الفرصة المتاحة", "يمكننا معاً", "لدينا الحل"],
    "respect": ["نقدر جهودكم", "ندرك أهمية", "نحترم"],
    "partnership": ["نتعاون", "معاً", "بالتشارك"],
    "urgency": ["بسرعة", "دون تأخير", "بشكل عاجل"]
}

# GCC Regional Variations
GCC_REGIONAL_PHRASES = {
    "saudi": {
        "formal": "بناءً على رؤية 2030",
        "business": "نتطلع للمساهمة في تحقيق أهدافكم",
        "respect": "طال عمرك / معاليكم",
        "closing": "ودمتم برعاية الله"
    },
    "uae": {
        "formal": "تماشياً مع استراتيجية دبي الرقمية",
        "business": "نسعى لتعزيز الكفاءة التشغيلية",
        "respect": "سعادة / الأخ العزيز",
        "closing": "مع خالص التقدير"
    },
    "qatar": {
        "formal": "دعماً لرؤية قطر الوطنية",
        "business": "نهدف لتحقيق شراكة مستدامة",
        "respect": "سعادة السيد / الفاضل",
        "closing": "وتقبلوا فائق الاحترام"
    }
}

# Advanced Arabic Patterns for Humanization
ARABIC_NATURAL_PATTERNS = {
    "openers": [
        "على ضوء ما تشهده [industry] من تطور",
        "لاحظنا اهتمامكم بـ [focus]",
        "يسرني التواصل معكم لمناقشة [topic]",
        "بصفتكم رواداً في [industry]"
    ],
    "connectors": [
        "ومن ناحية أخرى",
        "علاوة على ذلك",
        "وفي هذا السياق",
        "بشكل أكثر تحديداً",
        "لا يخفى عليكم أن"
    ],
    "soft_cta": [
        "هل ترون الوقت مناسباً لنقاش قصير؟",
        "يسرنا مشاركة بعض الأفكار معكم",
        "ما رأيكم في استكشاف سبل التعاون؟"
    ]
}

def get_regional_phrase(region: str, phrase_type: str) -> str:
    """Get region-specific Arabic business phrases."""
    region_data = GCC_REGIONAL_PHRASES.get(region.lower())
    if not region_data:
        region_data = GCC_REGIONAL_PHRASES["uae"] # Default to UAE
    return region_data.get(phrase_type, "")

def get_gcc_phrase(category: str, phrase_type: str, industry: str = None) -> str:
    """Get a GCC-appropriate business phrase."""
    if category == "regional":
        return get_regional_phrase(phrase_type, industry) # industry acts as phrase_type here
    
    if category == "industry" and industry:
        terms = INDUSTRY_TERMS_ARABIC.get(industry, {})
        return terms.get(phrase_type, "")
    
    phrases = GCC_BUSINESS_PHRASES.get(category, [])
    if isinstance(phrases, list) and phrases:
        return phrases[0] # Simplistic for now
    elif isinstance(phrases, dict):
        options = phrases.get(phrase_type, [])
        return options[0] if options else ""
    return ""

def calculate_arabic_naturalness_score(text: str) -> Dict[str, Any]:
    """Calculate naturalness score for Arabic business communication."""
    if not text:
        return {"score": 0, "feedback": "Empty text"}
        
    score = 7.0
    feedback = []
    
    # 1. Detect translation artifacts (Literal English-to-Arabic)
    translation_artifacts = [
        "من قبل", # by (passive)
        "في الواقع", # in fact
        "بواسطة", # by
        "آمل أن يجدك هذا البريد جيداً", # I hope this email finds you well
        "أتطلع إلى السماع منك", # I look forward to hearing from you
    ]
    
    artifacts_found = [a for a in translation_artifacts if a in text]
    if artifacts_found:
        score -= len(artifacts_found) * 1.0
        feedback.append(f"Translation artifacts detected: {', '.join(artifacts_found)}")
        
    # 2. Check for native flow markers
    native_markers = ["إذ أن", "لا سيما", "حيثما", "بينما", "نظراً لـ"]
    markers_found = [m for m in native_markers if m in text]
    if markers_found:
        score += len(markers_found) * 0.5
        
    # 3. Check for regional respect markers
    all_respect = []
    for r in GCC_REGIONAL_PHRASES.values():
        all_respect.append(r["respect"])
    
    respect_found = any(r in text for r in all_respect) or any(r in text for r in GCC_BUSINESS_PHRASES["respect_markers"])
    if respect_found:
        score += 1.0
    else:
        score -= 0.5
        feedback.append("Missing formal respect markers for GCC audience")
        
    # 4. Sentence length variety (Arabic prefers longer, more connected sentences than English)
    sentences = re.split(r'[.؟!]', text)
    avg_len = sum(len(s.split()) for s in sentences) / len(sentences) if sentences else 0
    if avg_len < 5:
        score -= 1.0
        feedback.append("Sentences are too short/choppy for natural Arabic flow")
        
    return {
        "score": min(10.0, max(0.0, score)),
        "feedback": feedback,
        "metrics": {
            "translation_artifacts": len(artifacts_found),
            "native_markers": len(markers_found),
            "respect_marker_present": respect_found
        }
    }

def is_natural_arabic_flow(text: str) -> bool:
    """Check if text follows natural Arabic business communication patterns."""
    analysis = calculate_arabic_naturalness_score(text)
    return analysis["score"] >= 6.5