"""
Evaluator calibration and reliability framework.
"""

from typing import Dict, List, Any, Tuple
from dataclasses import dataclass
import json
import statistics

@dataclass
class EvaluatorCalibrationResult:
    evaluator_score: float
    human_score: float
    agreement: float
    confidence: float
    discrepancy_type: str
    normalization_factor: float

class EvaluatorCalibration:
    def __init__(self):
        self.calibration_data: List[Dict[str, Any]] = []
        self.consistency_metrics: Dict[str, Any] = {}
        self.confidence_weights = {
            "agreement_history": 0.4,
            "score_variance": 0.3,
            "sample_size": 0.3
        }
    
    def calculate_confidence(self, evaluator_score: float, metadata: Dict[str, Any] = None) -> float:
        """Calculate confidence in a specific evaluation result."""
        if not self.calibration_data:
            return 0.5 # Default neutral confidence
            
        metrics = self.calculate_calibration_metrics()
        base_confidence = metrics.get("agreement_rate", 0.5)
        
        # Adjust based on score proximity to historical bias
        bias = metrics.get("bias", 0)
        expected_error = abs(bias)
        
        # If the evaluator is typically biased, confidence in raw score is lower
        score_confidence = 1.0 - (min(1.0, expected_error / 5.0))
        
        return (base_confidence * 0.7) + (score_confidence * 0.3)

    def normalize_score(self, score: float) -> float:
        """Normalize evaluator score based on detected bias."""
        metrics = self.calculate_calibration_metrics()
        bias = metrics.get("bias", 0)
        
        # Apply normalization to counteract systemic over/under scoring
        normalized = score - (bias * 0.8) # 80% correction factor
        return min(10.0, max(0.0, normalized))

    def add_calibration_sample(self, output: Dict[str, Any], evaluator_score: float, 
                               human_score: float, metadata: Dict[str, Any] = None):
        """Add a sample for calibration analysis with deterministic tracking."""
        sample = {
            "output_id": metadata.get("id") if metadata else "unknown",
            "evaluator_score": evaluator_score,
            "human_score": human_score,
            "difference": abs(evaluator_score - human_score),
            "agreement": 1 - (abs(evaluator_score - human_score) / 10),
            "timestamp": metadata.get("timestamp") if metadata else None,
            "category": metadata.get("category") if metadata else "general"
        }
        self.calibration_data.append(sample)
    
    def calculate_calibration_metrics(self) -> Dict[str, Any]:
        """Calculate deep evaluator calibration metrics."""
        if not self.calibration_data:
            return {"reliability_score": 0, "bias": 0, "agreement_rate": 0}
        
        evaluator_scores = [s["evaluator_score"] for s in self.calibration_data]
        human_scores = [s["human_score"] for s in self.calibration_data]
        agreements = [s["agreement"] for s in self.calibration_data]
        differences = [s["difference"] for s in self.calibration_data]
        
        agreement_rate = sum(1 for a in agreements if a >= 0.8) / len(agreements)
        
        evaluator_mean = statistics.mean(evaluator_scores)
        human_mean = statistics.mean(human_scores)
        bias = evaluator_mean - human_mean
        
        consistency_std = statistics.stdev(differences) if len(differences) > 1 else 0
        
        return {
            "total_samples": len(self.calibration_data),
            "agreement_rate": agreement_rate,
            "average_agreement": statistics.mean(agreements),
            "bias": bias,
            "consistency_std": consistency_std,
            "reliability_score": min(10.0, agreement_rate * 10),
            "variance": statistics.variance(evaluator_scores) if len(evaluator_scores) > 1 else 0
        }

    def generate_calibration_report(self) -> Dict[str, Any]:
        """Generate a structured calibration report for the dashboard."""
        metrics = self.calculate_calibration_metrics()
        disagreements = self.analyze_disagreements()
        
        return {
            "summary": metrics,
            "status": "stable" if metrics["consistency_std"] < 1.5 else "unstable",
            "recommended_adjustments": {
                "normalization_offset": -metrics["bias"],
                "confidence_multiplier": metrics["agreement_rate"]
            },
            "failure_clusters": self._cluster_failures(disagreements)
        }

    def _cluster_failures(self, disagreements: List[Dict[str, Any]]) -> Dict[str, int]:
        """Identify common failure patterns in evaluation."""
        clusters = {}
        for d in disagreements:
            category = d.get("metadata", {}).get("category", "unknown")
            clusters[category] = clusters.get(category, 0) + 1
        return clusters

    
    def export_calibration_report(self, filename: str = None) -> str:
        """Generate calibration report."""
        metrics = self.calculate_calibration_metrics()
        disagreements = self.analyze_disagreements()
        
        report = f"""# Evaluator Calibration Report

## Overall Metrics
- Total Samples: {metrics.get('total_samples', 0)}
- Agreement Rate: {metrics.get('agreement_rate', 0):.1%}
- Average Agreement: {metrics.get('average_agreement', 0):.2f}/1.0
- Average Difference: {metrics.get('average_difference', 0):.2f} points
- Reliability Score: {metrics.get('reliability_score', 0):.1f}/10.0

## Bias Analysis
- Evaluator Mean: {metrics.get('evaluator_mean_score', 0):.2f}
- Human Mean: {metrics.get('human_mean_score', 0):.2f}
- Bias: {metrics.get('bias', 0):+.2f}
- Over-scoring Rate: {metrics.get('over_scoring_rate', 0):.1%}
- Under-scoring Rate: {metrics.get('under_scoring_rate', 0):.1%}

## Consistency
- Standard Deviation: {metrics.get('consistency_std', 0):.2f}
- Max Difference: {metrics.get('max_difference', 0):.2f}
- Min Difference: {metrics.get('min_difference', 0):.2f}

## Major Disagreements (>2 point difference)
Count: {len(disagreements)}

"""
        
        for i, disagreement in enumerate(disagreements[:5], 1):
            report += f"""
### Disagreement {i}
- Direction: {disagreement['direction']}
- Evaluator: {disagreement['evaluator_score']}, Human: {disagreement['human_score']}
- Difference: {disagreement['difference']:.1f} points
- Output: "{disagreement['output_preview']}..."
"""
        
        if filename:
            with open(filename, 'w') as f:
                f.write(report)
        
        return report

