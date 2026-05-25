"""
Benchmark runner for comparing model performance.
"""

import time
import json
from typing import Dict, List, Any
from dataclasses import dataclass
from ai.providers.model_router import ModelRouter
from ai.workflows.english.graph import run_english_pipeline
from ai.workflows.arabic.graph import run_arabic_pipeline
from ai.benchmarking.datasets import BENCHMARK_LEADS, QUALITY_CRITERIA
from ai.utils.evaluator import evaluate_output

@dataclass
class BenchmarkResult:
    model: str
    language: str
    lead_id: str
    latency: float
    output: Dict[str, Any]
    evaluation: Dict[str, Any]
    retry_count: int
    cost_estimate: float

class BenchmarkRunner:
    def __init__(self):
        self.results: List[BenchmarkResult] = []
    
    def run_model_benchmark(self, model_name: str, language: str, leads: List[Dict]) -> List[BenchmarkResult]:
        """Run benchmark for a specific model and language."""
        results = []
        
        for lead in leads:
            start_time = time.time()
            
            try:
                if language == "english":
                    outputs = run_english_pipeline([lead])
                else:
                    outputs = run_arabic_pipeline([lead])
                
                latency = time.time() - start_time
                output = outputs[0] if outputs else {}
                
                # Evaluate output
                evaluation = evaluate_output(output.get('generated_output', {}), language)
                
                # Estimate cost (placeholder)
                cost_estimate = self._estimate_cost(model_name, latency)
                
                result = BenchmarkResult(
                    model=model_name,
                    language=language,
                    lead_id=lead['id'],
                    latency=latency,
                    output=output,
                    evaluation=evaluation,
                    retry_count=output.get('retry_count', 0),
                    cost_estimate=cost_estimate
                )
                results.append(result)
                
            except Exception as e:
                # Handle failures
                result = BenchmarkResult(
                    model=model_name,
                    language=language,
                    lead_id=lead['id'],
                    latency=time.time() - start_time,
                    output={"error": str(e)},
                    evaluation={"approved": False, "score": 0.0, "issues": [str(e)]},
                    retry_count=0,
                    cost_estimate=0.0
                )
                results.append(result)
        
        return results
    
    def run_comprehensive_benchmark(self, models: List[str], languages: List[str]) -> Dict[str, Any]:
        """Run full benchmark across models and languages."""
        all_results = []
        
        for model in models:
            for language in languages:
                print(f"Benchmarking {model} on {language}...")
                results = self.run_model_benchmark(model, language, BENCHMARK_LEADS)
                all_results.extend(results)
        
        # Generate summary
        summary = self._generate_summary(all_results)
        
        return {
            "results": [r.__dict__ for r in all_results],
            "summary": summary
        }
    
    def _estimate_cost(self, model: str, latency: float) -> float:
        """Placeholder cost estimation."""
        # In real implementation, use actual pricing
        base_costs = {
            "gpt-4": 0.03,
            "gpt-3.5": 0.002,
            "claude": 0.015,
            "gemini": 0.001,
            "qwen": 0.001,
            "mistral": 0.001
        }
        return base_costs.get(model, 0.01) * (latency / 60)  # per minute estimate
    
    def _generate_summary(self, results: List[BenchmarkResult]) -> Dict[str, Any]:
        """Generate benchmark summary statistics."""
        summary = {
            "total_runs": len(results),
            "models_tested": list(set(r.model for r in results)),
            "languages_tested": list(set(r.language for r in results)),
            "average_scores": {},
            "latency_stats": {},
            "retry_stats": {},
            "cost_stats": {},
            "quality_breakdown": {}
        }
        
        # Group by model
        model_groups = {}
        for r in results:
            if r.model not in model_groups:
                model_groups[r.model] = []
            model_groups[r.model].append(r)
        
        for model, model_results in model_groups.items():
            scores = [r.evaluation.get('score', 0) for r in model_results]
            latencies = [r.latency for r in model_results]
            retries = [r.retry_count for r in model_results]
            costs = [r.cost_estimate for r in model_results]
            
            summary["average_scores"][model] = sum(scores) / len(scores) if scores else 0
            summary["latency_stats"][model] = {
                "avg": sum(latencies) / len(latencies),
                "min": min(latencies),
                "max": max(latencies)
            }
            summary["retry_stats"][model] = {
                "avg": sum(retries) / len(retries),
                "total": sum(retries)
            }
            summary["cost_stats"][model] = {
                "avg": sum(costs) / len(costs),
                "total": sum(costs)
            }
        
        return summary

def save_benchmark_report(results: Dict[str, Any], filename: str):
    """Save benchmark results to JSON file."""
    with open(filename, 'w') as f:
        json.dump(results, f, indent=2, default=str)

def generate_markdown_report(results: Dict[str, Any]) -> str:
    """Generate markdown summary report."""
    summary = results["summary"]
    
    report = f"""# AI Model Benchmark Report

## Overview
- Total Runs: {summary['total_runs']}
- Models Tested: {', '.join(summary['models_tested'])}
- Languages: {', '.join(summary['languages_tested'])}

## Average Scores by Model
"""
    
    for model, score in summary["average_scores"].items():
        report += f"- **{model}**: {score:.2f}\n"
    
    report += "\n## Latency Statistics\n"
    for model, stats in summary["latency_stats"].items():
        report += f"### {model}\n"
        report += f"- Average: {stats['avg']:.2f}s\n"
        report += f"- Min: {stats['min']:.2f}s\n"
        report += f"- Max: {stats['max']:.2f}s\n\n"
    
    report += "## Retry Statistics\n"
    for model, stats in summary["retry_stats"].items():
        report += f"- **{model}**: {stats['avg']:.1f} avg retries, {stats['total']} total\n"
    
    return report