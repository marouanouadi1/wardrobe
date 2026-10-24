"""I pacchetti del corpo dell'avatar, presi dai dati grezzi di MakeHuman (MPFB 2.0.18).

Il corpo base, i target, lo scheletro e gli accessori così come stanno nei file di MPFB e dei
suoi asset di sistema: niente Blender e niente cottura. L'app rifà il conto di MPFB da sé
(`apps/mobile/src/avatar/motore.ts`), quindi qui si impacchetta **solo ciò che quel conto può
chiedere** con i cursori dell'app — che si leggono da `apps/mobile/src/avatar/cursori.ts`, con
`node`: l'elenco è scritto una volta sola.

Tre pacchetti, perché il telefono non carichi il corpo che non mostra:

    comune.bin   corpo base, cursori regionali, scheletro e pesi, occhi, sopracciglia e ciglia
    donna.bin    le macro del corpo femminile a 25 anni, lo strato neutro, i capelli
    uomo.bin     lo stesso per il corpo maschile

Formato: 4 byte con la lunghezza di una testa JSON, la testa, poi un blob allineato a 4 byte;
ogni array grande sta nel blob e la testa dice dove (`{"o": offset, "n": quanti, "t": tipo}`).
**Non compressi**: Hermes non ha `DecompressionStream`, e l'APK è già uno zip.

Gli scarti dei target sono interi a 16 bit in passi di 0,02 mm (più larghi solo dove non ci
stanno), gli indici si omettono quando un target tocca tutti i vertici. Tutto resta nel sistema
di MakeHuman — Y in alto, il davanti verso +Z, decimetri: è l'app a portarlo in metri.

Licenza: la mesh base, i target e gli asset di sistema di MakeHuman sono CC0 (ADR 0012).

    uv run --no-project --with numpy --with pillow python tools/avatar/estrai.py
    uv run --no-project --with numpy --with pillow python tools/avatar/estrai.py \\
        --extra <cursori.json> --uscita <cartella>      # i candidati per la pagina di revisione

Con `--extra` scrive invece `extra-comune.bin`, `extra-donna.bin` e `extra-uomo.bin`: i target
dei cursori **lasciati fuori** dall'app, perché la pagina di revisione li possa far provare.
"""

from __future__ import annotations

import argparse
import gzip
import json
import os
import struct
import subprocess
from itertools import product
from pathlib import Path

import numpy as np

RADICE = Path(__file__).resolve().parents[2]
CATALOGO = RADICE / "apps" / "mobile" / "src" / "avatar" / "cursori.ts"
USCITA_APP = RADICE / "apps" / "mobile" / "assets" / "avatar"

# Dove li mette MPFB 2.0.18 dentro Blender 4.5: il corpo e i target stanno nell'add-on, gli
# asset di sistema (occhi, capelli, abiti) nel pacchetto separato `makehuman_system_assets_cc0`.
MPFB = Path(os.environ.get("MPFB_DATI", "~/.config/blender/4.5/extensions/user_default/mpfb/data"))
ASSET = Path(os.environ.get("MPFB_ASSET", "~/.config/blender/4.5/extensions/.user/user_default/mpfb/data"))
MPFB, ASSET = MPFB.expanduser(), ASSET.expanduser()

PASSO = 0.0002  # dm, cioè 0,02 mm
SOGLIA = 0.01  # quella di MPFB: un target pesato meno di così non entra nella pila

# Le macro che l'app non muove, ai valori del corpo medio di MakeHuman: 25 anni, proporzioni e
# sodezza a metà, le tre etnie alla pari. Il motore le legge da qui, non le ridichiara.
MACRO_FISSE = {"age": 0.5, "proportions": 0.5, "firmness": 0.5, "cupsize": 0.5}
RAZZE = {"african": 1 / 3, "asian": 1 / 3, "caucasian": 1 / 3}

# Per ogni corpo: il valore della macro «gender», lo strato neutro (un abito di sistema, che
# l'app dipinge di un colore solo: non è un capo, è ciò che evita un corpo nudo nella scheda)
# e un'acconciatura.
CORPI = {
    "donna": {"gender": 0.0, "strato": "female_casualsuit01", "capelli": "bob02"},
    "uomo": {"gender": 1.0, "strato": "male_casualsuit06", "capelli": "short02"},
}
OCCHI, SOPRACCIGLIA, CIGLIA = "brown_eye.png", "eyebrow001", "eyelashes01"
# Le articolazioni che la posa usa: spalla, gomito e polso dei due lati.
ARTICOLAZIONI = [f"joint-{lato}-{p}" for lato in "lr" for p in ("shoulder", "elbow", "hand")]


