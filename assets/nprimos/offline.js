import { compileExpression } from '../matefx/src/math.js';

const COLORS = {RED:'#d64c4c', BLUE:'#3578db', GREEN:'#2d9b6c', PURPLE:'#9164cf', ORANGE:'#e39b30', BLACK:'#253350'};
const PALETTE = [COLORS.GREEN,COLORS.BLUE,COLORS.PURPLE,COLORS.ORANGE,COLORS.BLACK];
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function latexToMath(input) {
  let s = String(input).trim();
  s = s.replace(/^\s*(?:[a-z]\s*\(\s*x\s*\)|y)\s*=/i,'');
  for(let i=0;i<8;i++){
    const prev=s;
    s=s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,'($1/$2)');
    if(s===prev)break;
  }
  return s.replace(/\\(?:left|right)/g,'')
    .replace(/\\operatorname\s*\{([^{}]+)\}/g,'$1')
    .replace(/\\(?:cdot|times)/g,'*')
    .replace(/\\(?:ln|log|sin|cos|tan|sqrt|pi|exp|abs)/g,m=>m.slice(1))
    .replace(/[{}]/g,m=>m==='{'?'(':')')
    .replace(/\\,/g,'').replace(/\\ /g,' ')
    .replace(/−/g,'-');
}

function displayExpression(latex) {
  const source = String(latex || '');
  const definition = source.match(/^\s*([a-z][a-z0-9_]*\s*\(\s*x\s*\)\s*=)/i);
  if (!definition) return source;
  return definition[1] + latexToMath(source);
}

