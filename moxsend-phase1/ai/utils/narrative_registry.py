"""
Narrative Registry for dynamic story selection.
"""

NARRATIVE_REGISTRY = {
    "revenue_leakage": {
        "description": "Focus on financial losses and missed revenue opportunities",
        "industries": ["finance", "retail", "healthcare", "manufacturing"],
        "emotional_strategy": "professional concern",
        "business_focus": "cost optimization"
    },
    "operational_overload": {
        "description": "Address staff burnout and process inefficiencies",
        "industries": ["healthcare", "logistics", "customer_service"],
        "emotional_strategy": "empathy",
        "business_focus": "efficiency improvement"
    },
    "approval_bottlenecks": {
        "description": "Streamline decision-making and approval processes",
        "industries": ["corporate", "finance", "legal"],
        "emotional_strategy": "frustration relief",
        "business_focus": "process acceleration"
    },
    "scaling_inefficiency": {
        "description": "Support business growth with scalable solutions",
        "industries": ["tech", "startups", "manufacturing"],
        "emotional_strategy": "growth optimism",
        "business_focus": "expansion support"
    },
    "hiring_pressure": {
        "description": "Address recruitment challenges and talent gaps",
        "industries": ["hr", "tech", "healthcare"],
        "emotional_strategy": "strategic urgency",
        "business_focus": "talent acquisition"
    },
    "patient_dissatisfaction": {
        "description": "Improve patient experience and satisfaction",
        "industries": ["healthcare", "clinics"],
        "emotional_strategy": "care concern",
        "business_focus": "patient retention"
    },
    "missed_opportunities": {
        "description": "Capture untapped market potential",
        "industries": ["sales", "marketing", "business_development"],
        "emotional_strategy": "opportunity focus",
        "business_focus": "market expansion"
    },
    "workflow_delays": {
        "description": "Reduce processing times and bottlenecks",
        "industries": ["operations", "logistics", "admin"],
        "emotional_strategy": "efficiency drive",
        "business_focus": "speed optimization"
    },
    "customer_experience_gaps": {
        "description": "Enhance customer satisfaction and loyalty",
        "industries": ["retail", "hospitality", "services"],
        "emotional_strategy": "service excellence",
        "business_focus": "customer retention"
    }
}

def select_narrative(personalization_context: dict, language: str) -> dict:
    """
    Select appropriate narrative based on personalization context.
    """
    industry = personalization_context.get('industry', '').lower()
    pain_points = personalization_context.get('pain_points', [])
    
    # Simple matching logic
    candidates = []
    for key, narrative in NARRATIVE_REGISTRY.items():
        if industry in narrative['industries']:
            candidates.append(key)
        for pain in pain_points:
            if pain.lower() in key.replace('_', ' '):
                candidates.append(key)
    
    # Fallback to general narratives
    if not candidates:
        candidates = ["operational_overload", "revenue_leakage", "workflow_delays"]
    
    primary = candidates[0] if candidates else "operational_overload"
    secondary = candidates[1] if len(candidates) > 1 else None
    
    narrative_data = NARRATIVE_REGISTRY[primary]
    
    return {
        "primary_narrative": primary,
        "secondary_narrative": secondary,
        "emotional_strategy": narrative_data["emotional_strategy"],
        "business_focus": narrative_data["business_focus"]
    }