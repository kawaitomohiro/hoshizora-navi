# 星のデータ（d3-celestial, BSD-3）から、アプリに埋め込む小さなデータを作る
# 使い方: python3 make_data.py  → src/data.js
import json, os
H = os.path.dirname(os.path.abspath(__file__))
S = os.path.join(H, 'data_src')
stars = json.load(open(os.path.join(S, 'stars.6.json')))['features']
names = json.load(open(os.path.join(S, 'starnames.json')))
lines = json.load(open(os.path.join(S, 'constellations.lines.json')))['features']
cons = json.load(open(os.path.join(S, 'constellations.json')))['features']

out_stars = []  # [ra, dec, mag, bv, conIndex]
con_ids = [c['id'] for c in cons]
for f in stars:
    m = f['properties']['mag']
    if m > 5.0:
        continue
    ra, dec = f['geometry']['coordinates']
    if ra < 0:
        ra += 360
    try:
        bv = float(f['properties']['bv'])
    except Exception:
        bv = 0.6
    n = names.get(str(f['id']), {})
    ci = con_ids.index(n['c']) if n.get('c') in con_ids else -1
    out_stars.append([round(ra, 3), round(dec, 3), round(m, 2), round(bv, 2), ci, f['id']])
out_stars.sort(key=lambda s: s[2])

out_lines = {}
for f in lines:
    segs = []
    for ln in f['geometry']['coordinates']:
        segs.append([[round(p[0] + 360 if p[0] < 0 else p[0], 3), round(p[1], 3)] for p in ln])
    out_lines[f['id']] = segs

out_cons = {}
for c in cons:
    ra, dec = c['geometry']['coordinates']
    out_cons[c['id']] = [c['properties'].get('ja', c['properties']['name']), round(ra + 360 if ra < 0 else ra, 2), round(dec, 2)]

data = {'stars': out_stars, 'lines': out_lines, 'cons': out_cons, 'conIds': con_ids}
js = 'const SKY=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(os.path.join(H, 'src', 'data.js'), 'w').write(js)
print('stars', len(out_stars), 'bytes', len(js.encode()))