function compileDefinition(latex) {
  try { return { fn:compileExpression(latexToMath(latex)), error:'' }; }
  catch(e) { return {fn:null,error:e.message || 'Expresión inválida'}; }
}
function calc(el) {
  let expressions=[], bounds={left:-1,right:27,bottom:-5,top:105}, primes=[],indices=[];
  const active=new Map();
  let pinch=null, pointer=null, observers=[];
  let frame=0, userSaveTimeout=0;
  const compilerCache = new Map();
  function compiledFor(item) {
    const hit=compilerCache.get(item.id);
    if(hit?.latex===item.latex)return hit.result;
    const result=compileDefinition(item.latex||'');
    compilerCache.set(item.id,{latex:item.latex,result});
    return result;
  }
  function draw(){
    if(frame)return;
    frame=requestAnimationFrame(()=>{frame=0;paintFrame()});
  }
  function deferSave() {
    clearTimeout(userSaveTimeout);
    userSaveTimeout=setTimeout(()=>emit(true),180);
  }
  el.innerHTML='<div class="offline-shell"><section class="offline-expressions"><div class="offline-expressions-heading"><div><b>Funciones</b><small>Evaluación local, sin Internet</small></div><button type="button" id="offline-add" aria-label="Añadir función">＋</button></div><div id="offline-expression-list" class="offline-expression-list"></div><div class="offline-help">Ejemplos: <code>f(x)=x²</code> · <code>g(x)=x(ln(x)+ln(ln(x))-1)</code><p>El motor local admite funciones explícitas, potencias, logaritmos y trigonometría. No incluye todas las herramientas avanzadas de Desmos.</p></div></section><div class="offline-graph"><canvas aria-label="Gráfica interactiva de funciones y números primos"></canvas><div class="offline-graph-actions"><button type="button" data-zoom="in">＋</button><button type="button" data-zoom="out">−</button><button type="button" data-zoom="reset">⌖</button></div><div class="offline-graph-caption">Arrastra para mover · Pellizca o usa +/− para ampliar</div></div></div>';
  const list=el.querySelector('#offline-expression-list'), graph=el.querySelector('.offline-graph'), canvas=el.querySelector('canvas'),ctx=canvas.getContext('2d');
  const emit=(initiated=false)=>{observers.forEach(x=>{try{x('change',{isUserInitiated:initiated})}catch(e){console.warn(e)}});};
  function stateList(){return expressions.filter(x=>!x.secret).map(x=>({type:'expression',...x}));}
  function setExpressions(items){
    for(const item of items){
      const p=expressions.findIndex(e=>e.id===item.id);
      if(p>=0) expressions[p]={...expressions[p],...item};else expressions.push({...item,type:'expression'});
      if(item.id==='__np_n'&&item.latex) indices=item.latex.slice(item.latex.indexOf('[')+1,item.latex.lastIndexOf(']')).split(',').map(Number);
      if(item.id==='__np_p'&&item.latex) primes=item.latex.slice(item.latex.indexOf('[')+1,item.latex.lastIndexOf(']')).split(',').map(Number);
    }
    drawRows();draw();emit();
  }
  function drawRows(){
    const user=expressions.filter(x=>!x.secret);
    if(list.childElementCount===user.length && user.every((e,i)=>list.children[i].dataset.id===e.id)){
      for(let i=0;i<user.length;i++){
        const row=list.children[i],input=row.querySelector('input');
        row.dataset.index=i+1;
        const preferred=displayExpression(user[i].latex)||'';
        const editor=row.querySelector('math-field');
        if(document.activeElement!==input && document.activeElement!==editor && input.value!==preferred){
          input.value=preferred;
          input.dispatchEvent(new Event('gmr-sync'));
        }
      }
      return;
    }
    list.replaceChildren();
    for(const item of user){
      const line=document.createElement('div');line.className='offline-expression-row';line.dataset.id=item.id;line.dataset.index=user.indexOf(item)+1;
      line.innerHTML='<button type="button" class="offline-color" aria-label="Ocultar o mostrar función" title="Ocultar o mostrar función"></button><input spellcheck="false" type="text" aria-label="Función matemática" placeholder="f(x)=x²"><button type="button" class="offline-delete" title="Quitar función" aria-label="Eliminar función">×</button><span class="offline-expression-error"></span>';
      const swatch=line.querySelector('.offline-color');swatch.style.background=item.color||COLORS.BLUE;
      line.classList.toggle('is-hidden',Boolean(item.hidden));
      swatch.addEventListener('click',()=>{item.hidden=!item.hidden;line.classList.toggle('is-hidden',Boolean(item.hidden));draw();emit(true)});
      const input=line.querySelector('input');input.value=displayExpression(item.latex||'');
      let t;
      input.addEventListener('input',()=>{item.latex=input.value;clearTimeout(t);t=setTimeout(()=>{draw();emit(true)},220)});
      input.addEventListener('change',()=>{item.latex=input.value;draw();emit(true)});
      line.querySelector('.offline-delete').addEventListener('click',()=>{expressions=expressions.filter(e=>e.id!==item.id);drawRows();draw();emit(true)});
      list.append(line);
    }
  }
  el.querySelector('#offline-add').addEventListener('click',()=>{
    const id='f_'+Date.now()+'_'+Math.random().toString(36).slice(2,5);
    expressions.push({id,latex:'h(x)=sqrt(x)',color:PALETTE[expressions.length%PALETTE.length],type:'expression'});
    drawRows();draw();emit(true);list.lastElementChild?.querySelector('input')?.focus();
  });
  const px=x=>(x-bounds.left)/(bounds.right-bounds.left)*canvas.clientWidth;
  const py=y=>(bounds.top-y)/(bounds.top-bounds.bottom)*canvas.clientHeight;
  const xp=p=>bounds.left+p/canvas.clientWidth*(bounds.right-bounds.left);
  const yp=p=>bounds.top-p/canvas.clientHeight*(bounds.top-bounds.bottom);
  function smartStep(span){
    const order=Math.pow(10,Math.floor(Math.log10(Math.max(span,1e-9)/8)));
    return [1,2,5,10].map(m=>m*order).find(v=>span/v<=11)||order*10;
  }
  function paintFrame(){
    const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight),dpr=Math.min(2,devicePixelRatio||1);
    if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr)}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
    ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
    const sx=smartStep(bounds.right-bounds.left),sy=smartStep(bounds.top-bounds.bottom);
    ctx.lineWidth=1;ctx.strokeStyle='#e6ecf3';ctx.fillStyle='#8794a6';ctx.font='11px system-ui';
    for(let x=Math.ceil(bounds.left/sx)*sx,i=0;x<=bounds.right&&i<100;i++,x+=sx){
      const xx=px(x);ctx.beginPath();ctx.moveTo(xx,0);ctx.lineTo(xx,height);ctx.stroke();ctx.fillText(Number(x.toPrecision(4)).toString(),Math.min(width-24,xx+3),height-8);
    }
    for(let y=Math.ceil(bounds.bottom/sy)*sy,i=0;y<=bounds.top&&i<100;i++,y+=sy){
      const yy=py(y);ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(width,yy);ctx.stroke();ctx.fillText(Number(y.toPrecision(4)).toString(),7,Math.max(12,yy-4));
    }
    ctx.strokeStyle='#9cacc0';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(px(0),0);ctx.lineTo(px(0),height);ctx.moveTo(0,py(0));ctx.lineTo(width,py(0));ctx.stroke();
    if(primes.length){
      ctx.fillStyle=COLORS.RED;
      // Solo renderiza los puntos visibles: no recorrer 10 000 en cada desplazamiento.
      const first=Math.max(0,Math.floor(bounds.left)-1);
      const last=Math.min(primes.length,Math.ceil(bounds.right)+2);
      const stride=Math.max(1,Math.floor((last-first)/Math.max(500,width*2)));
      for(let i=first;i<last;i+=stride){
        const x=px(i+1),y=py(primes[i]);
        if(x>=-4&&x<=width+4&&y>=-4&&y<=height+4){ctx.beginPath();ctx.arc(x,y,primes.length>1500?1.65:2.7,0,Math.PI*2);ctx.fill()}
      }
    }
    expressions.filter(x=>!x.secret).forEach((e,j)=>{
      const row=list.children[j], compiled=compiledFor(e);
      if(row){const err=row.querySelector('.offline-expression-error');err.textContent=compiled.error;row.classList.toggle('invalid',Boolean(compiled.error))}
      if(!compiled.fn||e.hidden)return;
      ctx.strokeStyle=e.color||COLORS.BLUE;ctx.lineWidth=2.6;ctx.beginPath();let live=false;
      const samples=Math.min(1500,Math.max(240,Math.round(width)));
      for(let i=0;i<=samples;i++){
        const xx=i/samples*width,x=xp(xx),y=compiled.fn(x),yy=py(y);
        if(!Number.isFinite(yy)||Math.abs(yy)>height*10){live=false;continue}
        if(!live){ctx.moveTo(xx,yy);live=true}else ctx.lineTo(xx,yy);
      }
      ctx.stroke();
    });
    ctx.restore();
  }
  function zoom(factor,x=canvas.clientWidth/2,y=canvas.clientHeight/2){
    const xx=xp(x),yy=yp(y),w=(bounds.right-bounds.left)*factor,h=(bounds.top-bounds.bottom)*factor;
    const rx=x/canvas.clientWidth,ry=y/canvas.clientHeight;
    bounds={left:xx-w*rx,right:xx+w*(1-rx),top:yy+h*ry,bottom:yy-h*(1-ry)};
    draw();deferSave();
  }
  el.querySelectorAll('[data-zoom]').forEach(b=>b.addEventListener('click',()=>{
    const k=b.dataset.zoom;if(k==='reset') api.setMathBounds({left:-1,right:27,bottom:-5,top:105});else zoom(k==='in'?0.75:1.333);
  }));
  canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoom(e.deltaY>0?1.16:0.86,e.clientX-r.left,e.clientY-r.top)},{passive:false});
  canvas.style.touchAction='none';
  canvas.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse' && e.button!==0)return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    active.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(active.size===1)pointer={x:e.clientX,y:e.clientY};
    if(active.size===2){pinch=null;pointer=null}
  },{passive:false});
  canvas.addEventListener('pointermove',e=>{
    if(!active.has(e.pointerId))return;
    active.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(active.size>=2){
      const p=[...active.values()];
      const dist=Math.max(1,Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y));
      const rect=canvas.getBoundingClientRect();
      const mx=(p[0].x+p[1].x)/2-rect.left;
      const my=(p[0].y+p[1].y)/2-rect.top;
      if(pinch){
        const worldX=xp(pinch.x),worldY=yp(pinch.y);
        const factor=Math.max(.75,Math.min(1.34,pinch.distance/dist));
        const w=(bounds.right-bounds.left)*factor,h=(bounds.top-bounds.bottom)*factor;
        bounds={
          left:worldX-(mx/canvas.clientWidth)*w,
          right:worldX+(1-mx/canvas.clientWidth)*w,
          top:worldY+(my/canvas.clientHeight)*h,
          bottom:worldY-(1-my/canvas.clientHeight)*h
        };
        draw();
      }
      pinch={x:mx,y:my,distance:dist};
      return;
    }
    if(pointer&&active.size===1){
      const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
      const wx=(bounds.right-bounds.left)/canvas.clientWidth;
      const wy=(bounds.top-bounds.bottom)/canvas.clientHeight;
      bounds={left:bounds.left-dx*wx,right:bounds.right-dx*wx,
              bottom:bounds.bottom+dy*wy,top:bounds.top+dy*wy};
      pointer={x:e.clientX,y:e.clientY};
      draw();
    }
  },{passive:true});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])
    canvas.addEventListener(type,e=>{
      if(!active.has(e.pointerId))return;
      active.delete(e.pointerId);
      if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
      pinch=null;
      pointer=active.size===1?{...active.values().next().value}:null;
      deferSave();
    });
  const api={
    setBlank(){expressions=[];primes=[];indices=[];drawRows();draw();emit()},
    setExpressions,
    setMathBounds(b){if(Object.values(b).every(Number.isFinite)&&b.right>b.left&&b.top>b.bottom){bounds={...b};draw();emit()}},
    getState(){return {expressions:{list:stateList()},graph:{viewport:{...bounds}}}},
    setState(state){expressions=(state?.expressions?.list||[]).filter(e=>e.type==='expression'&&!e.secret).map(e=>({...e}));primes=[];indices=[];const b=state?.graph?.viewport;if(b&&b.right>b.left&&b.top>b.bottom)bounds={...b};drawRows();draw();emit()},
    observeEvent(_name,cb){observers.push(cb)},
    resize(){draw()},
    HelperExpression({latex}){
      const result={
        observe(_key,cb){queueMicrotask(()=>cb('change',result))},
        unobserve(){},
        get listValue(){
          if(latex==='P_{primos}')return primes.slice();
          if(latex==='N_{primos}')return indices.slice();
          const m=String(latex).match(/^([a-z][\w]*)\(N_\{primos\}\)$/i);
          if(!m)return [];
          const def=expressions.find(e=>!e.secret&&new RegExp('^\\s*'+m[1]+'\\s*\\(\\s*x\\s*\\)\\s*=').test(e.latex||''));
          if(!def)return [];
          const {fn}=compiledFor(def);
          return fn?indices.map(x=>fn(x)):[];
        },
        get numericValue(){return NaN}
      };return result;
    }
  };
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>draw()).observe(graph);
  window.addEventListener('resize',draw);drawRows();requestAnimationFrame(draw);
  return api;
}
window.Desmos={Colors:COLORS,Styles:{POINT:'POINT'},DragModes:{NONE:'NONE'},GraphingCalculator:calc};
await import('./analysis-table.js');
await import('./app.js');
await import('../shared/lab.js');
