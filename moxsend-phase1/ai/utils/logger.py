import json
import logging
from datetime import datetime
from typing import Dict, Any

logger = logging.getLogger('moxsend_ai')

def log_event(workflow_id: str, lead_id: str, node_name: str, **kwargs: Any) -> None:
    event: Dict[str, Any] = {
        'timestamp': datetime.utcnow().isoformat(),
        'workflow_id': workflow_id,
        'lead_id': lead_id,
        'node_name': node_name,
        **kwargs
    }
    logger.info(json.dumps(event))