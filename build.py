# src/ の部品を1枚のHTMLにまとめる → ../ほしぞらナビ.html と ../docs/index.html
import os
H = os.path.dirname(os.path.abspath(__file__))
rd = lambda f: open(os.path.join(H, 'src', f), encoding='utf-8').read()
t = rd('template.html')
import json
t = t.replace('/*LICENSE*/', 'const LICENSE_D3=' + json.dumps(open(os.path.join(H, 'data_src', 'LICENSE'), encoding='utf-8').read()) + ';')
# 星座の絵（src/art/<ID>.jpg と meta.json）→ const ART
import base64
ad = os.path.join(H, 'src', 'art'); art = {}
if os.path.exists(os.path.join(ad, 'meta.json')):
    for cid, m in json.load(open(os.path.join(ad, 'meta.json'), encoding='utf-8')).items():
        b = open(os.path.join(ad, cid + '.jpg'), 'rb').read()
        art[cid] = {'ra0': m['ra0'], 'dec0': m['dec0'], 'k': m['k'], 'N': m['N'], 'img': 'data:image/jpeg;base64,' + base64.b64encode(b).decode()}
artjs = '\nconst ART=' + json.dumps(art, separators=(',', ':')) + ';\n'
print('絵', len(art), '枚', len(artjs) // 1024, 'KB')
for k, f in [('DATA', 'data.js'), ('CONTENT', 'content.js'), ('ASTRO', 'astro.js'), ('APP', 'app.js')]:
    t = t.replace('/*' + k + '*/', (rd(f) + (artjs if k == 'DATA' else '')).replace('</script', '<\\/script'))
os.makedirs(os.path.join(H, 'docs'), exist_ok=True)
open(os.path.join(H, 'docs', 'index.html'), 'w', encoding='utf-8').write(t)
print('ok', len(t.encode()) // 1024, 'KB')
