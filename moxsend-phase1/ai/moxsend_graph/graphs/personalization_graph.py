from langgraph.graph import END, StateGraph

from moxsend_graph.states.personalization_state import PersonalizationState
from moxsend_graph.nodes.generate_email import generate_base_email_node
from moxsend_graph.nodes.generate_cohort_subjects import generate_subject_lines_node
from moxsend_graph.nodes.refine_email import refine_email_node


def _route(state: PersonalizationState) -> str:
    action = str(state.get("action", "")).strip()
    if action == "refine_lead":
        return "refine"
    return "base"


builder = StateGraph(PersonalizationState)

# Base email flow (campaign / cohort)
builder.add_node("generate_base_email", generate_base_email_node)
builder.add_node("generate_subject_lines", generate_subject_lines_node)

# Lead refinement flow (single lead)
builder.add_node("refine_email", refine_email_node)

builder.set_conditional_entry_point(_route, {"base": "generate_base_email", "refine": "refine_email"})

builder.add_edge("generate_base_email", "generate_subject_lines")
builder.add_edge("generate_subject_lines", END)
builder.add_edge("refine_email", END)

personalization_graph = builder.compile()

