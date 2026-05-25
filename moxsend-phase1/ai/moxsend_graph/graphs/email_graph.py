from langgraph.graph import StateGraph, END
from moxsend_graph.states.email_state import EmailState
from moxsend_graph.nodes.generate_email import generate_base_email_node
from moxsend_graph.nodes.generate_cohort_subjects import generate_subject_lines_node

builder = StateGraph(EmailState)

builder.add_node("generate_base_email", generate_base_email_node)
builder.add_node("generate_subject_lines", generate_subject_lines_node)

builder.set_entry_point("generate_base_email")
builder.add_edge("generate_base_email", "generate_subject_lines")
builder.add_edge("generate_subject_lines", END)

email_graph = builder.compile()
