"""
update_claude_md.py — Actualiza la sección [AUTO] del CLAUDE.md.
Llamado por compress_context.py al final de cada run.
No invocar directamente.
"""

# La lógica está integrada en compress_context.py -> update_claude_md()
# Este archivo existe como punto de entrada explícito si se necesita
# actualizar el CLAUDE.md de forma aislada.

import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent

if __name__ == "__main__":
    from scripts.compress_context import update_claude_md
    if len(sys.argv) > 1:
        compressed = json.loads(Path(sys.argv[1]).read_text())
    else:
        compressed = json.load(sys.stdin)
    update_claude_md(compressed)
    print("CLAUDE.md [AUTO] actualizado.")
