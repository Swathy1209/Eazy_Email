"""
Centralized prompt registry system.
"""

import json
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from pathlib import Path

@dataclass
class PromptMetadata:
    id: str
    version: str
    description: str
    tags: List[str]
    workflow_node: str
    language: str
    created_at: str
    updated_at: str
    author: str

class PromptRegistry:
    def __init__(self, registry_path: str = "ai/prompts/registry"):
        self.registry_path = Path(registry_path)
        self.registry_path.mkdir(exist_ok=True)
        self._prompts: Dict[str, Dict[str, Any]] = {}
        self._load_registry()
    
    def _load_registry(self):
        """Load all prompts from registry files."""
        for prompt_file in self.registry_path.glob("*.json"):
            with open(prompt_file, 'r') as f:
                prompt_data = json.load(f)
                prompt_id = prompt_data['metadata']['id']
                self._prompts[prompt_id] = prompt_data
    
    def get_prompt(self, prompt_id: str, version: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Get a prompt by ID and optional version."""
        if prompt_id not in self._prompts:
            return None
        
        prompt_data = self._prompts[prompt_id]
        if version and prompt_data['metadata']['version'] != version:
            return None
        
        return prompt_data
    
    def register_prompt(self, prompt_data: Dict[str, Any]) -> bool:
        """Register a new prompt or update existing."""
        metadata = prompt_data.get('metadata', {})
        prompt_id = metadata.get('id')
        
        if not prompt_id:
            return False
        
        # Save to file
        filename = f"{prompt_id}.json"
        filepath = self.registry_path / filename
        
        with open(filepath, 'w') as f:
            json.dump(prompt_data, f, indent=2)
        
        self._prompts[prompt_id] = prompt_data
        return True
    
    def list_prompts(self, tags: Optional[List[str]] = None, workflow_node: Optional[str] = None) -> List[Dict[str, Any]]:
        """List prompts with optional filtering."""
        prompts = list(self._prompts.values())
        
        if tags:
            prompts = [p for p in prompts if any(tag in p['metadata']['tags'] for tag in tags)]
        
        if workflow_node:
            prompts = [p for p in prompts if p['metadata']['workflow_node'] == workflow_node]
        
        return prompts
    
    def get_prompt_template(self, prompt_id: str, **kwargs) -> Optional[str]:
        """Get formatted prompt template with variables."""
        prompt_data = self.get_prompt(prompt_id)
        if not prompt_data:
            return None
        
        template = prompt_data['content']
        
        # Simple variable substitution
        for key, value in kwargs.items():
            template = template.replace(f"{{{key}}}", str(value))
        
        return template

# Global registry instance
registry = PromptRegistry()

# Convenience functions
def get_prompt(prompt_id: str, **kwargs) -> Optional[str]:
    return registry.get_prompt_template(prompt_id, **kwargs)

def register_prompt(prompt_data: Dict[str, Any]) -> bool:
    return registry.register_prompt(prompt_data)