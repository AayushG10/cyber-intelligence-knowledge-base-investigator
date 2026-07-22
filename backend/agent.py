"""
Tool-calling investigation agent (OpenRouter, OpenAI-compatible).

The agent does NOT get a raw data dump. It is given read-only TOOLS over the
InvestigationEngine and must decide which to call to answer an investigator's
question, citing entity/transaction IDs. Classification stays in the engine;
the LLM only reasons over structured evidence.

If OPENROUTER_API_KEY is not set, the agent degrades gracefully to a
deterministic, evidence-grounded answer (so the demo works with no key).
"""

from __future__ import annotations

import json
import os
from typing import Any

import httpx
from dotenv import load_dotenv

from backend.engine import get_engine

load_dotenv()  # ensure OPENROUTER_* are available even if config wasn't imported first

# ---- tool schemas (OpenAI-style function calling) ------------------------- #
TOOLS = [
    {"type": "function", "function": {
        "name": "get_entity", "description": "Risk scores, reasons and features for a person_id.",
        "parameters": {"type": "object", "properties": {
            "person_id": {"type": "string"}}, "required": ["person_id"]}}},
    {"type": "function", "function": {
        "name": "get_ring", "description": "Members, ringleader and stats for a detected ring id (e.g. DR01).",
        "parameters": {"type": "object", "properties": {
            "ring_id": {"type": "string"}}, "required": ["ring_id"]}}},
    {"type": "function", "function": {
        "name": "get_shared_devices", "description": "Devices a person shares with other accounts.",
        "parameters": {"type": "object", "properties": {
            "person_id": {"type": "string"}}, "required": ["person_id"]}}},
    {"type": "function", "function": {
        "name": "money_trail", "description": "Shortest money path between two person_ids.",
        "parameters": {"type": "object", "properties": {
            "src_person": {"type": "string"}, "dst_person": {"type": "string"}},
            "required": ["src_person", "dst_person"]}}},
    {"type": "function", "function": {
        "name": "list_rings", "description": "All detected fraud rings with summary stats.",
        "parameters": {"type": "object", "properties": {}}}},
]

SYSTEM = (
    "You are a financial-crime investigation assistant. Answer ONLY from tool "
    "results. Cite specific person_ids, ring ids and amounts for every claim. "
    "Be concise and factual. If evidence is insufficient, say so."
)


def _dispatch(name: str, args: dict) -> Any:
    e = get_engine()
    if name == "get_entity":
        return e.get_entity(args["person_id"])
    if name == "get_ring":
        r = e.get_ring(args["ring_id"])
        if r:  # drop bulky node/edge arrays from the tool result
            r = {k: v for k, v in r.items() if k not in ("nodes", "edges")}
        return r
    if name == "get_shared_devices":
        return e.get_shared_devices(args["person_id"])
    if name == "money_trail":
        return e.money_trail(args["src_person"], args["dst_person"])
    if name == "list_rings":
        return e.list_rings()
    return {"error": f"unknown tool {name}"}


def _fallback(question: str) -> dict:
    """Deterministic, evidence-grounded answer when no LLM key is configured."""
    e = get_engine()
    rings = e.list_rings()
    if not rings:
        return {"answer": "No fraud rings detected in the current dataset.", "tool_calls": []}
    top = rings[0]
    ans = (
        f"[offline mode — no LLM key] Highest-risk detected ring is {top['ring_id']} "
        f"(risk {top['risk']}). Ringleader is {top['ringleader']} "
        f"({top['ringleader_name']}), identified by highest betweenness centrality on "
        f"the money-flow graph. The ring spans {len(top['states'])} state(s) "
        f"({', '.join(top['states'])}) — cross-jurisdiction={top['cross_jurisdiction']} — "
        f"with {top['n_mules']} mule-like accounts and ₹{top['total_flow_inr']:,} of flow. "
    )
    if top["first_detectable"]:
        ans += (f"It became detectable at {top['first_detectable']}, with "
                f"{top['victims_after_detectable']} victim payments occurring afterward.")
    return {"answer": ans, "tool_calls": ["list_rings"]}


def ask(question: str, max_steps: int = 5) -> dict:
    key = os.getenv("OPENROUTER_API_KEY", "")
    if not key or key.startswith("sk-or-v1-xxxx"):
        return _fallback(question)

    model = os.getenv("LLM_MODEL", "anthropic/claude-sonnet-4")
    base = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    headers = {"Authorization": f"Bearer {key}",
               "HTTP-Referer": os.getenv("OPENROUTER_APP_URL", "http://localhost:3000"),
               "X-Title": os.getenv("OPENROUTER_APP_TITLE", "Cyber Investigation Platform")}
    messages = [{"role": "system", "content": SYSTEM},
                {"role": "user", "content": question}]
    used: list[str] = []
    try:
        with httpx.Client(timeout=60) as cli:
            for _ in range(max_steps):
                resp = cli.post(f"{base}/chat/completions", headers=headers, json={
                    "model": model, "messages": messages, "tools": TOOLS}).json()
                msg = resp["choices"][0]["message"]
                messages.append(msg)
                calls = msg.get("tool_calls")
                if not calls:
                    return {"answer": msg.get("content", ""), "tool_calls": used}
                for call in calls:
                    fn = call["function"]["name"]
                    args = json.loads(call["function"].get("arguments") or "{}")
                    used.append(fn)
                    result = _dispatch(fn, args)
                    messages.append({"role": "tool", "tool_call_id": call["id"],
                                     "content": json.dumps(result, default=str)[:6000]})
            return {"answer": "Reached step limit without a final answer.", "tool_calls": used}
    except Exception as e:  # noqa: BLE001 — never crash the endpoint
        fb = _fallback(question)
        fb["answer"] = f"[LLM error, fell back] {fb['answer']}  ({type(e).__name__})"
        return fb
