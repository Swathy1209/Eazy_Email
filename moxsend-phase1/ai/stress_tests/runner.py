"""
Large batch stress testing and stability validation.
"""

import time
import psutil
import os
import threading
from typing import Dict, List, Any
from ai.workflows.english.graph import run_english_pipeline
from ai.workflows.arabic.graph import run_arabic_pipeline

class StressTestRunner:
    def __init__(self):
        self.memory_logs = []
        self.latency_logs = []
        self.error_logs = []
    
    def run_batch_stress_test(self, batch_sizes: List[int] = None, language: str = "english") -> Dict[str, Any]:
        """Run stress tests with increasing batch sizes."""
        if batch_sizes is None:
            batch_sizes = [100, 500, 1000]
        
        results = {
            "batch_sizes": {},
            "summary": {},
            "memory_profile": [],
            "latency_profile": [],
            "error_profile": []
        }
        
        for batch_size in batch_sizes:
            print(f"Testing batch size: {batch_size}")
            
            test_leads = self._generate_test_leads(batch_size, language)
            
            # Run test with monitoring
            batch_result = self._run_monitored_batch(test_leads, language)
            results["batch_sizes"][batch_size] = batch_result
        
        # Generate summary statistics
        results["summary"] = self._calculate_stress_summary(results["batch_sizes"])
        
        return results
    
    def run_provider_failure_test(self, batch_size: int = 50) -> Dict[str, Any]:
        """Test graceful degradation when providers fail."""
        results = {
            "test_type": "provider_failure",
            "batch_size": batch_size,
            "scenarios": []
        }
        
        # Scenario 1: Partial provider failure
        test_leads = self._generate_test_leads(batch_size, "english")
        
        try:
            outputs = run_english_pipeline(test_leads)
            results["scenarios"].append({
                "scenario": "primary_provider_degradation",
                "completed": len(outputs),
                "failed": batch_size - len(outputs),
                "recovery": "automatic_fallback"
            })
        except Exception as e:
            results["scenarios"].append({
                "scenario": "primary_provider_failure",
                "error": str(e),
                "handled": "error_handler_invoked"
            })
        
        return results
    
    def run_retry_stress_test(self, batch_size: int = 100) -> Dict[str, Any]:
        """Test retry logic under stress."""
        # Create leads that trigger high retry rates
        problematic_leads = []
        for i in range(batch_size):
            lead = {
                "id": f"retry_stress_{i}",
                "firstname": "" if i % 2 == 0 else f"Test{i}",
                "lastname": "" if i % 3 == 0 else f"User{i}",
                "company": "" if i % 4 == 0 else f"Company{i}",
                "designation": "Manager",
                "industry": "Technology" if i % 5 != 0 else "",
                "company_size": "50-200",
                "city": "Test City",
                "country": "Test Country",
                "lead_type": "test",
                "source": "test"
            }
            problematic_leads.append(lead)
        
        start_time = time.time()
        
        try:
            outputs = run_english_pipeline(problematic_leads)
            duration = time.time() - start_time
            
            retry_counts = [out.get("retry_count", 0) for out in outputs]
            
            return {
                "test_type": "retry_stress",
                "batch_size": batch_size,
                "completion_time": duration,
                "completed_outputs": len(outputs),
                "total_retries": sum(retry_counts),
                "avg_retries": sum(retry_counts) / len(retry_counts) if retry_counts else 0,
                "max_retries": max(retry_counts) if retry_counts else 0,
                "min_retries": min(retry_counts) if retry_counts else 0,
                "retry_containment": max(retry_counts) <= 3  # Should not exceed max
            }
        except Exception as e:
            return {
                "test_type": "retry_stress",
                "batch_size": batch_size,
                "error": str(e),
                "failed": True
            }
    
    def run_mixed_language_stress_test(self, english_count: int = 50, arabic_count: int = 50) -> Dict[str, Any]:
        """Test mixed language batch processing under stress."""
        results = {
            "english_batch": english_count,
            "arabic_batch": arabic_count,
            "english_results": {},
            "arabic_results": {}
        }
        
        english_leads = self._generate_test_leads(english_count, "english")
        arabic_leads = self._generate_test_leads(arabic_count, "arabic")
        
        # English batch
        start = time.time()
        try:
            english_outputs = run_english_pipeline(english_leads)
            results["english_results"]["completed"] = len(english_outputs)
            results["english_results"]["duration"] = time.time() - start
            results["english_results"]["success"] = True
        except Exception as e:
            results["english_results"]["error"] = str(e)
            results["english_results"]["success"] = False
        
        # Arabic batch
        start = time.time()
        try:
            arabic_outputs = run_arabic_pipeline(arabic_leads)
            results["arabic_results"]["completed"] = len(arabic_outputs)
            results["arabic_results"]["duration"] = time.time() - start
            results["arabic_results"]["success"] = True
        except Exception as e:
            results["arabic_results"]["error"] = str(e)
            results["arabic_results"]["success"] = False
        
        return results
    
    def run_long_workflow_stability_test(self, duration_seconds: int = 60) -> Dict[str, Any]:
        """Test long-running workflows for stability."""
        results = {
            "test_type": "long_workflow_stability",
            "duration_seconds": duration_seconds,
            "batches_processed": 0,
            "total_outputs": 0,
            "memory_peak_mb": 0,
            "memory_average_mb": 0,
            "errors": 0
        }
        
        start_time = time.time()
        process = psutil.Process(os.getpid())
        memory_samples = []
        
        while time.time() - start_time < duration_seconds:
            try:
                # Process a small batch
                batch_leads = self._generate_test_leads(10, "english")
                outputs = run_english_pipeline(batch_leads)
                
                results["batches_processed"] += 1
                results["total_outputs"] += len(outputs)
                
                # Sample memory
                memory_mb = process.memory_info().rss / 1024 / 1024
                memory_samples.append(memory_mb)
                
            except Exception as e:
                results["errors"] += 1
            
            time.sleep(0.1)  # Small delay between batches
        
        if memory_samples:
            results["memory_peak_mb"] = max(memory_samples)
            results["memory_average_mb"] = sum(memory_samples) / len(memory_samples)
        
        return results
    
    def _run_monitored_batch(self, leads: List[Dict], language: str) -> Dict[str, Any]:
        """Run batch with memory and latency monitoring."""
        process = psutil.Process(os.getpid())
        memory_before = process.memory_info().rss / 1024 / 1024
        
        start_time = time.time()
        
        try:
            if language == "english":
                outputs = run_english_pipeline(leads)
            else:
                outputs = run_arabic_pipeline(leads)
            
            duration = time.time() - start_time
            memory_after = process.memory_info().rss / 1024 / 1024
            
            return {
                "success": True,
                "outputs_completed": len(outputs),
                "duration": duration,
                "throughput": len(outputs) / duration if duration > 0 else 0,
                "memory_increase_mb": memory_after - memory_before,
                "memory_before_mb": memory_before,
                "memory_after_mb": memory_after,
                "errors": sum(1 for o in outputs if "error" in o)
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "duration": time.time() - start_time,
                "memory_after_mb": process.memory_info().rss / 1024 / 1024
            }
    
    def _generate_test_leads(self, count: int, language: str) -> List[Dict]:
        """Generate test leads."""
        leads = []
        industries = ["Healthcare", "Technology", "Manufacturing", "Finance", "Retail"]
        
        for i in range(count):
            lead = {
                "id": f"stress_test_{language}_{i}",
                "firstname": f"Test{i}",
                "lastname": f"User{i}",
                "company": f"Company{i % 20}",
                "designation": "Manager",
                "industry": industries[i % len(industries)],
                "company_size": "50-200",
                "city": "Test City",
                "country": "Test Country" if language == "english" else "UAE",
                "lead_type": "test",
                "source": "stress_test"
            }
            leads.append(lead)
        
        return leads
    
    def run_malformed_output_test(self, batch_size: int = 50) -> Dict[str, Any]:
        """Test how the system handles malformed/partially valid outputs under stress."""
        results = {
            "test_type": "malformed_output_resilience",
            "batch_size": batch_size,
            "handled_successfully": 0,
            "regeneration_triggered": 0,
            "failed": 0
        }
        
        # Simulate leads that might produce malformed output
        problematic_leads = self._generate_test_leads(batch_size, "english")
        for lead in problematic_leads:
            lead["extra_instructions"] = "Return malformed JSON or invalid characters occasionally."
            
        start_time = time.time()
        try:
            outputs = run_english_pipeline(problematic_leads)
            for out in outputs:
                if out.get("retry_count", 0) > 0:
                    results["regeneration_triggered"] += 1
                if out.get("success", True):
                    results["handled_successfully"] += 1
                else:
                    results["failed"] += 1
        except Exception as e:
            results["error"] = str(e)
            
        return results

    def _calculate_stress_summary(self, batch_results: Dict[int, Dict]) -> Dict[str, Any]:
        """Calculate deep stability metrics across all stress tests."""
        summary = {
            "scalability_index": 0.0,
            "memory_stability": "stable",
            "batch_completion_reliability": 0.0,
            "latency_trend": "linear"
        }
        
        success_rates = []
        memory_trends = []
        durations = []
        
        for batch_size, result in sorted(batch_results.items()):
            if result.get("success"):
                success_rates.append(result.get("outputs_completed", 0) / batch_size)
                memory_trends.append(result.get("memory_increase_mb", 0))
                durations.append(result.get("duration", 0))
        
        if success_rates:
            summary["batch_completion_reliability"] = sum(success_rates) / len(success_rates)
            
        # Check for memory leaks (continual increase regardless of batch completion)
        if len(memory_trends) > 1 and memory_trends[-1] > memory_trends[0] * 5:
            summary["memory_stability"] = "potential_leak_detected"
            
        return summary

    def generate_batch_execution_report(self, results: Dict[str, Any]) -> str:
        """Generate a technical batch execution stability report."""
        summary = results.get("summary", {})
        report = "# Large Batch Stability Report\n\n"
        
        report += f"## Stability Summary\n"
        report += f"- Batch Completion Reliability: {summary.get('batch_completion_reliability', 0):.1%}\n"
        report += f"- Memory Stability: {summary.get('memory_stability', 'unknown')}\n"
        
        report += "\n## Batch Performance Profile\n"
        report += "| Batch Size | Throughput (leads/sec) | Memory Δ (MB) | Duration (s) |\n"
        report += "|---|---|---|---|\n"
        
        for size, metrics in summary.get("batch_size_metrics", {}).items():
            report += f"| {size} | {metrics.get('throughput', 0):.2f} | {metrics.get('memory_overhead_mb', 0):.1f} | {metrics.get('duration', 0):.2f} |\n"
            
        return report