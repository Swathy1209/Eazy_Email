"""
Benchmark datasets for testing subject line generation.
"""

# Sample leads for benchmarking
BENCHMARK_LEADS = [
    {
        "id": "lead_001",
        "firstname": "Ahmed",
        "lastname": "Al-Rashid",
        "company": "Dubai General Hospital",
        "designation": "Operations Manager",
        "industry": "Healthcare",
        "company_size": "500-1000",
        "city": "Dubai",
        "country": "UAE",
        "lead_type": "enterprise",
        "source": "website"
    },
    {
        "id": "lead_002",
        "firstname": "Sarah",
        "lastname": "Johnson",
        "company": "TechCorp Solutions",
        "designation": "CTO",
        "industry": "Technology",
        "company_size": "50-200",
        "city": "London",
        "country": "UK",
        "lead_type": "mid_market",
        "source": "linkedin"
    },
    {
        "id": "lead_003",
        "firstname": "Maria",
        "lastname": "Rodriguez",
        "company": "Global Logistics Ltd",
        "designation": "Supply Chain Director",
        "industry": "Logistics",
        "company_size": "200-500",
        "city": "Madrid",
        "country": "Spain",
        "lead_type": "enterprise",
        "source": "referral"
    },
    {
        "id": "lead_004",
        "firstname": "Fatima",
        "lastname": "Al-Zahra",
        "company": "Riyadh Medical Center",
        "designation": "Patient Services Manager",
        "industry": "Healthcare",
        "company_size": "100-500",
        "city": "Riyadh",
        "country": "Saudi Arabia",
        "lead_type": "mid_market",
        "source": "conference"
    },
    {
        "id": "lead_005",
        "firstname": "James",
        "lastname": "Wilson",
        "company": "Wilson Manufacturing",
        "designation": "CEO",
        "industry": "Manufacturing",
        "company_size": "1000+",
        "city": "Manchester",
        "country": "UK",
        "lead_type": "enterprise",
        "source": "cold_outreach"
    }
]

# Expected quality criteria for evaluation
QUALITY_CRITERIA = {
    "personalization": {
        "weight": 0.25,
        "description": "How well the subject line reflects lead-specific context"
    },
    "tone_quality": {
        "weight": 0.20,
        "description": "Appropriateness of tone for business communication"
    },
    "naturalness": {
        "weight": 0.20,
        "description": "How human-like and natural the language feels"
    },
    "business_relevance": {
        "weight": 0.15,
        "description": "Relevance to business objectives and pain points"
    },
    "clarity": {
        "weight": 0.10,
        "description": "Clear and understandable messaging"
    },
    "formatting": {
        "weight": 0.10,
        "description": "Proper formatting and grammar"
    }
}