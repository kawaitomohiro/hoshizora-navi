# src/ の部品を1枚のHTMLにまとめる → ../ほしぞらナビ.html と ../docs/index.html
import os
H = os.path.dirname(os.path.abspath(__file__))
rd = lambda f: open(os.path.join(H, 'src', f), encoding='utf-8').read()
t = rd('template.html')
import json
t = t.replace('/*LICENSE*/', 'const LICENSE_D3=' + json.dumps(open(os.path.join(H, 'data_src', 'LICENSE'), encoding='utf-8').read()) + ';')
for k, f in [('DATA', 'data.js'), ('CONTENT', 'content.js'), ('ASTRO', 'astro.js'), ('APP', 'app.js')]:
    t = t.replace('/*' + k + '*/', rd(f).replace('</script', '<\\/script'))
os.makedirs(os.path.join(H, 'docs'), exist_ok=True)
open(os.path.join(H, 'docs', 'index.html'), 'w', encoding='utf-8').write(t)
print('ok', len(t.encode()) // 1024, 'KB')
