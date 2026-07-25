"""Un file per provider, più il registro.

Contratto: ogni provider espone `nome`, `modelli()` e `completa()` — cioè il
Protocol `domain.ports.ProviderLlm` — e un costruttore che accetta una chiave
di override opzionale. Nient'altro.
"""
