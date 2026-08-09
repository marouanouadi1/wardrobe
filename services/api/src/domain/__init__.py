"""Logica di dominio di Wardrobe.

Regola unica e non negoziabile: qui non entra nessun SDK. Niente psycopg,
niente httpx. Tutto quello che serve dall'esterno passa dai Protocol in
`domain.ports`, che gli adapter implementano. È per questo che i test in
tests/domain girano con pytest e nient'altro: nessuna credenziale, nessun
container, nessun mock di SDK esterni.

I modelli in `domain.models` sono anche la fonte di verità dei contratti: da
lì `scripts/export_schema.py` genera il JSON Schema e da quello nascono i tipi
TypeScript in packages/contracts.
"""
