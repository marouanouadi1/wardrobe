"""Applica la foto di un capo sulla sua geometria 3D — ADR 0004, primo pezzo.

    uv run --with pillow --with numpy python scripts/vesti_da_foto.py \
        maglietta.glb foto.png assets/3d/maglietta-foto

Il capo 3D nasce ritagliato dal corpo (`genera_capi.py`), quindi porta con sé le
UV della **pelle** dell'avatar: puntano all'atlas di Avaturn e con la foto di un
capo darebbero spazzatura. Qui vengono buttate e ricalcolate come proiezione
planare frontale — la sagoma del capo nella foto viene stesa sulla bbox del capo
in 3D.

Fronte e retro finiscono sulla stessa regione della texture, con il retro
specchiato. Per un capo a tinta unita o a trama regolare non si vede; per una
stampa asimmetrica sì, e allora servirà una mappatura che distingua i due lati.

La texture esce come JPEG **senza canale alpha**: la silhouette è già la mesh,
quindi la trasparenza non serve e la sua assenza evita sia il sorting dei
materiali trasparenti in three sia un file più pesante del necessario.
"""

from __future__ import annotations

import json
import struct
import sys
from array import array
from pathlib import Path

import numpy as np
from PIL import Image

RADICE = Path(__file__).resolve().parent
sys.path.insert(0, str(RADICE))

from comune import COMP, TIPI, leggi_accessor, leggi_glb  # noqa: E402

# Quanto margine lasciare attorno alla sagoma quando si ritaglia la foto: senza,
# il bordo del capo cade esattamente sul bordo della texture e l'interpolazione
# bilineare ci pesca dentro il fondo.
MARGINE = 0.02
# Sotto questa opacità un pixel è sfondo, non capo.
SOGLIA_ALPHA = 24
# Il lato lungo della texture finale. Le scontornate arrivano anche a 4000px e
# diversi MB: su un telefono ogni texture occupa memoria video per tutta la vita
# della scena, e a questa distanza di camera oltre il migliaio di pixel non si
# vede differenza.
LATO_MAX = 1024


def _pelle(rgb: np.ndarray, minimo_rosso: int = 70) -> np.ndarray:
    """Quali pixel sono pelle nuda.

    Serve perché una foto «indossata» supera lo scontorno tutta intera: la
    sagoma che torna è la persona, non il capo. La regola è quella classica in
    RGB (Kovac), con una soglia sul rosso più bassa dell'originale: le gambe in
    ombra sotto un bermuda stanno sotto i 95 e altrimenti resterebbero dentro.
    """
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    return (
        (r > minimo_rosso)
        & (g > 30)
        & (b > 15)
        & ((rgb.max(2) - rgb.min(2)) > 15)
        & (np.abs(r - g) > 12)
        & (r > g)
        & (r > b)
    )


def _vicino_al_colore(rgb: np.ndarray, hex_capo: str, soglia: float = 0.045) -> np.ndarray:
    """Quali pixel hanno la tinta che l'analisi ha letto dal capo.

    Il confronto è sulla **cromaticità** — le componenti divise per la loro
    somma — non sul colore assoluto: un capo fotografato ha zone in piena luce e
    zone in ombra profonda, e sono lo stesso tessuto. Da solo questo filtro non
    separa un beige da un incarnato, che in cromaticità si somigliano; unito
    all'esclusione della pelle, sì.
    """
    bersaglio = np.array([int(hex_capo[i : i + 2], 16) for i in (1, 3, 5)], dtype=np.float64)
    totale = np.clip(rgb.sum(axis=2), 1, None)
    return (np.abs(rgb[:, :, 0] / totale - bersaglio[0] / bersaglio.sum()) < soglia) & (
        np.abs(rgb[:, :, 1] / totale - bersaglio[1] / bersaglio.sum()) < soglia
    )


def _riquadro_significativo(maschera: np.ndarray, quota: float = 0.10) -> tuple[int, int, int, int]:
    """La bbox delle righe e colonne che contano davvero.

    Prendere il minimo e il massimo assoluto includerebbe qualsiasi pixel
    isolato — un dito, un riflesso, un bordo mal scontornato. Tenendo solo le
    righe e le colonne sopra una quota del loro massimo, il riquadro segue il
    corpo del capo e ignora il resto.
    """
    per_riga = maschera.sum(axis=1)
    per_colonna = maschera.sum(axis=0)
    righe = np.where(per_riga > per_riga.max() * quota)[0]
    colonne = np.where(per_colonna > per_colonna.max() * quota)[0]
    return int(colonne[0]), int(righe[0]), int(colonne[-1]) + 1, int(righe[-1]) + 1


