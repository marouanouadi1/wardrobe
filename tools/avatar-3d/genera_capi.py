"""Ritaglia maglietta e pantaloncino dal corpo dell'avatar Avaturn.

I capi sono gli stessi vertici del corpo, spostati verso l'esterno lungo la
normale. Siccome i vertici sono gli stessi, JOINTS_0 e WEIGHTS_0 si copiano
invariati: il weight transfer è esatto per costruzione, non approssimato.
"""
import json, struct, sys
from array import array
from comune import leggi_glb, leggi_accessor, TIPI, COMP

ORIG, USCITA = sys.argv[1], sys.argv[2]
g, b = leggi_glb(ORIG)
prim = g['meshes'][0]['primitives'][0]

pos, _ = leggi_accessor(g, b, prim['attributes']['POSITION'])
nor, _ = leggi_accessor(g, b, prim['attributes']['NORMAL'])
uv,  _ = leggi_accessor(g, b, prim['attributes']['TEXCOORD_0'])
joi, _ = leggi_accessor(g, b, prim['attributes']['JOINTS_0'])
wei, _ = leggi_accessor(g, b, prim['attributes']['WEIGHTS_0'])
idx, _ = leggi_accessor(g, b, prim['indices'])
ibm_bv = g['bufferViews'][g['accessors'][g['skins'][0]['inverseBindMatrices']]['bufferView']]
ibm_dati = b[ibm_bv.get('byteOffset', 0): ibm_bv.get('byteOffset', 0) + ibm_bv['byteLength']]

joints = g['skins'][0]['joints']
nome_osso = {k: g['nodes'][j].get('name', '') for k, j in enumerate(joints)}

nv = len(pos) // 3
dominante = []
for i in range(nv):
    w = wei[i*4:i*4+4]
    j = joi[i*4:i*4+4]
    dominante.append(nome_osso[j[max(range(4), key=lambda k: w[k])]])

# I colori veri dei capi dell'utente, letti da GET /capi: «verde smeraldo» per
# la t-shirt e «Marrone tabacco» per il pantalone. Restano il ripiego per quando
# la foto del capo non c'è — con la foto, la tinta la porta la texture.
MAGLIETTA_HEX = '#3FBE85'
PANTALONCINO_HEX = '#8B6748'


