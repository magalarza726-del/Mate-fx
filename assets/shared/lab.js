const lab = document.body.dataset.gmrLab;
if (!['mate','prime'].includes(lab)) throw new Error('Laboratorio no identificado');

const $ = id => document.getElementById(id);
const el = (tag, className, html='') => {
  const node = document.createElement(tag);
  node.className = className;
  node.innerHTML = html;
  return node;
};
const root = lab === 'mate' ? document.querySelector('.app-shell') : $('app');
const workspace = root.querySelector('.workspace');
const originalHeader = root.querySelector('header.topbar');
const MATE_SAVE_KEY = 'gmr:matefx:saved:v2';
const isMate = lab === 'mate';
let panelName = null;
let keyboardVisible = false;
let lastPrimeInput = null;
let lastPrimeField = null;
let autoSaveTimer = 0;
let mateName = 'Investigación 1';
let mateDesmosCalc=null;
let mateDesmosHost=null;
let mateDesmosBusy=false;
let mateGraphMode='geometry';

const header = el('header','gmr-toolbar',`
  <button type="button" class="gmr-home" data-gmr-action="home" title="Inicio" aria-label="Volver al inicio">⌂</button>
  <button type="button" class="gmr-menu" data-gmr-action="projects" title="Proyectos" aria-label="Abrir proyectos">☰</button>
  <button type="button" class="gmr-title" data-gmr-action="projects"><span id="gmr-project-title">${isMate?'Mate-fx · Investigación 1':'nPrimos · Investigación 1'}</span></button>
  <button type="button" class="gmr-save" data-gmr-action="save">Guardar</button>
  <button type="button" class="gmr-options" data-gmr-action="settings" aria-label="Opciones">⋮</button>
`);
root.insertBefore(header,originalHeader);

const graphFrame = el('section','gmr-graph-frame');
graphFrame.setAttribute('aria-label','Plano de representación gráfica');
workspace.insertBefore(graphFrame,workspace.firstChild);
const actionBar = el('nav','gmr-actionbar',`
  <button type="button" data-gmr-action="add" title="${isMate?'Editar función':'Añadir función'}">＋</button>
  <button type="button" data-gmr-action="controls" class="active">${isMate?'θ Geometría':'◉ Primos'}</button>
  <button type="button" data-gmr-action="analysis">${isMate?'▦ Inspector':'▤ Análisis'}</button>
  <button type="button" data-gmr-action="fit" title="Ajustar vista">⌖</button>
  <button type="button" data-gmr-action="engine" id="gmr-engine" title="Alternar entre Desmos real y motor local">Desmos</button>
  <div class="gmr-spacer"></div>
  <button type="button" data-gmr-action="toggle-keyboard" aria-label="Abrir o cerrar teclado matemático">⌨</button>
  <button type="button" data-gmr-action="algebra-size" title="Expandir o contraer expresiones" aria-label="Expandir o contraer álgebra">⌄</button>
`);
const dock = el('section','gmr-algebra', '<div class="gmr-algebra-head"><span>ÁLGEBRA Y EXPRESIONES</span><button type="button" class="gmr-grip" data-gmr-action="algebra-size" aria-label="Cambiar tamaño del panel">☰</button></div>');
dock.dataset.size='normal';
const keyboard = el('section','gmr-keyboard');
keyboard.setAttribute('aria-label','Teclado matemático');
const shade = el('div','gmr-panel-shade');
const drawer = el('aside','gmr-drawer','<div class="gmr-drawer-head"><strong id="gmr-drawer-title">Herramientas</strong><button type="button" data-gmr-action="close-panel" aria-label="Cerrar">×</button></div><div class="gmr-drawer-body"></div>');
const drawerTitle = drawer.querySelector('#gmr-drawer-title');
const drawerBody = drawer.querySelector('.gmr-drawer-body');
const controlsHost = el('div','gmr-controls-host');
const inspectorHost = el('div','gmr-inspector-host');
const projectHost = el('div','gmr-projects-host');
drawerBody.append(controlsHost,inspectorHost,projectHost);
workspace.append(actionBar,dock,keyboard,shade,drawer);

