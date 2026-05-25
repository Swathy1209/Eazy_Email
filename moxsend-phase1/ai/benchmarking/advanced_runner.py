"""
Advanced benchmarking system with comprehensive model comparisons.
"""

import time
import json
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass
from ai.benchmarking.runner import BenchmarkRunner
from ai.utils.sentence_analyzer import SentenceAnalyzer
from ai.utils.evaluator import evaluate_output

@dataclass
class ModelBenchmark:
    model_name: str
    provider: str
    language: str
    evaluator_score: float
    humanization_score: float
    personalization_quality: float
    retry_frequency: float
    latency: float
    cost_estimate: float
    hallucination_rate: float
    arabic_fluency: float = None

class AdvancedBenchmarkRunner:
    def __init__(self):
        self.base_runner = BenchmarkRunner()
        self.benchmark_results: List[ModelBenchmark] = []
        self.providers = ["Groq", "Gemini", "OpenRouter", "Ollama", "Anthropic", "OpenAI"]
    
    def benchmark_model_suite(self, models: List[Dict[str, str]], leads: List[Dict]) -> Dict[str, Any]:
        """Comprehensive benchmarking of model suite across providers."""
        results = {
            "timestamp": time.time(),
            "models": {},
            "comparative_analysis": {
                "by_provider": {},
                "by_language": {"english": [], "arabic": []}
            },
            "recommendations": {}
        }
        
        for model_info in models:
            name = model_info["name"]
            provider = model_info["provider"]
            print(f"Benchmarking {name} on {provider}...")
            
            # English benchmarking
            english_results = self._benchmark_model(name, provider, "english", leads)
            results["models"][f"{name}_{provider}_english"] = english_results
            results["comparative_analysis"]["by_language"]["english"].append(english_results)
            
            # Arabic benchmarking
            arabic_results = self._benchmark_model(name, provider, "arabic", leads)
            results["models"][f"{name}_{provider}_arabic"] = arabic_results
            results["comparative_analysis"]["by_language"]["arabic"].append(arabic_results)
        
        # Generate comparative analysis
        results["comparative_analysis"]["rankings"] = self._generate_rankings(results["models"])
        results["recommendations"] = self._generate_recommendations(results["comparative_analysis"])
        
        return results
    
    def _benchmark_model(self, model: str, provider: str, language: str, leads: List[Dict]) -> Dict[str, Any]:
        """Benchmark a single model with provider-specific context."""
        start_time = time.time()
        outputs = []
        
        # Simulate or execute pipeline
        try:
            if language == "english":
                from ai.workflows.english.graph import run_english_pipeline
                outputs = run_english_pipeline(leads)
            else:
                from ai.workflows.arabic.graph import run_arabic_pipeline
                outputs = run_arabic_pipeline(leads)
                
            latency = (time.time() - start_time) / len(leads) if leads else 0
            
            # Deep Metric Calculation
            metrics = self._calculate_complex_metrics(outputs, language)
            metrics.update({
                "model": model,
                "provider": provider,
                "language": language,
                "avg_latency": latency,
                "cost_estimate": self._estimate_model_cost(model, provider, len(leads), latency),
                "total_outputs": len(outputs)
            })
            
            return metrics
            
        except Exception as e:
            return {"model": model, "provider": provider, "error": str(e), "success": False}

    def _calculate_complex_metrics(self, outputs: List[Dict], language: str) -> Dict[str, Any]:
        """Calculate multi-dimensional quality metrics."""
        eval_scores = [o.get("evaluation_result", {}).get("score", 0) for o in outputs]
        human_scores = [o.get("humanization_score", 0) for o in outputs]
        
        # Hallucination detection: Check for factual inconsistency or generic patterns
        hallucination_rate = self._detect_hallucinations(outputs)
        
        # Arabic fluency specific (if relevant)
        arabic_fluency = 0
        if language == "arabic":
            from utils.gcc_arabic_library import calculate_arabic_naturalness_score
            fluency_scores = [calculate_arabic_naturalness_score(o.get("generated_output", {}).get("content", ""))["score"] for o in outputs]
            arabic_fluency = sum(fluency_scores) / len(fluency_scores) if fluency_scores else 0
            
        return {
            "avg_evaluator_score": sum(eval_scores) / len(eval_scores) if eval_scores else 0,
            "avg_humanization_score": sum(human_scores) / len(human_scores) if human_scores else 0,
            "hallucination_rate": hallucination_rate,
            "arabic_fluency": arabic_fluency,
            "formatting_consistency": self._check_formatting_consistency(outputs),
            "success": True
        }

    def _detect_hallucinations(self, outputs: List[Dict]) -> float:
        """Robust hallucination detection logic."""
        count = 0
        for o in outputs:
            content = o.get("generated_output", {}).get("content", "").lower()
            # Signs of hallucination: contradicting input tags or making up facts
            if "i am an ai" in content or "as an artificial intelligence" in content:
                count += 1
            elif "not provided" in content or "fill in the blank" in content:
                count += 1
            # Check if common placeholders are left in
            elif "{{" in content and "}}" in content:
                count += 0.5
        return count / len(outputs) if outputs else 0

    def _estimate_model_cost(self, model: str, provider: str, count: int, latency: float) -> float:
        """Provider-aware cost estimation."""
        rates = {
            "openai": 0.01,
            "anthropic": 0.015,
            "groq": 0.0001,
            "gemini": 0.0005,
            "openrouter": 0.001,
            "ollama": 0.0 # Local
        }
        return rates.get(provider.lower(), 0.005) * count

    def _generate_rankings(self, model_results: Dict[str, Dict]) -> Dict[str, List]:
        """Generate rankings across multiple dimensions."""
        rankings = {
            "quality": [],
            "humanization": [],
            "arabic": [],
            "latency": [],
            "cost_efficiency": []
        }
        
        valid_results = [r for r in model_results.values() if r.get("success")]
        
        rankings["quality"] = sorted(valid_results, key=lambda x: x["avg_evaluator_score"], reverse=True)
        rankings["humanization"] = sorted(valid_results, key=lambda x: x["avg_humanization_score"], reverse=True)
        rankings["arabic"] = sorted([r for r in valid_results if r["language"] == "arabic"], key=lambda x: x["arabic_fluency"], reverse=True)
        rankings["latency"] = sorted(valid_results, key=lambda x: x["avg_latency"])
        
        return rankings

    def generate_benchmark_summary(self, results: Dict[str, Any]) -> str:
        """Generate markdown summary of benchmarks."""
        rankings = results["comparative_analysis"]["rankings"]
        
        summary = "# Moxsend Model Benchmark Summary\n\n"
        
        summary += "## 🏆 Top Performers (Quality)\n"
        for i, r in enumerate(rankings["quality"][:3], 1):
            summary += f"{i}. **{r['model']}** ({r['provider']}): Score {r['avg_evaluator_score']:.2f}\n"
            
        summary += "\n## 🎨 Humanization Leaderboard\n"
        for i, r in enumerate(rankings["humanization"][:3], 1):
            summary += f"{i}. **{r['model']}**: {r['avg_humanization_score']:.2f}/10\n"
            
        summary += "\n## 🌍 Arabic Intelligence (GCC)\n"
        for i, r in enumerate(rankings["arabic"][:3], 1):
            summary += f"{i}. **{r['model']}**: Fluency {r['arabic_fluency']:.2f}/10\n"
            
        return summary

    
    def _estimate_model_cost(self, model: str, lead_count: int, latency_per_lead: float) -> float:
        """Estimate cost for model execution."""
        # Pricing estimates (simplified)
        model_costs = {
            "gpt-4": 0.03,
            "gpt-3.5": 0.002,
            "claude": 0.015,
            "gemini": 0.001,
            "qwen": 0.0005,
            "mistral": 0.0005,
            "groq": 0.0008,
            "openrouter": 0.001
        }
        
        base_cost = model_costs.get(model.lower(), 0.005)
        total_cost = base_cost * lead_count
        
        # Add latency overhead for slower models
        if latency_per_lead > 2.0:
            total_cost *= 1.1
        
        return total_cost
    
    def _detect_hallucinations(self, outputs: List[Dict]) -> float:
        """Detect hallucination rate in outputs."""
        hallucination_count = 0
        
        for output in outputs:
            content = output.get("generated_output", {}).get("content", "")
            
            # Simple heuristics for hallucination detection
            if len(content) > 100:  # Overly long
                hallucination_count += 0.3
            
            if "error" in content.lower() or "sorry" in content.lower():
                hallucination_count += 0.3
            
            if content.count("I") > 3:  # First person pronoun overuse
                hallucination_count += 0.2
        
        return min(1.0, hallucination_count / len(outputs)) if outputs else 0
    
    def _check_formatting_consistency(self, outputs: List[Dict]) -> float:
        """Check formatting consistency across outputs."""
        if not outputs:
            return 0
        
        consistent_count = 0
        
        for output in outputs:
            content = output.get("generated_output", {}).get("content", "")
            
            # Check for consistent formatting
            if content and content[0].isupper() and content[-1] in '.!?':
                consistent_count += 1
        
        return consistent_count / len(outputs)
    
    def _generate_comparative_analysis(self, model_results: Dict[str, Dict]) -> Dict[str, Any]:
        """Generate comparative analysis across models."""
        analysis = {
            "model_rankings": {},
            "best_performers": {},
            "worst_performers": {}
        }
        
        # Rank by overall quality score
        model_scores = {}
        
        for model_key, result in model_results.items():
            if result.get("success"):
                metrics = result.get("metrics", {})
                
                # Calculate weighted score
                overall_score = (
                    metrics.get("avg_evaluator_score", 0) * 0.4 +
                    metrics.get("avg_humanization_score", 0) * 0.3 +
                    metrics.get("avg_personalization_score", 0) * 0.2 +
                    (10 - metrics.get("avg_retry_frequency", 0) * 2) * 0.1
                )
                
                model_scores[model_key] = {
                    "score": overall_score,
                    "metrics": metrics
                }
        
        # Sort and identify best/worst
        sorted_models = sorted(model_scores.items(), key=lambda x: x[1]["score"], reverse=True)
        
        analysis["model_rankings"] = {
            rank: (model, score["score"]) 
            for rank, (model, score) in enumerate(sorted_models, 1)
        }
        
        if sorted_models:
            analysis["best_performers"] = {
                "model": sorted_models[0][0],
                "score": sorted_models[0][1]["score"],
                "metrics": sorted_models[0][1]["metrics"]
            }
            
            analysis["worst_performers"] = {
                "model": sorted_models[-1][0],
                "score": sorted_models[-1][1]["score"],
                "metrics": sorted_models[-1][1]["metrics"]
            }
        
        return analysis
    
    def _generate_recommendations(self, analysis: Dict[str, Any]) -> Dict[str, str]:
        """Generate recommendations based on benchmark results."""
        recommendations = {}
        
        best = analysis.get("best_performers", {})
        worst = analysis.get("worst_performers", {})
        
        if best:
            recommendations["primary_model"] = f"Use {best['model']} for production (score: {best['score']:.2f})"
        
        if worst:
            recommendations["avoid_model"] = f"Avoid {worst['model']} due to low scores (score: {worst['score']:.2f})"
        
        # Cost recommendations
        cost_leader = min(
            analysis.get("model_rankings", {}).values(),
            key=lambda x: x[1].get("metrics", {}).get("cost_estimate", float("inf")),
            default=None
        )
        
        if cost_leader:
            recommendations["cost_optimization"] = "Consider cost-optimized models for high-volume processing"
        
        # Speed recommendations
        speed_leader = max(
            analysis.get("model_rankings", {}).values(),
            key=lambda x: 1 / x[1].get("metrics", {}).get("avg_latency_per_lead", 1),
            default=None
        )
        
        if speed_leader:
            recommendations["latency_optimization"] = "Use low-latency models for real-time requirements"
        
        return recommendations
    
    def export_benchmark_report(self, results: Dict[str, Any], filename: str = None) -> str:
        """Export comprehensive benchmark report."""
        report = "# Advanced Benchmark Report\n\n"
        
        report += "## Model Rankings\n"
        for rank, (model, score) in results.get("comparative_analysis", {}).get("model_rankings", {}).items():
            report += f"{rank}. **{model}**: {score:.2f}/10\n"
        
        report += "\n## Best Performers\n"
        best = results.get("comparative_analysis", {}).get("best_performers", {})
        if best:
            report += f"- Model: {best['model']}\n"
            report += f"- Score: {best['score']:.2f}\n"
            metrics = best.get("metrics", {})
            report += f"- Evaluator Score: {metrics.get('avg_evaluator_score', 0):.2f}\n"
            report += f"- Humanization: {metrics.get('avg_humanization_score', 0):.2f}\n"
            report += f"- Cost: ${metrics.get('cost_estimate', 0):.2f}\n"
        
        report += "\n## Recommendations\n"
        for key, rec in results.get("recommendations", {}).items():
            report += f"- {rec}\n"
        
        if filename:
            with open(filename, 'w') as f:
                f.write(report)
        
        return report