def leggi_catalogo() -> list[dict]:
    codice = (
        f"const m = await import({json.dumps(CATALOGO.as_uri())});"
        "console.log(JSON.stringify(m.CURSORI))"
    )
    uscita = subprocess.run(
        ["node", "--no-warnings", "--input-type=module", "-e", codice],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(uscita.stdout)


def leggi_obj(percorso: Path):
    v, vt, facce, gruppi = [], [], [], {}
    gruppo = None
    for riga in open(percorso):
        p = riga.split()
        if not p:
            continue
        if p[0] == "v":
            v.append([float(x) for x in p[1:4]])
        elif p[0] == "vt":
            vt.append([float(x) for x in p[1:3]])
        elif p[0] == "g":
            gruppo = p[1] if len(p) > 1 else None
        elif p[0] == "f":
            f = []
            for c in p[1:]:
                parti = c.split("/")
                f.append((int(parti[0]) - 1, int(parti[1]) - 1 if len(parti) > 1 and parti[1] else -1))
            facce.append(f)
            gruppi.setdefault(gruppo, []).append(len(facce) - 1)
    return np.array(v, dtype=np.float32), np.array(vt, dtype=np.float32), facce, gruppi


def per_disegnare(facce, scelte, vt):
    """Vertici da disegnare = coppie (vertice, uv) distinte; triangoli che li indicizzano."""
    mappa, origine, uv, tri = {}, [], [], []
    for i in scelte:
        idx = []
        for vi, ti in facce[i]:
            k = (vi, ti)
            if k not in mappa:
                mappa[k] = len(origine)
                origine.append(vi)
                uv.append(vt[ti] if ti >= 0 else (0.0, 0.0))
            idx.append(mappa[k])
        for j in range(1, len(idx) - 1):
            tri.append((idx[0], idx[j], idx[j + 1]))
    return (
        np.array(origine, dtype=np.uint32),
        np.array(uv, dtype=np.float32),
        np.array(tri, dtype=np.uint32),
    )


def leggi_target(rel: str):
    idx, off = [], []
    for riga in gzip.open(MPFB / "targets" / f"{rel}.target.gz", "rt"):
        p = riga.split()
        if len(p) >= 4 and not riga.startswith("#"):
            idx.append(int(p[0]))
            off.append([float(x) for x in p[1:4]])
    return np.array(idx, dtype=np.uint16), np.array(off, dtype=np.float32).reshape(-1, 3)


def leggi_mhclo(percorso: Path) -> dict:
    info: dict = {"verts": [], "delete": []}
    in_verts = in_del = False
    for riga in open(percorso):
        if riga.startswith("#"):
            continue
        p = riga.split()
        if not p:
            continue
        if p[0] in ("x_scale", "y_scale", "z_scale"):
            info[p[0]] = [int(p[1]), int(p[2]), float(p[3])]
        elif p[0] == "obj_file":
            info["obj"] = p[1]
        elif p[0] == "verts":
            in_verts, in_del = True, False
        elif p[0] == "delete_verts":
            in_verts, in_del = False, True
        elif in_verts and p[0].lstrip("-")[:1].isdigit():
            if len(p) == 1:
                info["verts"].append([int(p[0])] * 3 + [1.0, 0.0, 0.0, 0.0, 0.0, 0.0])
            else:
                info["verts"].append([int(x) for x in p[:3]] + [float(x) for x in p[3:9]])
        elif in_del:
            i = 0
            while i < len(p):
                if i + 2 < len(p) and p[i + 1] == "-":
                    info["delete"].extend(range(int(p[i]), int(p[i + 2]) + 1))
                    i += 3
                else:
                    info["delete"].append(int(p[i]))
                    i += 1
    return info


class Pacco:
    """Una testa JSON e un blob: ogni array grande sta nel blob, e la testa dice dove."""

    def __init__(self) -> None:
        self.testa: dict = {"formato": 1, "passo": PASSO}
        self.blob = bytearray()

    def array(self, a: np.ndarray) -> dict:
        while len(self.blob) % 4:
            self.blob.append(0)
        voce = {"o": len(self.blob), "n": int(a.size), "t": a.dtype.name}
        self.blob += np.ascontiguousarray(a).tobytes()
        return voce

    def target(self, rel: str, n_vertici: int) -> dict:
        idx, off = leggi_target(rel)
        passo = max(PASSO, float(np.abs(off).max(initial=0)) / 32000)
        voce = {"d": self.array(np.round(off / passo).astype(np.int16).ravel()), "s": passo}
        if not (len(idx) == n_vertici and np.array_equal(idx, np.arange(n_vertici))):
            voce["i"] = self.array(idx)
        return voce

    def texture(self, percorso: Path, lato: int) -> dict:
        from PIL import Image  # solo qui: `riferimento.py` gira nel Python di Blender, che non ce l'ha

        im = Image.open(percorso).convert("RGBA").resize((lato, lato), Image.LANCZOS)
        # Dal basso in alto: la prima riga di una texture GL è v = 0, cioè il fondo dell'immagine.
        # Capovolta qui, l'app non deve chiedere a nessuno `UNPACK_FLIP_Y`, che `expo-gl` e i
        # browser trattano in modo diverso per i dati grezzi.
        righe = np.flipud(np.asarray(im, dtype=np.uint8))
        return {"w": lato, "h": lato, "rgba": self.array(righe.ravel())}

    def scrivi(self, percorso: Path) -> None:
        t = json.dumps(self.testa, separators=(",", ":")).encode()
        dati = struct.pack("<I", len(t)) + t
        while len(dati) % 4:
            dati += b" "
        percorso.write_bytes(dati + bytes(self.blob))
        print(f"{percorso.name}: {percorso.stat().st_size / 1e6:.2f} MB")


def accessorio(p: Pacco, cartella: str, nome: str) -> dict:
    d = ASSET / cartella / nome
    m = leggi_mhclo(d / f"{nome}.mhclo")
    pv, pvt, pf, _ = leggi_obj(d / m["obj"])
    o, u, t = per_disegnare(pf, range(len(pf)), pvt)
    vv = np.array(m["verts"], dtype=np.float64)
    assert len(vv) == len(pv), (nome, len(vv), len(pv))
    return {
        "vertici": int(len(pv)),
        "rif": p.array(vv[:, :3].astype(np.uint16).ravel()),
        "pesi": p.array(vv[:, 3:6].astype(np.float32).ravel()),
        "scarti": p.array(vv[:, 6:9].astype(np.float32).ravel()),
        "scala": [m["x_scale"], m["y_scale"], m["z_scale"]],
        "origine": p.array(o),
        "uv": p.array(u.ravel()),
        "triangoli": p.array(t.ravel()),
        "nasconde": p.array(np.array(sorted(set(m["delete"])), dtype=np.uint16)),
    }


def cursori_regionali(nomi: set[str]) -> list[dict]:
    """I cursori di `target.json` con quei nomi, con i loro target per i due versi."""
    tj = json.load(open(MPFB / "targets" / "target.json"))
    trovati = []
    for gruppo, dati in tj.items():
        for c in dati.get("categories", []):
            if c["name"] not in nomi:
                continue
            o = c.get("opposites")
            if o is None:
                neg, pos = [], list(c["targets"])
            elif c["has_left_and_right"]:
                neg = [x for x in (o["negative-left"], o["negative-right"]) if x]
                pos = [x for x in (o["positive-left"], o["positive-right"]) if x]
            else:
                neg = [o["negative-unsided"]] if o["negative-unsided"] else []
                pos = [o["positive-unsided"]] if o["positive-unsided"] else []
            trovati.append(
                {"nome": c["name"], "neg": [f"{gruppo}/{t}" for t in neg], "pos": [f"{gruppo}/{t}" for t in pos]}
            )
    mancanti = nomi - {c["nome"] for c in trovati}
    assert not mancanti, f"cursori che MakeHuman non ha: {sorted(mancanti)}"
    return trovati


def componenti(parti: list[dict], valore: float) -> list[tuple[str, float]]:
    """`TargetService._interpolate_macro_components` di MPFB, come in `motore.ts`."""
    out = []
    for p in parti:
        if p["lowest"] < valore < p["highest"]:
            pos = (valore - p["lowest"]) / (p["highest"] - p["lowest"])
            if p["low"]:
                out.append((p["low"], round(1 - pos, 4)))
            if p["high"]:
                out.append((p["high"], round(pos, 4)))
    return out


def macro_possibili(macro: dict, gender: float, mobili: set[str]) -> set[str]:
    """Ogni target di macro che la pila di MPFB può chiedere muovendo solo le macro `mobili`.

    Il peso di un target è un prodotto di componenti, una per macro, e le macro si muovono
    indipendenti: il suo peso massimo è il prodotto dei massimi di ciascuna componente. Un
    target entra se quel massimo supera la soglia — con le stesse esclusioni del motore.
    """
    griglia = [i / 100 for i in range(101)]
    valori = {k: griglia if k in mobili else [MACRO_FISSE.get(k, 0.5)] for k in macro}
    valori["gender"] = [gender]
    c: dict[str, list[tuple[str, float]]] = {}
    for k, parti in macro.items():
        massimi: dict[str, float] = {}
        for val in valori[k]:
            for etichetta, w in componenti(parti["parts"], val):
                massimi[etichetta] = max(massimi.get(etichetta, 0.0), w)
        c[k] = list(massimi.items())
    trovati: set[str] = set()
    for razza, rv in RAZZE.items():
        for (a, wa), (g, wg) in product(c["age"], c["gender"]):
            if g != "universal" and rv * wg * wa > SOGLIA:
                trovati.add(f"macrodetails/{razza}-{g}-{a}")
    for (g, w1), (a, w2), (mu, w3), (wg, w4) in product(c["gender"], c["age"], c["muscle"], c["weight"]):
        if w1 * w2 * w3 * w4 > SOGLIA:
            trovati.add(f"macrodetails/universal-{g}-{a}-{mu}-{wg}")
        for h, w5 in c["height"]:
            if w1 * w2 * w3 * w4 * w5 > SOGLIA:
                trovati.add(f"macrodetails/height/{g}-{a}-{mu}-{wg}-{h}")
        for pr, w5 in c["proportions"]:
            nome = f"macrodetails/proportions/{g}-{a}-{mu}-{wg}-{pr}"
            if w1 * w2 * w3 * w4 * w5 > SOGLIA and "-baby-" not in nome:
                trovati.add(nome)
    for (g, _), (a, w2), (mu, w3), (wg, w4), (cu, w5), (f, w6) in product(
        c["gender"], c["age"], c["muscle"], c["weight"], c["cupsize"], c["firmness"]
    ):
        nome = f"breast/female-{a}-{mu}-{wg}-{cu}-{f}"
        # come in MPFB: il peso del genere qui non entra, conta solo che ci sia
        if g == "female" and w2 * w3 * w4 * w5 * w6 > SOGLIA:
            if "averagecup-averagefirmness" not in nome and "-baby-" not in nome:
                trovati.add(nome)
    return {n for n in trovati if (MPFB / "targets" / f"{n}.target.gz").exists()}


def pacchi_app(uscita: Path) -> None:
    catalogo = leggi_catalogo()
    v, vt, facce, gruppi = leggi_obj(MPFB / "3dobjs" / "base.obj")
    nv = len(v)
    macro = json.load(open(MPFB / "targets" / "macrodetails" / "macro.json"))["macrotargets"]

    p = Pacco()
    origine, uv, tri = per_disegnare(facce, gruppi["body"], vt)
    nel_corpo = sorted({vi for i in gruppi["body"] for vi, _ in facce[i]})
    p.testa["corpo"] = {
        "vertici": nv,
        "base": p.array(v.ravel()),
        "origine": p.array(origine),
        "uv": p.array(uv.ravel()),
        "triangoli": p.array(tri.ravel()),
        "nel_corpo": p.array(np.array(nel_corpo, dtype=np.uint16)),
    }
    p.testa["macro"] = macro
    p.testa["macro_fisse"] = {**MACRO_FISSE, "razze": RAZZE}
    regionali = cursori_regionali({c["nome"] for c in catalogo if c["tipo"] == "regionale"})
    p.testa["cursori"] = regionali
    p.testa["target"] = {rel: p.target(rel, nv) for c in regionali for rel in c["neg"] + c["pos"]}

    rig = json.load(open(MPFB / "rigs" / "standard" / "rig.game_engine.json"))
    pesi = json.load(open(MPFB / "rigs" / "standard" / "weights.game_engine.json"))["weights"]
    p.testa["ossa"] = [{"nome": n, "padre": b["parent"]} for n, b in rig.items()]
    p.testa["articolazioni"] = {
        k: p.array(np.array(sorted({vi for i in gruppi[k] for vi, _ in facce[i]}), dtype=np.uint16))
        for k in ARTICOLAZIONI
    }
    p.testa["pesi"] = {
        osso: {
            "i": p.array(np.array(lista, dtype=np.float32)[:, 0].astype(np.uint16)),
            "w": p.array(np.array(lista, dtype=np.float32)[:, 1].copy()),
        }
        for osso, lista in pesi.items()
        if lista
    }
    p.testa["accessori"] = {
        "Occhi": accessorio(p, "eyes", "low-poly"),
        "Sopracciglia": accessorio(p, "eyebrows", SOPRACCIGLIA),
        "Ciglia": accessorio(p, "eyelashes", CIGLIA),
    }
    p.testa["tex"] = {
        "Occhi": p.texture(ASSET / "eyes" / "materials" / OCCHI, 128),
        "Sopracciglia": p.texture(ASSET / "eyebrows" / SOPRACCIGLIA / f"{SOPRACCIGLIA}.png", 256),
        "Ciglia": p.texture(ASSET / "eyelashes" / CIGLIA / f"{CIGLIA}.png", 256),
    }
    p.scrivi(uscita / "comune.bin")

    for corpo, cfg in CORPI.items():
        mobili = {
            c["nome"]
            for c in catalogo
            if c["tipo"] == "macro" and (not c.get("corpi") or corpo in c["corpi"])
        } | {"height"}  # l'altezza è una macro anche se l'app la legge da `Misure`
        p = Pacco()
        p.testa["genere"] = cfg["gender"]
        p.testa["target"] = {n: p.target(n, nv) for n in sorted(macro_possibili(macro, cfg["gender"], mobili))}
        p.testa["accessori"] = {
            "Strato": accessorio(p, "clothes", cfg["strato"]),
            "Capelli": accessorio(p, "hair", cfg["capelli"]),
        }
        p.testa["tex"] = {"Capelli": p.texture(ASSET / "hair" / cfg["capelli"] / f"{cfg['capelli']}_diffuse.png", 512)}
        p.scrivi(uscita / f"{corpo}.bin")


def pacchi_extra(file_extra: Path, uscita: Path) -> None:
    """I target dei candidati: cursori regionali lasciati fuori, e le macro che l'app tiene ferme."""
    extra = json.load(open(file_extra))
    v, _, _, _ = leggi_obj(MPFB / "3dobjs" / "base.obj")
    nv = len(v)
    macro = json.load(open(MPFB / "targets" / "macrodetails" / "macro.json"))["macrotargets"]

    p = Pacco()
    regionali = cursori_regionali(set(extra["regionali"]))
    p.testa["cursori"] = regionali
    p.testa["target"] = {rel: p.target(rel, nv) for c in regionali for rel in c["neg"] + c["pos"]}
    p.scrivi(uscita / "extra-comune.bin")

    catalogo = leggi_catalogo()
    for corpo, cfg in CORPI.items():
        dell_app = {c["nome"] for c in catalogo if c["tipo"] == "macro" and (not c.get("corpi") or corpo in c["corpi"])}
        gia = macro_possibili(macro, cfg["gender"], dell_app | {"height"})
        tutte = macro_possibili(macro, cfg["gender"], dell_app | {"height"} | set(extra["macro"]))
        p = Pacco()
        p.testa["genere"] = cfg["gender"]
        p.testa["target"] = {n: p.target(n, nv) for n in sorted(tutte - gia)}
        p.scrivi(uscita / f"extra-{corpo}.bin")


if __name__ == "__main__":
    argomenti = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    argomenti.add_argument("--extra", type=Path, help="i cursori candidati, per la pagina di revisione")
    argomenti.add_argument("--uscita", type=Path, default=USCITA_APP)
    a = argomenti.parse_args()
    a.uscita.mkdir(parents=True, exist_ok=True)
    if a.extra:
        pacchi_extra(a.extra, a.uscita)
    else:
        pacchi_app(a.uscita)
