import json, struct, os
from array import array

def leggi_glb(percorso):
    tot = os.path.getsize(percorso)
    with open(percorso, 'rb') as f:
        f.seek(12)
        ch = {}
        while f.tell() < tot:
            cl, ct = struct.unpack('<II', f.read(8))
            ch['JSON' if ct == 0x4E4F534A else 'BIN'] = f.read(cl)
    return json.loads(ch['JSON']), ch['BIN']

TIPI = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
COMP = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}

def leggi_accessor(g, bin_, idx):
    a = g['accessors'][idx]
    bv = g['bufferViews'][a['bufferView']]
    tc, dim = COMP[a['componentType']], TIPI[a['type']]
    inizio = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = a['count'] * dim
    dati = array(tc[0])
    dati.frombytes(bin_[inizio:inizio + n * tc[1]])
    return dati, dim