const floating = el('div','gmr-floating','<button type="button" data-gmr-action="settings" title="Configuración de gráfica" aria-label="Configuración">⚙</button><button type="button" data-gmr-action="fit" title="Ajustar gráfica">⌂</button>');
graphFrame.appendChild(floating);

const saveBtn = header.querySelector('.gmr-save');
const titleLabel = header.querySelector('#gmr-project-title');
const algebraSizes = ['normal','expanded','compact'];
function setSize() {
  const next = algebraSizes[(algebraSizes.indexOf(dock.dataset.size)+1)%algebraSizes.length];
  dock.dataset.size=next;
  notifyResize();
}
function notifyResize(){
  window.dispatchEvent(new Event('resize'));
  if(!isMate) window.__nPrimosCalculator?.resize();
}
function showSaveLabel(label){
  saveBtn.textContent=label;
  clearTimeout(saveBtn._tid);
  saveBtn._tid=setTimeout(()=>saveBtn.textContent='Guardar',1400);
}
function renderTitle(){
  titleLabel.textContent= isMate ? 'Mate-fx · '+mateName : 'nPrimos · '+($('currentProjectName')?.textContent||'Investigación 1');
}
function showPanel(which){
  panelName=which;
  drawer.classList.add('is-open');
  shade.classList.add('is-visible');
  controlsHost.hidden=which!=='controls';
  inspectorHost.hidden=which!=='analysis';
  projectHost.hidden=which!=='projects'&&which!=='settings';
  drawerTitle.textContent = which==='controls'?(isMate?'Geometría · Mate-fx':'Números primos'):which==='analysis'?(isMate?'Inspector geométrico':'Tabla y análisis'):which==='projects'?'Proyectos':'Opciones';
  if(which==='analysis'&&!isMate){
    closePanel();
    $('tableBtn')?.click();
    return;
  }
  if(which==='projects')renderProjects();
}
function closePanel(){
  panelName=null;
  drawer.classList.remove('is-open');
  shade.classList.remove('is-visible');
}

function invokeFocus(input){
  input?.focus({preventScroll:true});
  if(input && input.setSelectionRange){try{input.setSelectionRange(input.value.length,input.value.length)}catch(_){}}
}
function keyboardOpen(state) {
  keyboardVisible=state;
  keyboard.classList.toggle('is-open',state);
  actionBar.querySelector('[data-gmr-action="toggle-keyboard"]').classList.toggle('active',state);
  notifyResize();
}
function nativeKeyboard(input){
  if(!input)return;
  input.dataset.androidNative='1';
  input.inputMode='text';
  input.blur();
  setTimeout(()=>invokeFocus(input),40);
}

