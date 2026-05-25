"""
Human review and feedback loop system for quality improvement.
"""

from enum import Enum
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
import json
import time

class OutputStatus(Enum):
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_REVISION = "needs_revision"

class FeedbackType(Enum):
    AI_LIKE = "sounds_too_ai_like"
    WEAK_PERSONALIZATION = "weak_personalization"
    TONE_MISMATCH = "tone_mismatch"
    NARRATIVE_MISALIGN = "narrative_misalignment"
    CLARITY_ISSUE = "clarity_issue"
    LANGUAGE_ERROR = "language_error"
    CULTURAL_CONCERN = "cultural_concern"
    GENERIC = "too_generic"
    OTHER = "other"

@dataclass
class HumanReview:
    output_id: str
    evaluator_score: float
    human_score: float
    status: OutputStatus
    feedback_type: List[FeedbackType]
    comments: str
    suggested_improvement: Optional[str] = None
    reviewer_id: str = "human_reviewer"
    timestamp: float = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = time.time()

class FeedbackStore:
    def __init__(self):
        self.reviews: List[HumanReview] = []
        self.approved_outputs: List[Dict[str, Any]] = []
        self.rejected_outputs: List[Dict[str, Any]] = []
        self.edited_outputs: List[Dict[str, Any]] = []
    
    def add_review(self, review: HumanReview):
        """Store a human review."""
        self.reviews.append(review)
        
        # Also store in categorized lists
        if review.status == OutputStatus.APPROVED:
            self.approved_outputs.append(asdict(review))
        elif review.status == OutputStatus.REJECTED:
            self.rejected_outputs.append(asdict(review))
        elif review.status == OutputStatus.NEEDS_REVISION:
            self.edited_outputs.append(asdict(review))
    
    def get_evaluator_disagreements(self) -> List[Dict[str, Any]]:
        """Find cases where evaluator and human disagree significantly."""
        disagreements = []
        
        for review in self.reviews:
            difference = abs(review.evaluator_score - review.human_score)
            if difference > 2.0:
                disagreements.append({
                    "output_id": review.output_id,
                    "evaluator_score": review.evaluator_score,
                    "human_score": review.human_score,
                    "difference": difference,
                    "direction": "over_scored" if review.evaluator_score > review.human_score else "under_scored",
                    "feedback": [f.value for f in review.feedback_type],
                    "comments": review.comments
                })
        
        return disagreements
    
    def get_common_failures(self) -> Dict[str, Any]:
        """Identify common failure patterns."""
        failure_patterns = {}
        
        for review in self.reviews:
            if review.status in [OutputStatus.REJECTED, OutputStatus.NEEDS_REVISION]:
                for feedback in review.feedback_type:
                    feedback_type = feedback.value
                    if feedback_type not in failure_patterns:
                        failure_patterns[feedback_type] = {
                            "count": 0,
                            "examples": []
                        }
                    
                    failure_patterns[feedback_type]["count"] += 1
                    failure_patterns[feedback_type]["examples"].append({
                        "output_id": review.output_id,
                        "comments": review.comments[:100]
                    })
        
        return failure_patterns
    
    def generate_feedback_analytics(self) -> Dict[str, Any]:
        """Generate analytics on feedback patterns."""
        analytics = {
            "total_reviews": len(self.reviews),
            "approval_rate": sum(1 for r in self.reviews if r.status == OutputStatus.APPROVED) / max(1, len(self.reviews)),
            "rejection_rate": sum(1 for r in self.reviews if r.status == OutputStatus.REJECTED) / max(1, len(self.reviews)),
            "revision_rate": sum(1 for r in self.reviews if r.status == OutputStatus.NEEDS_REVISION) / max(1, len(self.reviews)),
            "feedback_frequency": {},
            "disagreement_count": len(self.get_evaluator_disagreements()),
            "common_failures": self.get_common_failures()
        }
        
        # Count feedback types
        for feedback_type in FeedbackType:
            count = sum(1 for r in self.reviews if feedback_type in r.feedback_type)
            if count > 0:
                analytics["feedback_frequency"][feedback_type.value] = count
        
        return analytics
    
    def export_for_fine_tuning(self) -> Dict[str, Any]:
        """Export feedback data for potential fine-tuning."""
        fine_tuning_data = {
            "approved_examples": [],
            "rejected_examples": [],
            "improvement_pairs": []
        }
        
        for review in self.reviews:
            example = {
                "output_id": review.output_id,
                "score": review.human_score,
                "feedback": [f.value for f in review.feedback_type],
                "timestamp": review.timestamp
            }
            
            if review.status == OutputStatus.APPROVED:
                fine_tuning_data["approved_examples"].append(example)
            elif review.status == OutputStatus.REJECTED:
                fine_tuning_data["rejected_examples"].append(example)
            
            if review.suggested_improvement:
                fine_tuning_data["improvement_pairs"].append({
                    "original_id": review.output_id,
                    "suggestion": review.suggested_improvement,
                    "reasoning": review.comments
                })
        
        return fine_tuning_data

