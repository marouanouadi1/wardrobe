"""Il riferimento per il test del motore: MPFB vero calcola alcuni corpi, il motore dell'app deve
dare gli stessi numeri (`apps/mobile/test/avatar/motore.test.ts`).

Per ogni stato salva un campione dei vertici del corpo (con gli helper) e dello strato neutro
adattato, nel sistema di MakeHuman (Y in alto, decimetri), senza posa e senza piedi a terra.
Gli stati usano solo i cursori dell'app, letti da `cursori.ts` come fa `estrai.py`, ai loro
livelli: il test prova ciò che l'app può davvero chiedere.

    ~/wardrobe-banco-3d/strumenti/blender-4.5.14-linux-x64/blender -b --python-exit-code 1 \\
        -P tools/avatar/riferimento.py -- apps/mobile/test/avatar/riferimento.json

Va lanciato con il Blender 4.5 su cui è installato MPFB 2.0.18 con gli asset di sistema.
"""

import json
import os
import random
import sys

import bpy  # noqa: F401  (serve a MPFB)
import numpy as np
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.locationservice import LocationService
from bl_ext.user_default.mpfb.services.targetservice import TargetService

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from estrai import CORPI, MACRO_FISSE, RAZZE, cursori_regionali, leggi_catalogo  # noqa: E402

uscita = sys.argv[sys.argv.index("--") + 1]
TARGETS = LocationService.get_mpfb_data("targets")
ASSET = LocationService.get_user_data()
SCALA = 0.1
# Un vertice ogni 37, più gli estremi: abbastanza per vedere un target sbagliato ovunque agisca,
# senza mettere nel repo diciannovemila posizioni per stato.
PASSO_CAMPIONE = 37

catalogo = leggi_catalogo()
regionali = {c["nome"]: c for c in cursori_regionali({c["nome"] for c in catalogo if c["tipo"] == "regionale"})}
rnd = random.Random(12)


def stato_a_caso(corpo, n):
    validi = [c for c in catalogo if not c.get("corpi") or corpo in c["corpi"]]
    return {c["nome"]: rnd.choice([x for x in c["livelli"] if x != c["neutro"]]) for c in rnd.sample(validi, n)}


STATI = [
    {"corpo": "donna", "cursori": {}, "altezza": 0.5},
    {"corpo": "donna", "cursori": stato_a_caso("donna", 6), "altezza": 0.8},
    {"corpo": "donna", "cursori": stato_a_caso("donna", 12), "altezza": 0.15},
    {"corpo": "uomo", "cursori": {}, "altezza": 0.5},
    {"corpo": "uomo", "cursori": stato_a_caso("uomo", 6), "altezza": 0.3},
    {"corpo": "uomo", "cursori": stato_a_caso("uomo", 12), "altezza": 1.0},
]
# Ogni cursore dell'app va confrontato con MPFB almeno una volta: quelli che l'estrazione a
# caso ha lasciato fuori entrano nell'ultimo stato del loro corpo. Il test lo verifica.
for corpo in CORPI:
    ultimo = [st for st in STATI if st["corpo"] == corpo][-1]
    mossi = {k for st in STATI if st["corpo"] == corpo for k in st["cursori"]}
    for c in catalogo:
        if (not c.get("corpi") or corpo in c["corpi"]) and c["nome"] not in mossi:
            ultimo["cursori"][c["nome"]] = c["livelli"][-1]


def posizioni(ob):
    for m in ob.modifiers:
        m.show_viewport = False
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    co = np.empty(len(me.vertices) * 3, dtype=np.float32)
    me.vertices.foreach_get("co", co)
    ev.to_mesh_clear()
    co = co.reshape(-1, 3) / SCALA
    return np.stack([co[:, 0], co[:, 2], -co[:, 1]], axis=1)  # Blender (x, y, z) -> MakeHuman (x, z, -y)


def campione(p):
    indici = sorted(set(range(0, len(p), PASSO_CAMPIONE)) | {int(p[:, 1].argmax()), int(p[:, 1].argmin())})
    return {"indici": indici, "posizioni": [round(float(x), 5) for x in p[indici].ravel()]}


risultati = []
for st in STATI:
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    cfg = CORPI[st["corpo"]]
    macro = TargetService.get_default_macro_info_dict()
    macro.update({k: v for k, v in MACRO_FISSE.items()})
    macro["gender"] = cfg["gender"]
    macro["height"] = st["altezza"]
    macro["race"] = dict(RAZZE)
    for nome, v in st["cursori"].items():
        if nome in macro:
            macro[nome] = v
    corpo = HumanService.create_human(feet_on_ground=False, scale=SCALA, macro_detail_dict=macro)
    for nome, v in st["cursori"].items():
        if nome in regionali:
            for rel in regionali[nome]["pos"] if v > 0 else regionali[nome]["neg"]:
                TargetService.load_target(corpo, os.path.join(TARGETS, rel + ".target.gz"), weight=abs(v))
    strato = HumanService.add_mhclo_asset(
        os.path.join(ASSET, "clothes", cfg["strato"], cfg["strato"] + ".mhclo"),
        corpo,
        asset_type="Clothes",
        subdiv_levels=0,
        set_up_rigging=False,
    )
    attive = sum(1 for k in corpo.data.shape_keys.key_blocks if k.value > 0)
    risultati.append(
        {
            "corpo": st["corpo"],
            "altezza": st["altezza"],
            "cursori": st["cursori"],
            "shape_key_attive": attive,
            "corpo_campione": campione(posizioni(corpo)),
            "strato_campione": campione(posizioni(strato)),
        }
    )
    print("STATO", st["corpo"], len(st["cursori"]), "cursori,", attive, "shape key attive")

json.dump(risultati, open(uscita, "w"), separators=(",", ":"))
print("FATTO", uscita)