function mateSnapshot(){
  return {
    version:2,name:mateName,
    expression:$('functionInput').value,
    mode:$('curvesModeBtn').classList.contains('active')?'curves':'lines',
    angle:Number($('angleNumber').value),
    n:Number($('parameterN').value),
    xMin:Number($('xMinInput').value),
    xMax:Number($('xMaxInput').value)
  };
}
function saveMate(){
  try{ localStorage.setItem(MATE_SAVE_KEY,JSON.stringify(mateSnapshot()));showSaveLabel('Guardado ✓'); }
  catch(e){showSaveLabel('Error');console.warn('No se pudo guardar Mate-fx:',e)}
}
function restoreMate(){
  try{
    const raw=localStorage.getItem(MATE_SAVE_KEY);
    if(!raw)return;
    const project=JSON.parse(raw);
    mateName=String(project.name||mateName).slice(0,65);
    if(typeof project.expression==='string'){
      $('functionInput').value=project.expression;
      $('functionInput').dispatchEvent(new Event('input',{bubbles:true}));
    }
    if(project.mode==='curves')$('curvesModeBtn').click();
    if(Number.isFinite(project.n)){$('parameterN').value=project.n;$('parameterN').dispatchEvent(new Event('input',{bubbles:true}))}
    if(Number.isFinite(project.angle)){$('angleNumber').value=Math.min(360,Math.max(0,project.angle));$('angleNumber').dispatchEvent(new Event('change',{bubbles:true}))}
    if(Number.isFinite(project.xMin)&&Number.isFinite(project.xMax)){
      $('xMinInput').value=project.xMin;$('xMaxInput').value=project.xMax;
      $('xMaxInput').dispatchEvent(new Event('change',{bubbles:true}));
    }
  }catch(e){console.warn('No se pudo restaurar la sesión:',e)}
}
function renderProjects(){
  if(!isMate) return;
  const current=mateSnapshot();
  projectHost.replaceChildren();
  const p=el('p','', 'La investigación se guarda localmente en este dispositivo, incluso sin Internet.');
  const label=el('label','','Nombre de la investigación');
  label.style.display='grid';label.style.gap='8px';label.style.margin='12px 0';
  const input=document.createElement('input');input.type='text';input.maxLength=65;input.value=mateName;
  input.style.cssText='border:1px solid #d2dae5;border-radius:9px;padding:10px;font:inherit;width:100%';
  label.append(input);
  const rename=el('button','primary-btn','Guardar nombre');
  const reset=el('button','soft-btn','Restablecer simulador');
  reset.style.marginLeft='7px';
  const desc=el('p','',`Función: ${current.expression||'0'} · θ = ${current.angle}°`);
  desc.style.cssText='font-size:12px;color:#718096';
  rename.addEventListener('click',()=>{mateName=input.value.trim()||'Investigación 1';saveMate();renderTitle();closePanel()});
  reset.addEventListener('click',()=>{if(confirm('¿Restablecer la investigación actual?')){$('resetBtn').click();saveMate();closePanel()}});
  projectHost.append(p,label,rename,reset,desc);
}
function showSettings(){
  showPanel('settings');
  projectHost.replaceChildren();
  const p=el('div','',
    '<p><strong>Galarza Math Research</strong> · interfaz matemática 2.0.</p>'+
    '<p>La gráfica, las expresiones y las herramientas funcionan sin red. Los proyectos se guardan en el dispositivo.</p>'+
    '<p>Desliza un dedo para mover la gráfica y utiliza dos dedos para acercar o alejar.</p>'
  );
  p.style.cssText='font-size:13px;color:#576371;line-height:1.55';
  projectHost.append(p);
  const help=el('button','soft-btn','Ayuda del laboratorio');
  help.addEventListener('click',()=>{
    if(isMate){closePanel();$('helpBtn').click()}
    else{closePanel();$('projectsBtn').click()}
  });
  projectHost.append(help);
}

