"""Inline dist/ into a single HTML page for the hosted preview (no external assets but Google Fonts)."""
import re, sys, pathlib
d = pathlib.Path("dist"); html = (d / "index.html").read_text()
css = "".join((d / p).read_text() for p in re.findall(r'href="\./(assets/[^"]+\.css)"', html))
js = "".join((d / p).read_text() for p in re.findall(r'src="\./(assets/[^"]+\.js)"', html))
out = f'''<title>Clearpath Prototype</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap">
<style>:root{{color-scheme:light}} body{{background:#eef1f0;color:#1b2326}}
{css}</style>
<div id="root"></div>
<script type="module">{js.replace("</script", "<\\/script")}</script>
'''
pathlib.Path(sys.argv[1]).write_text(out)
print(len(out))
