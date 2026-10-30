from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
core=(root/'assets/nprimos/envelope-core.mjs').read_text().replace('export const ','const ').replace('export function ','function ')
ui=(root/'assets/nprimos/envelopes-ui.js').read_text()
ui='\n'.join(line for line in ui.splitlines() if not line.startswith('import ')).replace("new URL('./envelope-worker.mjs',import.meta.url)","'mock-worker'")
css=(root/'assets/nprimos/research-ui.css').read_text()
html='''<!doctype html><html><body><div id="primeTablePanel"></div>
<div id="gmr-intervals"><div class="gmr-segment"><input value="0"><input value="10"></div><div class="gmr-segment"><input value="10"><input value="20"></div></div>
<script>
window.__nPrimosCalculator={getExpressions:()=>[],getState:()=>({expressions:{list:[]}}),setExpression:e=>(window._added??=[]).push(e)};
window.__gmrActiveProject=()=>({id:'test-project',name:'Ejemplo'});
window.__gmrResearchSnapshot=()=>({source:{points:Array.from({length:21},(_,i)=>[i,2*Math.exp(.12*i)])}});
window.Worker=class{postMessage(m){this.messages??=[];this.messages.push(m)}terminate(){}};
window.__gmrSaveNPrimos=()=>{};window.confirm=()=>true;
</script></body></html>'''
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1300,'height':850}); errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html);page.add_style_tag(content=css)
 page.add_script_tag(content=core+'\n'+ui)
 page.wait_for_selector('#np-envelope-btn',timeout=5000)
 page.locator('#np-envelope-btn').click()
 assert page.locator('#np-envelope-panel').is_visible()
 page.locator('#env-n').fill('127')
 page.locator('#env-scope').select_option('sections')
 page.locator('#env-bounds').select_option('independent')
 page.locator('#env-center').select_option('auto')
 page.locator('#env-start').click()
 assert page.locator('#env-progress-label').inner_text()=='0 / 127'
 assert page.locator('#env-pause').is_enabled()
 page.locator('#env-pause').click()
 assert page.locator('#env-resume').is_enabled()
 page.locator('#env-resume').click()
 assert page.locator('#env-pause').is_enabled()
 page.locator('#env-stop').click()
 assert page.locator('#env-start').is_enabled()
 assert not errors,errors
 print('OK: botón independiente, n=127, segmentación, pausa/reanudación/detención, sin errores JS')
 b.close()