if(isMate) {
  const stageWrap=workspace.querySelector('.stage-wrap');
  graphFrame.appendChild(stageWrap);
  const sidebar=$('sidebar');
  dock.appendChild(sidebar);
  Array.from(sidebar.children).slice(1).forEach(section=>controlsHost.appendChild(section));
  const inspector=$('inspector');
  inspectorHost.append(inspector);
  if(inspector.classList.contains('collapsed')){$('inspectorToggle').click()}
  const mathBuilder=$('mathBuilder');
  keyboard.appendChild(mathBuilder);
  const native=el('button','gmr-native-toggle','ABC · teclado Android');
  native.type='button';
  mathBuilder.querySelector('.math-builder-head')?.appendChild(native);
  native.addEventListener('click',()=>nativeKeyboard($('functionInput')));
  $('functionInput').inputMode='none';
  $('functionInput').addEventListener('focus',()=>{
    if(!$('functionInput').dataset.androidNative)$('functionInput').inputMode='none';
    if(mathBuilder.hidden)$('mathKeyboardToggle').click();
  });
  new MutationObserver(()=>{
    const showing=!mathBuilder.hidden;
    if(showing!==keyboardVisible)keyboardOpen(showing);
  }).observe(mathBuilder,{attributes:true,attributeFilter:['hidden']});
  restoreMate();
  const autoSave=()=>{
    clearTimeout(autoSaveTimer);
    autoSaveTimer=setTimeout(()=>{
      try{localStorage.setItem(MATE_SAVE_KEY,JSON.stringify(mateSnapshot()))}catch(_){}
    },700);
  };
  for(const id of ['functionInput','angleNumber','angleSlider','xMinInput','xMaxInput','parameterN']){
    $(id).addEventListener('input',autoSave);
    $(id).addEventListener('change',autoSave);
  }
  $('linesModeBtn').addEventListener('click',autoSave);
  $('curvesModeBtn').addEventListener('click',autoSave);
  $('presetGrid').addEventListener('click',autoSave);
  renderTitle();
  // Mantener geometría disponible aunque falle el servicio de Desmos.
  const stored=localStorage.getItem('gmr:mate:engine')||'desmos';
  if(stored==='desmos')mountMateDesmos();
  else updateEngineButton();
}else{
  const calculator=$('calculator');
  graphFrame.appendChild(calculator);
  const primeToolbar=$('primeCountSlider').closest('.prime-toolbar');
  controlsHost.append(primeToolbar);
  const offlineExpressions=calculator.querySelector('.offline-expressions');
  if(offlineExpressions){
  dock.appendChild(offlineExpressions);
  keyboard.innerHTML=`
  <div class="gmr-prime-keys-header"><span>Teclado matemático</span><button type="button" data-gmr-native="true">ABC · Android</button></div>
  <div class="gmr-key-grid"></div>`;
  const keys=['x','y','^2','^','7','8','9','/','sin(','cos(',
              '(' ,')','<','>','4','5','6','*','left','right',
              'abs(','n', 'sqrt(','pi','1','2','3','-','backspace','ln(',
              'ABC','log(','exp(','=', '0','.','+',',','clear','enter'];
  const symbols={'^2':'a²','^':'aᵇ','/':'÷','*':'×','pi':'π','sqrt(':'√','abs(':'|x|',
    'sin(':'sen','cos(':'cos','log(':'log','exp(':'eˣ','ln(':'ln','left':'←',
    'right':'→','backspace':'⌫','clear':'C','enter':'↵'};
  keyboard.querySelector('.gmr-key-grid').replaceChildren(...keys.map(k=>{
    const button=document.createElement('button');button.type='button';button.dataset.gmrKey=k;
    button.textContent=symbols[k]||k;button.setAttribute('aria-label','Tecla '+k);
    button.addEventListener('pointerdown',e=>e.preventDefault());
    return button;
  }));
  keyboard.querySelector('[data-gmr-native]').addEventListener('click',()=>{
    if(!lastPrimeInput)return;
    if(lastPrimeField){
      lastPrimeField.hidden=true;
      lastPrimeInput.classList.remove('gmr-linear-shadow');
      lastPrimeField.value=lastPrimeField.value;
    }
    nativeKeyboard(lastPrimeInput);
  });
  const handleFocus=e=>{
    const input=e.target.closest?.('.offline-expression-row input');
    if(!input)return;
    lastPrimeInput=input;
    lastPrimeField=input.parentElement?.querySelector('math-field')||null;
    if(!input.dataset.androidNative)input.inputMode='none';
    keyboardOpen(true);
  };
  dock.addEventListener('pointerdown',e=>{
    const inp=e.target.closest?.('.offline-expression-row input');
    if(inp&&!inp.dataset.androidNative)inp.inputMode='none';
  });
  dock.addEventListener('focusin',handleFocus);
  const nprimosInputs=()=>dock.querySelectorAll('.offline-expression-row input').forEach(i=>{if(!i.dataset.androidNative)i.inputMode='none'});
  nprimosInputs();
  // El paquete MathLive es local. La entrada interna (ASCII) se mantiene para el motor numérico original.
  async function attach2DMathFields(){
    try{
      const mathlive=await import('./mathlive/mathlive.min.mjs');
      if(mathlive.MathfieldElement){
        mathlive.MathfieldElement.fontsDirectory='./fonts';
        mathlive.MathfieldElement.soundsDirectory=null;
      }
      await customElements.whenDefined('math-field');
      const toLatex=(text)=>{
        const value=String(text||'');
        if(/\\[a-z]+|\\frac|\\sqrt|\\left/.test(value))return value;
        try{return mathlive.convertAsciiMathToLatex(value)}catch(_){return value}
      };
      const bind=()=>{
        dock.querySelectorAll('.offline-expression-row').forEach(row=>{
          const input=row.querySelector('input');
          if(!input||input.dataset.mathBound)return;
          input.dataset.mathBound='1';
          const field=document.createElement('math-field');
          field.className='gmr-math-field';
          field.setAttribute('aria-label','Expresión matemática bidimensional');
          field.mathVirtualKeyboardPolicy='manual';
          field.smartFence=true;
          field.menuItems=[];
          field.value=toLatex(input.value);
          input.classList.add('gmr-linear-shadow');
          input.insertAdjacentElement('afterend',field);
          field.addEventListener('focusin',()=>{
            lastPrimeInput=input;
            lastPrimeField=field;
            keyboardOpen(true);
          });
          field.addEventListener('input',()=>{
            input.value=field.getValue('ascii-math');
            input.dispatchEvent(new Event('input',{bubbles:true}));
          });
          field.addEventListener('change',()=>{
            input.value=field.getValue('ascii-math');
            input.dispatchEvent(new Event('change',{bubbles:true}));
          });
          input.addEventListener('gmr-sync',()=>{
            if(document.activeElement!==field)field.value=toLatex(input.value);
          });
          input.addEventListener('blur',()=>{
            if(!input.dataset.androidNative)return;
            field.value=toLatex(input.value);
            field.hidden=false;
            input.classList.add('gmr-linear-shadow');
            input.dataset.androidNative='';
          });
        });
      };
      bind();
      new MutationObserver(bind).observe(offlineExpressions.querySelector('.offline-expression-list'),{childList:true});
    }catch(e){
      console.error('Editor matemático local no disponible; se conserva el editor de respaldo:',e);
    }
  }
  attach2DMathFields();
  $('currentProjectName')&&new MutationObserver(renderTitle).observe($('currentProjectName'),{characterData:true,childList:true,subtree:true});
  } else {
    // La API oficial renderiza su propia lista, editor matemático y teclado 2D.
    document.body.classList.add('gmr-real-desmos');
    document.body.dataset.graphEngine='desmos';
    window.__nPrimosCalculator?.resize();
  }
  renderTitle();
  updateEngineButton();
}
function primeKey(key){
  const input=lastPrimeInput;
  if(!input||!document.contains(input))return;
  const field=lastPrimeField && document.contains(lastPrimeField) && !lastPrimeField.hidden ? lastPrimeField : null;
  if(field){
    field.focus({preventScroll:true});
    if(key==='ABC'){
      const btn=keyboard.querySelector('[data-gmr-native]');
      btn?.click();
      return;
    }
    if(key==='enter'){keyboardOpen(false);field.blur();return}
    if(key==='clear'){field.setValue('');input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));return}
    if(key==='left'){field.executeCommand('moveToPreviousChar');return}
    if(key==='right'){field.executeCommand('moveToNextChar');return}
    if(key==='backspace'){field.executeCommand('deleteBackward');return}
    const code={
      '^2':'#@^{2}', '^':'#@^{#?}', '/':'\\frac{#@}{#?}',
      'pi':'\\pi', '*':'\\times ', 'sqrt(':'\\sqrt{#0}',
      'abs(':'\\left|#0\\right|', 'sin(':'\\sin\\left(#0\\right)',
      'cos(':'\\cos\\left(#0\\right)', 'ln(':'\\ln\\left(#0\\right)',
      'log(':'\\log\\left(#0\\right)', 'exp(':'e^{#0}',
      '<':'<', '>':'>'
    };
    field.insert(code[key]||key,{
      insertionMode:'replaceSelection', selectionMode:'placeholder'
    });
    return;
  }
  if(key==='ABC'){input.dataset.androidNative='1';nativeKeyboard(input);return}
  if(key==='enter'){keyboardOpen(false);input.blur();return}
  let a=input.selectionStart??input.value.length,b=input.selectionEnd??a,insert=key;
  if(key==='left'||key==='right'){
    const next=key==='left'?Math.max(0,a-1):Math.min(input.value.length,b+1);
    input.setSelectionRange(next,next);return;
  }
  if(key==='clear'){input.value='';a=0;b=0;insert=''}
  else if(key==='backspace'){if(a===b&&a>0)a--;insert=''}
  else if(key==='pi')insert='pi';
  if(key!=='clear')input.setRangeText(insert,a,b,'end');
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.focus({preventScroll:true});
}
function toggleKeyboard(){
  if(isMate){
    const wasOpen=!$('mathBuilder').hidden;
    $('mathKeyboardToggle').click();
    if(!wasOpen){const editor=$('mathFunctionInput')||$('functionInput');editor.focus({preventScroll:true})}
  }else{
    keyboardOpen(!keyboardVisible);
    if(keyboardVisible){const field=lastPrimeField&&!lastPrimeField.hidden?lastPrimeField:null;if(field)field.focus();else invokeFocus(lastPrimeInput||dock.querySelector('.offline-expression-row input'))}
  }
}
function onAction(action){
  if(action==='close-panel'){closePanel();return}
  if(action==='engine'){toggleGraphEngine();return}
  if(action==='home'){window.location.href='../index.html';return}
  if(action==='algebra-size'){setSize();return}
  if(action==='toggle-keyboard'){toggleKeyboard();return}
  if(action==='controls'){showPanel('controls');return}
  if(action==='analysis'){showPanel('analysis');return}
  if(action==='settings'){showSettings();return}
  if(action==='projects'){
    if(isMate)showPanel('projects');
    else $('projectsBtn')?.click();
    return;
  }
  if(action==='fit'){if(isMate)$('fitBtn2').click();else $('fitPrimesBtn').click();return}
  if(action==='save'){if(isMate)saveMate();else{window.__gmrSaveNPrimos?.();showSaveLabel('Guardado ✓')}return}
  if(action==='add'){
    if(isMate){const editor=$('mathFunctionInput')||$('functionInput');editor.focus({preventScroll:true});if($('mathBuilder').hidden)$('mathKeyboardToggle').click()}
    else{calculatorAdd();keyboardOpen(true)}
  }
}
function calculatorAdd(){
  const button=$('offline-add');
  button?.click();
  const input=dock.querySelector('.offline-expression-row:last-child input');
  if(input){
    input.inputMode='none';lastPrimeInput=input;
    const field=input.parentElement?.querySelector('math-field');
    if(field){lastPrimeField=field;field.focus({preventScroll:true})}
    else{invokeFocus(input);setTimeout(()=>{const m=input.parentElement?.querySelector('math-field');if(m){lastPrimeField=m;m.focus({preventScroll:true})}},80)}
  }
}
root.addEventListener('click',event=>{
  const button=event.target.closest('[data-gmr-action]');
  if(button){event.preventDefault();onAction(button.dataset.gmrAction);return}
  const key=event.target.closest('[data-gmr-key]');
  if(key)primeKey(key.dataset.gmrKey);
});
shade.addEventListener('click',closePanel);
window.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&panelName){closePanel();event.preventDefault()}
});
window.addEventListener('pagehide',()=>{
  if(isMate){try{localStorage.setItem(MATE_SAVE_KEY,JSON.stringify(mateSnapshot()))}catch(_){}}
});
document.body.classList.add('gmr-v2');
notifyResize();

