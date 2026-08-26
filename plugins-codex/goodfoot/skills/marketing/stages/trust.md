# Trust

Mechanism: trust in automation is driven by system attributes — above all observed performance — not user traits or reassuring language. Reliance biases run both ways: people over-weight algorithmic advice in some settings and abandon algorithms faster than humans after one visible error. Target calibrated reliance, not maximum reliance.

Do:
- Show performance: real outputs, error rates, provenance.
- Make reversal cheap and say so: undo, override, diff-before-apply. "Easy to override when wrong" survives contact with errors.
- Surface uncertainty honestly — calibrated trust doesn't detonate on the first visible error; inflated trust does.

Don't:
- "Trustworthy AI" or any trust adjective as a slogan.
- Hide error behavior.
- Write messaging to "overcome algorithm aversion" — design and describe for appropriate reliance instead.

Example:
- ✗ "Enterprise-grade, trustworthy AI you can rely on."
- ✓ "Every suggestion is a diff with its source attached. Wrong? `acme undo` reverts it. Current false-positive rate: on the dashboard."
