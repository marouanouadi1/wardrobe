"""Handler HTTP: adapter sottili, tre righe ciascuno.

Un handler fa esattamente questo: legge l'evento, chiama una funzione di
`domain`, formatta la risposta. Se un handler cresce, la logica in eccesso
appartiene al dominio — dove si testa senza rete e senza server.
"""
