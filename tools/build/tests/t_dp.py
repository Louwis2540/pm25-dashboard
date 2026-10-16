import sys, asyncio
from playwright.async_api import async_playwright
S=sys.argv[1]
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    for w,h in [(1366,800),(390,844)]:
      pg=await b.new_page(viewport={'width':w,'height':h}); errs=[]
      pg.on('pageerror',lambda e: errs.append(str(e)))
      await pg.goto('file://'+S+'/demo-a1.html'); await pg.wait_for_function('document.getElementById("sb")',timeout=20000); await pg.wait_for_timeout(1000)
      st=await pg.evaluate('()=>({hidden:document.getElementById("zData").hidden,bar:!!document.getElementById("dsBar"),inMainVisible:[...document.querySelectorAll("main section")].map(s=>s.id).join(","),ov:document.documentElement.scrollWidth-innerWidth})')
      print(w,st,errs)
      await pg.evaluate('scrollTo(0,document.documentElement.scrollHeight)'); await pg.wait_for_timeout(500)
      await pg.screenshot(path=f'{S}/dp_{w}_bottom.png')
      if w<1024: await pg.click('#sbBtn'); await pg.wait_for_timeout(400)
      await pg.click('#sb a[data-z="zData"]'); await pg.wait_for_timeout(800)
      r=await pg.evaluate('()=>({hidden:document.getElementById("zData").hidden,on:document.querySelector("#sb a.on")?.dataset.z,steps:document.querySelectorAll("#dsBody .ds-step").length,rect:JSON.stringify(document.getElementById("zData").getBoundingClientRect()),ov:document.documentElement.scrollWidth-innerWidth})')
      print(' open',r); await pg.screenshot(path=f'{S}/dp_{w}_open.png')
      await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
      print(' esc', await pg.evaluate('document.getElementById("zData").hidden'), errs)
      j=await pg.query_selector('.ds-jump')
      if j:
        await pg.evaluate('document.querySelector(".ds-jump").click()'); await pg.wait_for_timeout(500)
        print(' jump opens', await pg.evaluate('!document.getElementById("zData").hidden'))
        await pg.click('#dpX'); await pg.wait_for_timeout(300); print(' x closes', await pg.evaluate('document.getElementById("zData").hidden'))
      await pg.close()
    await b.close()
asyncio.run(main())
