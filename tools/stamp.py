# Setzt eine neue Versionsnummer an alle Skript-/CSS-/JSON-Links (gegen alten Browser-Cache).
# Aufruf vor jedem Commit: python3 tools/stamp.py
import re, time, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
v = time.strftime('%Y%m%d%H%M%S')
p = root / 'index.html'
s = p.read_text(encoding='utf-8')
s = re.sub(r'(src="js/[\w.-]+\.js)(\?v=\w+)?"', lambda m: m.group(1) + '?v=' + v + '"', s)
s = re.sub(r'(href="css/[\w.-]+\.css)(\?v=\w+)?"', lambda m: m.group(1) + '?v=' + v + '"', s)
s = re.sub(r"window\.ASSET_V = '\w*'", "window.ASSET_V = '" + v + "'", s)
if 'window.ASSET_V' not in s:
    s = s.replace('<script src="https://cdn.jsdelivr.net', "<script>window.ASSET_V = '" + v + "';</script>\n  <script src=\"https://cdn.jsdelivr.net", 1)
p.write_text(s, encoding='utf-8')
print('Version', v)
