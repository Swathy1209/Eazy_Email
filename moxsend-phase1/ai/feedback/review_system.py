"""
Human Review and Feedback System for AI Quality.
Stores human assessments to tune evaluators and models.
"""
import json
import os
import time
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict

@dataclass
class HumanFeedback:
    output_id: str
    lead_id: str
    reviewer_id: str
    timestamp: float
    approved: bool
    quality_score: float # 0-10
    humanization_score: float # 0-10
    arabic_score: Optional[float] = None
    edited_content: Optional[str] = None
    rejection_reason: Optional[str] = None
    evaluator_agreement: bool = True
    comments: str = ""

class ReviewSystem:
    def __init__(self, storage_path: str = "ai/feedback/data/"):
        self.storage_path = storage_path
        os.makedirs(storage_path, exist_ok=True)
        self.feedback_file = os.path.join(storage_path, "human_feedback.jsonl")
        
    def submit_feedback(self, feedback: HumanFeedback):
        """Submit human feedback to storage."""
        with open(self.feedback_file, 'a') as f:
            f.write(json.dumps(asdict(feedback)) + "\n")
            
    def get_evaluator_disagreements(self) -> List[Dict[str, Any]]:
        """Identify cases where human and evaluator disagree."""
        disagreements = []
        if not os.path.exists(self.feedback_file):
            return []
            
        with open(self.feedback_file, 'r') as f:
            for line in f:
                data = json.loads(line)
                if not data.get("evaluator_agreement"):
                    disagreements.append(data)
        return disagreements

    def generate_quality_analytics(self) -> Dict[str, Any]:
        """Generate analytics from human feedback."""
        feedbacks = []
        if os.path.exists(self.feedback_file):
            with open(self.feedback_file, 'r') as f:
                for line in f:
                    feedbacks.append(json.loads(line))
        
        if not feedbacks:
            return {"status": "no_data"}
            
        total = len(feedbacks)
        approved = sum(1 for f in feedbacks if f["approved"])
        avg_score = sum(f["quality_score"] for f in feedbacks) / total
        avg_humanization = sum(f["humanization_score"] for f in feedbacks) / total
        
        # Analyze failure patterns
        failure_patterns = {}
        for f in feedbacks:
            if not f["approved"] and f["rejection_reason"]:
                reason = f["rejection_reason"]
                failure_patterns[reason] = failure_patterns.get(reason, 0) + 1
                
        return {
            "total_reviews": total,
            "approval_rate": approved / total,
            "avg_quality_score": avg_score,
            "avg_humanization_score": avg_humanization,
            "common_failure_patterns": failure_patterns,
            "evaluator_agreement_rate": sum(1 for f in feedbacks if f["evaluator_agreement"]) / total
        }

    def get_rewrite_training_data(self) -> List[Dict[str, str]]:
        """Export pairs of (original, human_edited) for future tuning."""
        pairs = []
        if not os.path.exists(self.feedback_file):
            return []
            
        with open(self.feedback_file, 'r') as f:
            for line in f:
                data = json.loads(line)
                if data.get("edited_content"):
                    pairs.append({
                        "original": "TODO: Link to original output", # Need to join with outputs
                        "edited": data["edited_content"]
                    })
        return pairs
