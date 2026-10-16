"""B4 อินโฟกราฟิกขึ้นเว็บจริง: ใช้คำสั่งชุดเดียวกับเดโม่ (build_demo.py) เฉพาะส่วนอินโฟกราฟิก + แผงดาวน์โหลดส่วนหัว
ใช้: python3 b4_apply.py <scratch> <repo>"""
import sys, re, json, pathlib
SCR = pathlib.Path(sys.argv[1]); REPO = pathlib.Path(sys.argv[2])
ix = REPO / "index.html"; html = ix.read_text(encoding="utf-8")
src = (SCR / "build_demo.py").read_text(encoding="utf-8").split("\n")
miss = []; ns = {"html": html, "SCR": SCR, "json": json, "re": re}
def sub(old, new, count=1):
    n = ns["html"].count(old)
    if n != count: miss.append((n, old[:100])); return
    ns["html"] = ns["html"].replace(old, new)
ns["sub"] = sub
def lines(a, b): return "\n".join(src[a - 1:b])
hdr = [i for i, l in enumerate(src, 1) if l.startswith("# แผงดาวน์โหลด: ป้ายชื่อช่องชัดเจน")][0]
end = [i for i, l in enumerate(src, 1) if l.startswith("# สัปดาห์ระบาดวิทยา: monthly() เดิม")][0]
code = "\n".join([lines(622, 623), lines(625, 634), lines(638, 639), lines(641, 650), lines(652, 653), lines(655, 655), lines(657, 657), lines(659, 660), lines(hdr + 1, end - 1)])
exec(code, ns)
for n, o in miss: print("MISS", n, repr(o))
html = ns["html"]
a = '<script src="/html2canvas.min.js"></script>'
assert html.count(a) == 1
html = html.replace(a, a + '\n<!-- QR ในอินโฟกราฟิก (qrcode-generator · MIT) -->\n<script src="/qrcode.js"></script>')
css = (SCR / "b4_css_missing.css").read_text(encoding="utf-8") + "\n.cap[hidden]{display:none!important}\n"
i = html.rindex("</style>"); assert i < html.index("</head>")
html = html[:i] + "\n/* ===== B4 อินโฟกราฟิก (ชุดเดียวกับเดโม่) ===== */\n" + css + html[i:]
import shutil; shutil.copy(SCR / "npmq" / "package" / "qrcode.js", REPO / "qrcode.js")
ix.write_text(html, encoding="utf-8"); print("ok", len(html))