const status = el('div','gmr-status');
graphFrame.append(status);
function setStatus(message='',fade=false){
  status.textContent=message;
  clearTimeout(status._timer);
  if(message&&fade)status._timer=setTimeout(()=>status.textContent='',5500);
}
function updateEngineButton(){
  const button=$('gmr-engine');
  if(!button)return;
  const real=isMate ? mateGraphMode==='desmos' : document.body.dataset.graphEngine==='desmos';
  button.textContent=real?'● Desmos':'◉ '+(isMate?'Geometría':'Local');
  button.setAttribute('aria-label',real?'Motor Desmos real activo, cambiar a local':'Motor local activo, activar Desmos');
  button.title=real?'Graficador oficial de Desmos (requiere red)':'El motor local funciona sin Internet';
}
function mateAsLatex(){
  const input=String($('functionInput')?.value||'x^2').trim();
  // Para geometría el parser permite x, n, funciones y multiplicación implícita.
  // El editor MathLive local genera LaTeX más fiel para el graficador externo.
  const formula='f(x)='+input.replace(/^f\s*\(\s*x\s*\)\s*=\s*/i,'');
  const field=$('mathFunctionInput');
  if(field?.value && String($('functionInput')?.value).trim()===input){
    return 'f(x)='+field.value;
  }
  return formula;
}
function syncMateToDesmos(){
  if(!mateDesmosCalc)return;
  try{
    let latex=mateAsLatex();
    // Field.value incluye sólo el cuerpo de la función, o f(x) completo.
    if(/^f\(x\)=f\(x\)=/.test(latex))latex=latex.replace(/^f\(x\)=/,'');
    mateDesmosCalc.setExpressions([
      {id:'gmr_function',latex,color:window.Desmos.Colors.RED},
      {id:'gmr_parameter',latex:'n='+String($('parameterN')?.value||3),secret:true},
      {id:'gmr_naturals',latex:'N_{gmr}=['+Array.from({length:Math.min(50,Math.max(1,Number($('xMaxInput')?.value||6)-Number($('xMinInput')?.value||1)+1))},(_,i)=>i+Number($('xMinInput')?.value||1)).join(',')+']',secret:true},
      {id:'gmr_samples',latex:'(N_{gmr},f(N_{gmr}))',color:window.Desmos.Colors.RED,lines:false,showLabel:false,pointSize:6}
    ]);
  }catch(error){console.warn('No se pudo actualizar la función en Desmos:',error)}
}
function showMateGeometry(message=''){
  mateGraphMode='geometry';
  document.body.classList.remove('gmr-real-desmos');
  const stageWrap=graphFrame.querySelector('.stage-wrap');
  if(stageWrap)stageWrap.hidden=false;
  if(mateDesmosHost)mateDesmosHost.hidden=true;
  setStatus(message,Boolean(message));
  updateEngineButton();
  notifyResize();
}
async function mountMateDesmos(){
  if(!isMate||mateDesmosBusy)return;
  if(mateDesmosCalc){
    mateGraphMode='desmos';
    document.body.classList.add('gmr-real-desmos');
    graphFrame.querySelector('.stage-wrap').hidden=true;
    mateDesmosHost.hidden=false;
    mateDesmosCalc.resize();
    updateEngineButton();return;
  }
  mateDesmosBusy=true;
  setStatus('Conectando con el graficador oficial de Desmos…');
  try{
    const {loadDesmos}=await import('./desmos-loader.js');
    const DesmosReal=await loadDesmos();
    const host=el('div','gmr-desmos-host');
    graphFrame.append(host);
    const calc=DesmosReal.GraphingCalculator(host,{
      expressions:true, expressionsTopbar:true, graphpaper:true,keypad:true,
      keypadActivated:true, settingsMenu:true, zoomButtons:true,pointsOfInterest:true,
      trace:true, sliders:true, folders:true, notes:true, plotImplicits:true,
      graphDescription:'Gráfica Desmos de funciones estudiadas por Mate-fx',
      language:'es',gestureHandling:'greedy',fontSize:16
    });
    mateDesmosCalc=calc;
    window.__matefxCalculator=calc;
    window.dispatchEvent(new Event('gmr:desmos-ready'));
    mateDesmosHost=host;
    ['functionInput','parameterN','xMinInput','xMaxInput'].forEach(id=>{
      $(id)?.addEventListener('input',syncMateToDesmos);
      $(id)?.addEventListener('change',syncMateToDesmos);
    });
    $('presetGrid')?.addEventListener('click',()=>setTimeout(syncMateToDesmos,120));
    syncMateToDesmos();
    mateGraphMode='desmos';
    document.body.classList.add('gmr-real-desmos');
    graphFrame.querySelector('.stage-wrap').hidden=true;
    setStatus('');
    updateEngineButton();
    requestAnimationFrame(()=>calc.resize());
  }catch(error){
    console.warn('Desmos no disponible, conservando geometría local',error);
    showMateGeometry('Desmos requiere conexión. Se abrió la geometría local.');
  }finally{mateDesmosBusy=false}
}
function toggleGraphEngine(){
  closePanel();
  if(isMate){
    const next=mateGraphMode==='desmos'?'geometry':'desmos';
    localStorage.setItem('gmr:mate:engine',next);
    if(next==='desmos')mountMateDesmos();
    else showMateGeometry();
  }else{
    const next=document.body.dataset.graphEngine==='desmos'?'local':'desmos';
    localStorage.setItem('gmr:nprimos:engine',next);
    const url=new URL(window.location.href);
    url.searchParams.set('engine',next);
    window.location.assign(url.href);
  }
}
if(!isMate){
  if(document.body.dataset.desmosFallback==='1'){
    setStatus('Sin conexión con Desmos: estás usando el simulador local.',true);
  }
  updateEngineButton();
}

