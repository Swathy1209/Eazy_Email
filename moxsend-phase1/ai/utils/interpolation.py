import re
from typing import Any, Dict

def interpolate_tags(text: str, lead_data: Dict[str, Any]) -> str:
    """
    Replaces {{tag}} with lead_data['tag'].
    Supported tags: name, company, industry, role, firstname, lastname, location, etc.
    """
    if not text:
        return ""
        
    def replace(match):
        tag = match.group(1).lower().strip()
        
        # Mapping common tags to lead_data keys
        if tag == "name":
            val = lead_data.get("name") or f"{lead_data.get('firstname', '')} {lead_data.get('lastname', '')}".strip()
        elif tag == "company":
            val = lead_data.get("company")
        elif tag == "industry":
            val = lead_data.get("industry")
        elif tag == "role":
            val = lead_data.get("designation") or lead_data.get("role")
        elif tag == "firstname":
            val = lead_data.get("firstname")
        elif tag == "lastname":
            val = lead_data.get("lastname")
        elif tag == "location":
            val = lead_data.get("location") or lead_data.get("city") or lead_data.get("country")
        else:
            val = lead_data.get(tag)
            
        return str(val) if val else f"[{tag}]"

    # Regex for {{tag}} or {tag}
    return re.sub(r'\{\{?([\w\s]+)\}?\}', replace, text)