class EvaluatorRegressionTests:
    """Test evaluator consistency over time."""
    
    def __init__(self):
        self.historical_scores: Dict[str, List[float]] = {}
    
    def add_score(self, test_case_id: str, score: float):
        """Add a score for a test case."""
        if test_case_id not in self.historical_scores:
            self.historical_scores[test_case_id] = []
        self.historical_scores[test_case_id].append(score)
    
    def detect_regression(self, test_case_id: str, threshold: float = 1.0) -> Tuple[bool, str]:
        """Detect if evaluator has regressed on a specific test case."""
        scores = self.historical_scores.get(test_case_id, [])
        
        if len(scores) < 2:
            return False, "Not enough historical data"
        
        initial_score = scores[0]
        current_score = scores[-1]
        
        if abs(current_score - initial_score) > threshold:
            direction = "improved" if current_score > initial_score else "regressed"
            return True, f"Score {direction}: {initial_score:.2f} → {current_score:.2f}"
        
        return False, f"No significant change: {initial_score:.2f} vs {current_score:.2f}"
    
    def generate_regression_report(self) -> str:
        """Generate regression test report."""
        report = "# Evaluator Regression Test Report\n\n"
        
        for test_case_id, scores in self.historical_scores.items():
            if len(scores) < 2:
                continue
            
            initial = scores[0]
            current = scores[-1]
            regression_detected, message = self.detect_regression(test_case_id)
            
            status = "⚠️ REGRESSION" if regression_detected else "✓ STABLE"
            report += f"## {test_case_id}: {status}\n"
            report += f"- {message}\n"
            report += f"- Score history: {', '.join(f'{s:.2f}' for s in scores)}\n"
            report += f"- Variance: {statistics.variance(scores) if len(scores) > 1 else 0:.3f}\n\n"
        
        return report