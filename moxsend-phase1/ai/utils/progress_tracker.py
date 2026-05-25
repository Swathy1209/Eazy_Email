"""
Progress tracking system for workflow visibility.
"""

from enum import Enum
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
import time
import json

class WorkflowStatus(Enum):
    QUEUED = "queued"
    VALIDATING = "validating"
    PERSONALIZING = "personalizing"
    NARRATING = "narrating"
    GENERATING = "generating"
    EVALUATING = "evaluating"
    REWRITING = "rewriting"
    HUMANIZING = "humanizing"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class ProgressUpdate:
    workflow_id: str
    lead_id: str
    status: WorkflowStatus
    progress: float  # 0-100
    message: str
    timestamp: float
    metadata: Dict[str, Any] = None

class ProgressTracker:
    def __init__(self):
        self.updates: List[ProgressUpdate] = []
        self.active_workflows: Dict[str, List[ProgressUpdate]] = {}
    
    def update_progress(self, workflow_id: str, lead_id: str, status: WorkflowStatus, 
                       progress: float, message: str, metadata: Dict[str, Any] = None):
        """Record a progress update."""
        update = ProgressUpdate(
            workflow_id=workflow_id,
            lead_id=lead_id,
            status=status,
            progress=progress,
            message=message,
            timestamp=time.time(),
            metadata=metadata or {}
        )
        
        self.updates.append(update)
        
        if workflow_id not in self.active_workflows:
            self.active_workflows[workflow_id] = []
        self.active_workflows[workflow_id].append(update)
    
    def get_workflow_progress(self, workflow_id: str) -> List[Dict[str, Any]]:
        """Get all progress updates for a workflow."""
        return [asdict(update) for update in self.active_workflows.get(workflow_id, [])]
    
    def get_batch_progress(self, workflow_ids: List[str]) -> Dict[str, Any]:
        """Get progress summary for multiple workflows."""
        batch_summary = {
            "total_workflows": len(workflow_ids),
            "completed": 0,
            "failed": 0,
            "in_progress": 0,
            "average_progress": 0.0,
            "workflow_details": {}
        }
        
        total_progress = 0
        for wf_id in workflow_ids:
            updates = self.active_workflows.get(wf_id, [])
            if not updates:
                continue
            
            latest_update = updates[-1]
            batch_summary["workflow_details"][wf_id] = asdict(latest_update)
            
            if latest_update.status == WorkflowStatus.COMPLETED:
                batch_summary["completed"] += 1
            elif latest_update.status == WorkflowStatus.FAILED:
                batch_summary["failed"] += 1
            else:
                batch_summary["in_progress"] += 1
            
            total_progress += latest_update.progress
        
        if workflow_ids:
            batch_summary["average_progress"] = total_progress / len(workflow_ids)
        
        return batch_summary
    
    def get_recent_updates(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get most recent progress updates."""
        return [asdict(update) for update in self.updates[-limit:]]
    
    def cleanup_old_workflows(self, max_age_hours: int = 24):
        """Remove old completed workflows."""
        cutoff_time = time.time() - (max_age_hours * 3600)
        
        to_remove = []
        for wf_id, updates in self.active_workflows.items():
            if updates and updates[-1].timestamp < cutoff_time:
                if updates[-1].status in [WorkflowStatus.COMPLETED, WorkflowStatus.FAILED]:
                    to_remove.append(wf_id)
        
        for wf_id in to_remove:
            del self.active_workflows[wf_id]

# Global progress tracker instance
progress_tracker = ProgressTracker()

# Convenience functions for workflow nodes
def log_progress(workflow_id: str, lead_id: str, status: WorkflowStatus, 
                progress: float, message: str, **metadata):
    """Log progress update from workflow node."""
    progress_tracker.update_progress(workflow_id, lead_id, status, progress, message, metadata)

# Progress percentages for each node
PROGRESS_POINTS = {
    "validate_lead": 10,
    "personalize": 25,
    "narrative": 35,
    "generate": 50,
    "evaluate": 65,
    "rewrite": 75,
    "humanize": 85,
    "format_output": 95,
    "completed": 100
}