def ritaglia_capo(
    percorso_foto: Path, hex_capo: str | None = None
) -> tuple[Image.Image, tuple[int, int, int, int]]:
    """La foto ridotta al solo capo, su fondo neutro.

    Con una foto scontornata (PNG con alpha) la sagoma è esatta: la bbox esce
    dal canale alpha. Senza alpha si ripiega sulla differenza dai pixel del
    bordo, che regge su fondo piatto e non su uno sfondo qualsiasi.
    """
    img = Image.open(percorso_foto)
    img = img.convert("RGBA") if "A" in img.getbands() else img.convert("RGB")

    px = np.array(img)
    rgb = px[:, :, :3].astype(np.int16)

    if img.mode == "RGBA":
        opachi = px[:, :, 3] > SOGLIA_ALPHA
    else:
        bordo = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
        opachi = np.abs(rgb - np.median(bordo, axis=0)).sum(axis=2) > 60

    if not opachi.any():
        raise SystemExit(f"{percorso_foto.name}: nessun capo riconosciuto nella foto")

    # Una foto del capo steso non ha pelle; una foto indossata ne ha tanta, e
    # lì il capo è solo la parte vestita di ciò che lo scontorno ha tenuto.
    nuda = _pelle(rgb) & opachi
    indossata = nuda.sum() > opachi.sum() * 0.15
    capo = opachi & ~nuda if indossata else opachi
    if not capo.any():
        raise SystemExit(f"{percorso_foto.name}: dopo aver escluso la pelle non resta capo")

    # Il riquadro si decide sulla tinta del capo, il riempimento no: dentro il
    # ritaglio restano così il laccio, le cuciture e le ombre, che del tessuto
    # fanno parte pur non avendone il colore.
    if indossata and hex_capo:
        tinta = capo & _vicino_al_colore(rgb, hex_capo)
        if tinta.sum() > opachi.sum() * 0.05:
            x0, y0, x1, y1 = _riquadro_significativo(tinta)
        else:
            x0, y0, x1, y1 = _riquadro_significativo(capo)
    else:
        x0, y0, x1, y1 = _riquadro_significativo(capo)
    alt, larg = capo.shape
    my, mx = int(alt * MARGINE), int(larg * MARGINE)
    riquadro = (max(0, x0 - mx), max(0, y0 - my), min(larg, x1 + mx), min(alt, y1 + my))

    # Tutto ciò che non è capo — sfondo trasparente e pelle rimasta dentro il
    # riquadro, come le gambe sotto un bermuda — prende il colore medio del
    # tessuto. Il capo non ha più buchi, e ai bordi l'interpolazione bilineare
    # non pesca né bianco né incarnato.
    medio = rgb[capo].mean(axis=0).astype(np.uint8)
    piatta = np.where(capo[:, :, None], rgb, medio).astype(np.uint8)

    return Image.fromarray(piatta, "RGB").crop(riquadro), riquadro


