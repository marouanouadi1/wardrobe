# Un campione compilato per intero, come esempio

Questo è come dovrebbe apparire una riga di `campioni.json` una volta
compilata — non è uno dei 10 campioni veri, solo un esempio della caratteristica
2 (bianco difficile) per mostrare i tre stati insieme.

```json
{
  "id": "c02",
  "descrizione": "Bianco difficile: bianco ottico, panna, écru o avorio",
  "foto": "c02.jpg",
  "verita": {
    "tipo": { "attesi": ["top"] },
    "colore": {
      "attesi": ["panna"],
      "vicini": ["écru", "avorio", "bianco sporco"],
      "hex": "#E7DFD2",
      "tolleranza_hex": 45
    },
    "materiale": { "attesi": ["lino"], "vicini": ["cotone", "misto lino"] },
    "fantasia": { "attesi": ["tinta unita"] },
    "stagione": { "attesi": ["estate"], "vicini": ["primavera", "mezza_stagione"] },
    "lavaggio": { "assente": true }
  }
}
```

Da notare:

- `tipo` ha un solo valore in `attesi`: è un attributo indispensabile
  (`ATTRIBUTI_INDISPENSABILI` in `domain/vision.py`), niente sinonimi da
  concedere.
- `colore` porta `hex` + `tolleranza_hex`: il punteggio sul colore si decide
  sulla distanza RGB da questo hex, non sul confronto fra nomi.
- `vestibilita` non compare affatto: su questo campione non è leggibile
  dalla foto, quindi resta "non valutato" — diverso da `lavaggio`, che
  invece è deliberatamente `assente: true` perché qui l'etichetta non è
  nella foto e la risposta giusta del modello è `null`.
