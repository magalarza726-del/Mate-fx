from playwright.sync_api import sync_playwright
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
core=(root/'assets/nprimos/generator-core.mjs').read_text()
core=re.sub(r'^export\s+', '', core, flags=re.M)
ui=(root/'assets/nprimos/research-ui.js').read_text()
ui=re.sub(r'^import\s+.*$', '', ui, flags=re.M)
ui=ui.replace("new URL('./generator-worker.mjs',import.meta.url)", "'fake-worker'")
html=(root/'tests/research-harness.html').read_text().replace('<script type="module" src="../assets/nprimos/research-ui.js"></script>','').replace('<link rel="stylesheet" href="../assets/nprimos/research-ui.css">','')
script='''
class MockWorker {constructor(){this.onmessage=null}postMessage(message){if(message.type==='start')setTimeout(()=>{this.onmessage?.({data:{type:'progress',done:10,total:10,batch:[{iteration:1,latex:'(3)\\\\cdot x+(7)',mape:0,perRange:[0,0,0],model:{terms:[{kind:'x',p:0,uses:1}],constant:true,coefs:[3,7]}}],best:{latex:'(3)\\\\cdot x+(7)',mape:0}}});this.onmessage?.({data:{type:'complete',done:10,total:10,best:{latex:'(3)\\\\cdot x+(7)',mape:0}}})},60)}terminate(){}}
window.Worker=MockWorker;
'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1300,'height':900})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html)
 page.add_script_tag(content=script+core+'\n'+ui)
 page.wait_for_selector('#np-dashboard-btn',timeout=3000)
 page.click('#np-dashboard-btn')
 assert page.locator('#gmr-chart-series label').count()==5
 page.locator('#gmr-chart-series input').nth(2).check()
 assert '2 series' in page.locator('#gmr-chart-status').inner_text()
 page.click('#np-dashboard-panel .gmr-research-heading button')
 page.click('#np-generator-btn')
 page.wait_for_selector('#gmr-gen-start',timeout=3000)
 page.click('#gmr-gen-start')
 page.wait_for_function('document.querySelector("#gmr-gen-progress").value>=10',timeout=3000)
 page.wait_for_selector('#gmr-gen-history tr')
 page.click('#gmr-gen-history .gmr-apply')
 assert page.evaluate('window.lastApplied.latex.startsWith("f_{")')
 assert not errors,errors
 print('Browser inline smoke PASS · charts + generator controls + table history + apply to Desmos',flush=True)
 page.screenshot(path=str(root/'tests/research-preview.png'))
 browser.close()