class QualityDashboard:
    """Real-time quality metrics dashboard."""
    
    def __init__(self, feedback_store: FeedbackStore):
        self.feedback_store = feedback_store
    
    def get_dashboard_metrics(self) -> Dict[str, Any]:
        """Get current dashboard metrics."""
        analytics = self.feedback_store.generate_feedback_analytics()
        
        metrics = {
            "summary": {
                "total_reviews": analytics["total_reviews"],
                "approval_rate": analytics["approval_rate"],
                "quality_trend": self._calculate_quality_trend()
            },
            "top_issues": self._get_top_issues(5),
            "evaluator_performance": self._calculate_evaluator_performance(),
            "feedback_distribution": analytics["feedback_frequency"]
        }
        
        return metrics
    
    def _calculate_quality_trend(self) -> str:
        """Determine if quality is improving or declining."""
        recent_reviews = self.feedback_store.reviews[-20:]
        
        if len(recent_reviews) < 10:
            return "insufficient_data"
        
        early_scores = [r.human_score for r in recent_reviews[:10]]
        recent_scores = [r.human_score for r in recent_reviews[10:]]
        
        early_avg = sum(early_scores) / len(early_scores)
        recent_avg = sum(recent_scores) / len(recent_scores)
        
        if recent_avg > early_avg + 0.5:
            return "improving"
        elif recent_avg < early_avg - 0.5:
            return "declining"
        else:
            return "stable"
    
    def _get_top_issues(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Get top feedback issues."""
        common_failures = self.feedback_store.get_common_failures()
        
        sorted_failures = sorted(
            common_failures.items(),
            key=lambda x: x[1]["count"],
            reverse=True
        )
        
        return [
            {
                "issue": issue_type,
                "count": data["count"],
                "percentage": (data["count"] / len(self.feedback_store.reviews) * 100)
                if self.feedback_store.reviews else 0
            }
            for issue_type, data in sorted_failures[:limit]
        ]
    
    def _calculate_evaluator_performance(self) -> Dict[str, Any]:
        """Calculate evaluator's accuracy vs human reviews."""
        disagreements = self.feedback_store.get_evaluator_disagreements()
        
        if not self.feedback_store.reviews:
            return {"agreement_rate": 0, "accuracy": 0}
        
        accurate_predictions = len(self.feedback_store.reviews) - len(disagreements)
        accuracy = accurate_predictions / len(self.feedback_store.reviews)
        
        return {
            "total_predictions": len(self.feedback_store.reviews),
            "agreements": accurate_predictions,
            "disagreements": len(disagreements),
            "accuracy": accuracy,
            "avg_disagreement_magnitude": (
                sum(d["difference"] for d in disagreements) / len(disagreements)
                if disagreements else 0
            )
        }
    
    def generate_dashboard_report(self) -> str:
        """Generate text-based dashboard report."""
        metrics = self.get_dashboard_metrics()
        
        report = """
╔═══════════════════════════════════════════╗
║         Quality Dashboard Report          ║
╚═══════════════════════════════════════════╝

📊 Summary
──────────
Total Reviews: {total}
Approval Rate: {approval:.1%}
Quality Trend: {trend}

⚠️  Top Issues
──────────────
""".format(
            total=metrics["summary"]["total_reviews"],
            approval=metrics["summary"]["approval_rate"],
            trend=metrics["summary"]["quality_trend"]
        )
        
        for i, issue in enumerate(metrics["top_issues"], 1):
            report += f"{i}. {issue['issue']}: {issue['count']} ({issue['percentage']:.1f}%)\n"
        
        evaluator = metrics["evaluator_performance"]
        report += f"""

🤖 Evaluator Performance
──────────────────────────
Accuracy: {evaluator['accuracy']:.1%}
Agreements: {evaluator['agreements']}/{evaluator['total_predictions']}
Disagreements: {evaluator['disagreements']}
Avg Disagreement: {evaluator['avg_disagreement_magnitude']:.2f} points
"""
        
        return report