def da_hex(hex_srgb):
    """baseColorFactor di glTF è in spazio lineare, un esadecimale è in sRGB:
    senza questa conversione il capo esce visibilmente più chiaro."""
    def lineare(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return [lineare(int(hex_srgb[i:i+2], 16)) for i in (1, 3, 5)] + [1.0]


TORSO = {'Spine', 'Spine1', 'Spine2', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm'}
# Le ossa della gamba entrano nel set perché un bermuda arriva al ginocchio
# (che su questo corpo sta a Y 0.506) e la coscia da sola si ferma prima.
BACINO = {'Hips', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg'}

def maglietta(i):
    x, y, z = abs(pos[i*3]), pos[i*3+1], pos[i*3+2]
    # Hips entra nel set perché il bordo basso cade dove il ventre è ancora
    # pesato sul bacino: senza, l'orlo esce frastagliato.
    if dominante[i] not in TORSO | {'Hips'} or y < 1.02 or x > 0.33:
        return False
    # Scollatura: il taglio va misurato come distanza dall'asse del collo, non
    # sulla sola X, altrimenti scopre anche il centro del petto e della schiena.
    return not (y > 1.50 and (x*x + z*z) ** 0.5 < 0.105)

def pantaloncino(i):
    y = pos[i*3+1]
    return dominante[i] in BACINO and 0.48 < y < 1.12

def allinea(bs):
    return bs + b'\x00' * ((4 - len(bs) % 4) % 4)

def costruisci(predicato, offset, colore, nome_capo, percorso):
    tieni = [predicato(i) for i in range(nv)]
    tri = [idx[t*3:t*3+3] for t in range(len(idx)//3)]
    tri = [t for t in tri if tieni[t[0]] and tieni[t[1]] and tieni[t[2]]]
    if not tri:
        raise SystemExit(f'{nome_capo}: selezione vuota')

    vecchi = sorted({v for t in tri for v in t})
    nuovo = {v: k for k, v in enumerate(vecchi)}

    P, N, U, J, W = array('f'), array('f'), array('f'), array('B'), array('f')
    for v in vecchi:
        # Il capo è il corpo spinto in fuori lungo la sua normale: aderisce
        # senza compenetrare, e l'offset è ciò che evita lo z-fighting.
        for k in range(3):
            P.append(pos[v*3+k] + nor[v*3+k] * offset)
            N.append(nor[v*3+k])
        U.extend(uv[v*2:v*2+2])
        J.extend(joi[v*4:v*4+4])
        W.extend(wei[v*4:v*4+4])
    I = array('H', [nuovo[v] for t in tri for v in t])

    pezzi, bv, acc, off = [], [], [], 0
    def aggiungi(dati, tipo, comp, count, target=None, minmax=None):
        nonlocal off
        bs = allinea(dati.tobytes())
        pezzi.append(bs)
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(dati.tobytes())}
        if target: v['target'] = target
        bv.append(v)
        a = {'bufferView': len(bv)-1, 'componentType': comp, 'count': count, 'type': tipo}
        if minmax: a['min'], a['max'] = minmax
        acc.append(a)
        off += len(bs)
        return len(acc)-1

    # accessor 0 = inverseBindMatrices, copiato invariato dall'originale
    pezzi.append(allinea(ibm_dati))
    bv.append({'buffer': 0, 'byteOffset': 0, 'byteLength': len(ibm_dati)})
    acc.append({'bufferView': 0, 'componentType': 5126, 'count': len(joints), 'type': 'MAT4'})
    off = len(allinea(ibm_dati))

    mins = [min(P[k::3]) for k in range(3)]
    maxs = [max(P[k::3]) for k in range(3)]
    a_pos = aggiungi(P, 'VEC3', 5126, len(vecchi), 34962, (mins, maxs))
    a_nor = aggiungi(N, 'VEC3', 5126, len(vecchi), 34962)
    a_uv  = aggiungi(U, 'VEC2', 5126, len(vecchi), 34962)
    a_joi = aggiungi(J, 'VEC4', 5121, len(vecchi), 34962)
    a_wei = aggiungi(W, 'VEC4', 5126, len(vecchi), 34962)
    a_idx = aggiungi(I, 'SCALAR', 5123, len(I), 34963)

    binario = b''.join(pezzi)
    nodi = json.loads(json.dumps(g['nodes']))
    for n in nodi:
        if 'mesh' in n:
            n['name'] = nome_capo
    doc = {
        'asset': {'version': '2.0', 'generator': 'wardrobe/genera_capi.py'},
        'scene': g.get('scene', 0),
        'scenes': g['scenes'],
        'nodes': nodi,
        'skins': [{'joints': joints, 'inverseBindMatrices': 0, 'name': 'Armature'}],
        'meshes': [{'name': nome_capo, 'primitives': [{
            'attributes': {'POSITION': a_pos, 'NORMAL': a_nor, 'TEXCOORD_0': a_uv,
                           'JOINTS_0': a_joi, 'WEIGHTS_0': a_wei},
            'indices': a_idx, 'material': 0}]}],
        'materials': [{'name': nome_capo, 'doubleSided': True, 'pbrMetallicRoughness': {
            'baseColorFactor': colore, 'metallicFactor': 0.0, 'roughnessFactor': 0.85}}],
        'accessors': acc, 'bufferViews': bv, 'buffers': [{'byteLength': len(binario)}],
    }
    scrivi(doc, binario, percorso)
    print(f'{percorso}: {len(vecchi)} vertici, {len(tri)} triangoli')

def scrivi(doc, binario, percorso):
    js = allinea(json.dumps(doc, separators=(',', ':')).encode()).replace(b'\x00', b'\x20')
    js = json.dumps(doc, separators=(',', ':')).encode()
    js = js + b' ' * ((4 - len(js) % 4) % 4)
    bn = binario + b'\x00' * ((4 - len(binario) % 4) % 4)
    tot = 12 + 8 + len(js) + 8 + len(bn)
    with open(percorso, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, tot))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(bn), 0x004E4942)); f.write(bn)

# ── corpo ripulito: stessa geometria, materiale piatto, texture fuori dal GLB ──
def corpo_senza_texture(percorso):
    pezzi, bv, acc, off = [], [], [], 0
    pezzi.append(allinea(ibm_dati))
    bv.append({'buffer': 0, 'byteOffset': 0, 'byteLength': len(ibm_dati)})
    acc.append({'bufferView': 0, 'componentType': 5126, 'count': len(joints), 'type': 'MAT4'})
    off = len(allinea(ibm_dati))

    def aggiungi(dati, tipo, comp, count, target, minmax=None):
        nonlocal off
        bs = allinea(dati.tobytes())
        pezzi.append(bs)
        bv.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(dati.tobytes()), 'target': target})
        a = {'bufferView': len(bv)-1, 'componentType': comp, 'count': count, 'type': tipo}
        if minmax: a['min'], a['max'] = minmax
        acc.append(a)
        off += len(bs)
        return len(acc)-1

    mins = [min(pos[k::3]) for k in range(3)]
    maxs = [max(pos[k::3]) for k in range(3)]
    a_pos = aggiungi(pos, 'VEC3', 5126, nv, 34962, (mins, maxs))
    a_nor = aggiungi(nor, 'VEC3', 5126, nv, 34962)
    a_uv  = aggiungi(uv,  'VEC2', 5126, nv, 34962)
    a_joi = aggiungi(joi, 'VEC4', 5121, nv, 34962)
    a_wei = aggiungi(wei, 'VEC4', 5126, nv, 34962)
    a_idx = aggiungi(idx, 'SCALAR', 5123, len(idx), 34963)

    binario = b''.join(pezzi)
    doc = {
        'asset': {'version': '2.0', 'generator': 'wardrobe/genera_capi.py'},
        'scene': g.get('scene', 0), 'scenes': g['scenes'],
        'nodes': json.loads(json.dumps(g['nodes'])),
        'skins': [{'joints': joints, 'inverseBindMatrices': 0, 'name': 'Armature'}],
        'meshes': [{'name': 'avaturn_body', 'primitives': [{
            'attributes': {'POSITION': a_pos, 'NORMAL': a_nor, 'TEXCOORD_0': a_uv,
                           'JOINTS_0': a_joi, 'WEIGHTS_0': a_wei},
            'indices': a_idx, 'material': 0}]}],
        # metallicFactor 0: l'originale è 1 perché aveva la texture
        # metallicRoughness; senza quella texture un metallo puro sarebbe nero.
        'materials': [{'name': 'pelle', 'doubleSided': True, 'pbrMetallicRoughness': {
            'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0.0, 'roughnessFactor': 0.9}}],
        'accessors': acc, 'bufferViews': bv, 'buffers': [{'byteLength': len(binario)}],
    }
    scrivi(doc, binario, percorso)
    print(f'{percorso}: {nv} vertici, {len(idx)//3} triangoli (corpo)')

corpo_senza_texture(f'{USCITA}/avatar.glb')
costruisci(maglietta,    0.012, da_hex(MAGLIETTA_HEX),    'capo_maglietta',    f'{USCITA}/maglietta.glb')
costruisci(pantaloncino, 0.010, da_hex(PANTALONCINO_HEX), 'capo_pantaloncino', f'{USCITA}/pantaloncino.glb')

# baseColor JPEG estratta come file separato (evita le texture embedded, che in
# React Native falliscono con "Creating blobs from ArrayBuffer are not supported")
im = g['images'][g['textures'][g['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]
bvi = g['bufferViews'][im['bufferView']]
with open(f'{USCITA}/avatar-pelle.jpg', 'wb') as f:
    f.write(b[bvi.get('byteOffset', 0): bvi.get('byteOffset', 0) + bvi['byteLength']])
print(f'{USCITA}/avatar-pelle.jpg: {bvi["byteLength"]//1024} KB')
