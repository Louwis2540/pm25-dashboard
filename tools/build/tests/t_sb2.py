import sys, asyncio
from playwright.async_api import async_playwright
S=sys.argv[1]; F=sys.argv[2] if len(sys.argv)>2 else 'demo-a1.html'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    for w,h in [(1366,800),(390,844)]:
      pg=await b.new_page(viewport={'width':w,'height':h}); errs=[]
      pg.on('pageerror',lambda e: errs.append(str(e)))
      await pg.goto('file://'+S+'/'+F); await pg.wait_for_function('document.getElementById("sb")',timeout=20000); await pg.wait_for_timeout(900)
      if w<1024: await pg.click('#sbBtn'); await pg.wait_for_timeout(500)
      await pg.hover('#sb a[data-z="zHot"]'); await pg.wait_for_timeout(300)
      r=await pg.evaluate('()=>({pl:getComputedStyle(document.body).paddingLeft,ov:document.documentElement.scrollWidth-innerWidth,ic:document.querySelectorAll("#sb .sb-ic svg").length,rect:JSON.stringify(document.getElementById("sb").getBoundingClientRect())})')
      print(w,r,errs); await pg.screenshot(path=f'{S}/g_{w}.png')
      await pg.close()
    await b.close()
asyncio.run(main())
