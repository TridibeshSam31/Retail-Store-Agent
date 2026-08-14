"""
The only file app/ should import from lang/. Keeps the dependency
one-directional and swappable — if the negotiation engine's internals
change, only this file's two functions need to still exist.
"""
from lang.multi_request_stock import run_negotiation as _run, resume_negotiation as _resume


def start_negotiation(negotiation_id: int) -> None:
    _run(negotiation_id)


def resume_negotiation(negotiation_id: int, decision: str) -> None:
    _resume(negotiation_id, decision)