import sys, asyncio, re
from playwright.async_api import async_playwright
S=sys.argv[1]
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1366,'height':900}, accept_downloads=True)
    errs=[]; cons=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.on('console',lambda m: cons.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    await pg.goto('file://'+S+'/live-prev.html'); await pg.wait_for_function('document.getElementById("sb")',timeout=30000); await pg.wait_for_timeout(2500)
    txt=await pg.evaluate('document.body.innerText')
    for kw in ['15.00','15:00','บ่าย','28 ม.ค','undefined','NaN','null','[object']:
      for m in re.finditer(re.escape(kw),txt):
        print('TEXT',kw,'|',txt[max(0,m.start()-90):m.end()+60].replace('\n',' / '))
    # sections content sizes
    print(await pg.evaluate('''()=>[...document.querySelectorAll("main section")].map(s=>(s.id||"-")+":"+s.innerText.length+":"+s.querySelectorAll("svg,canvas").length)'''))
    # empty-ish elements showing dashes
    print('dash cells', await pg.evaluate('''()=>[...document.querySelectorAll("main *")].filter(e=>e.children.length==0&&/^\\s*(—|-|–)\\s*$/.test(e.textContent)).slice(0,15).map(e=>e.className+"|"+(e.closest("[id]")||{}).id)'''))
    # images broken
    print('broken img', await pg.evaluate('''()=>[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.src.slice(0,80))'''))
    print('ERR',errs); print('CONSOLE',[c for c in cons if 'tile.openstreetmap' not in c and 'ERR_' not in c][:20])
    await b.close()
asyncio.run(main())