def scrivi_glb(doc: dict, binario: bytes, percorso: Path) -> None:
    js = json.dumps(doc, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    bn = binario + b"\x00" * ((4 - len(binario) % 4) % 4)
    with percorso.open("wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bn)))
        f.write(struct.pack("<II", len(js), 0x4E4F534A))
        f.write(js)
        f.write(struct.pack("<II", len(bn), 0x004E4942))
        f.write(bn)


def rifai_uv(percorso_glb: Path, uscita_glb: Path) -> None:
    """Riscrive il capo con UV di proiezione planare frontale.

    Tutto il resto — ossa, pesi, indici, gerarchia — resta identico: cambia solo
    TEXCOORD_0, e il materiale diventa bianco perché la tinta la porta la foto.
    """
    g, b = leggi_glb(str(percorso_glb))
    prim = g["meshes"][0]["primitives"][0]

    pos, _ = leggi_accessor(g, b, prim["attributes"]["POSITION"])
    xyz = np.array(pos, dtype=np.float32).reshape(-1, 3)

    minimi, massimi = xyz.min(axis=0), xyz.max(axis=0)
    larghezza = max(massimi[0] - minimi[0], 1e-6)
    altezza = max(massimi[1] - minimi[1], 1e-6)
    u = (xyz[:, 0] - minimi[0]) / larghezza
    # v cresce verso il basso nello spazio texture, y verso l'alto nel mondo.
    v = 1.0 - (xyz[:, 1] - minimi[1]) / altezza
    uv = np.stack([u, v], axis=1).astype(np.float32)

    pezzi: list[bytes] = []
    viste: list[dict] = []
    accessori: list[dict] = []
    scostamento = 0

    def aggiungi(dati: bytes, accessore: dict, target: int | None = None) -> int:
        nonlocal scostamento
        vista = {"buffer": 0, "byteOffset": scostamento, "byteLength": len(dati)}
        if target:
            vista["target"] = target
        viste.append(vista)
        accessori.append({**accessore, "bufferView": len(viste) - 1})
        riempito = dati + b"\x00" * ((4 - len(dati) % 4) % 4)
        pezzi.append(riempito)
        scostamento += len(riempito)
        return len(accessori) - 1

    def copia(indice: int, target: int | None = None) -> int:
        vecchio = g["accessors"][indice]
        dati, dim = leggi_accessor(g, b, indice)
        accessore = {
            "componentType": vecchio["componentType"],
            "count": vecchio["count"],
            "type": vecchio["type"],
        }
        if "min" in vecchio:
            accessore["min"], accessore["max"] = vecchio["min"], vecchio["max"]
        return aggiungi(dati.tobytes(), accessore, target)

    a_ibm = copia(g["skins"][0]["inverseBindMatrices"])
    a_pos = copia(prim["attributes"]["POSITION"], 34962)
    a_nor = copia(prim["attributes"]["NORMAL"], 34962)
    a_uv = aggiungi(
        uv.tobytes(),
        {"componentType": 5126, "count": len(uv), "type": "VEC2"},
        34962,
    )
    a_joi = copia(prim["attributes"]["JOINTS_0"], 34962)
    a_wei = copia(prim["attributes"]["WEIGHTS_0"], 34962)
    a_idx = copia(prim["indices"], 34963)

    binario = b"".join(pezzi)
    nome = g["meshes"][0].get("name", "capo")
    doc = {
        "asset": {"version": "2.0", "generator": "wardrobe/vesti_da_foto.py"},
        "scene": g.get("scene", 0),
        "scenes": g["scenes"],
        "nodes": g["nodes"],
        "skins": [{"joints": g["skins"][0]["joints"], "inverseBindMatrices": a_ibm, "name": "Armature"}],
        "meshes": [
            {
                "name": nome,
                "primitives": [
                    {
                        "attributes": {
                            "POSITION": a_pos,
                            "NORMAL": a_nor,
                            "TEXCOORD_0": a_uv,
                            "JOINTS_0": a_joi,
                            "WEIGHTS_0": a_wei,
                        },
                        "indices": a_idx,
                        "material": 0,
                    }
                ],
            }
        ],
        # Bianco: la texture porta il colore, e un baseColorFactor tinto lo
        # moltiplicherebbe una seconda volta.
        "materials": [
            {
                "name": nome,
                "doubleSided": True,
                "pbrMetallicRoughness": {
                    "baseColorFactor": [1, 1, 1, 1],
                    "metallicFactor": 0.0,
                    "roughnessFactor": 0.85,
                },
            }
        ],
        "accessors": accessori,
        "bufferViews": viste,
        "buffers": [{"byteLength": len(binario)}],
    }
    scrivi_glb(doc, binario, uscita_glb)


def main() -> None:
    if len(sys.argv) not in (4, 5):
        raise SystemExit(__doc__)
    glb_ingresso, foto, prefisso_uscita = (Path(a) for a in sys.argv[1:4])
    # Il colore letto dall'analisi del capo (`colore.hex` in `GET /capi`), che
    # serve solo a inquadrare un capo indossato.
    hex_capo = sys.argv[4] if len(sys.argv) == 5 else None

    ritagliata, riquadro = ritaglia_capo(foto, hex_capo)
    if max(ritagliata.size) > LATO_MAX:
        fattore = LATO_MAX / max(ritagliata.size)
        nuova = (round(ritagliata.width * fattore), round(ritagliata.height * fattore))
        ritagliata = ritagliata.resize(nuova, Image.LANCZOS)

    texture = prefisso_uscita.with_name(prefisso_uscita.name + "-texture.jpg")
    ritagliata.convert("RGB").save(texture, quality=88, optimize=True)

    glb = prefisso_uscita.with_suffix(".glb")
    rifai_uv(glb_ingresso, glb)

    print(f"{texture}: {ritagliata.width}x{ritagliata.height} da riquadro {riquadro}")
    print(f"{glb}: UV rifatte in proiezione planare frontale")


if __name__ == "__main__":
    main()
