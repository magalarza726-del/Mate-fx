(() => {
  'use strict';

  const STORAGE_KEY = 'nprimos:projects:desmos:v1'; // Estados avanzados separados del motor local
  const MIN_PRIMES = 1;
  const EXAMPLE_ID = 'ejemplo-10000-primos';
  const DEFAULT_BOUNDS = {left: -10, right: 40, bottom: -10, top: 150};
  const MAX_PRIMES = 10000;

  const $ = (id) => document.getElementById(id);
  const els = {
    calculator: $('calculator'),
    projectsBtn: $('projectsBtn'),
    projectsPanel: $('projectsPanel'),
    closeProjectsBtn: $('closeProjectsBtn'),
    backdrop: $('backdrop'),
    currentProjectName: $('currentProjectName'),
    projectNameBtn: $('projectNameBtn'),
    saveStatus: $('saveStatus'),
    newProjectBtn: $('newProjectBtn'),
    newProjectBtnPanel: $('newProjectBtnPanel'),
    projectList: $('projectList'),
    exportBtn: $('exportBtn'),
    importInput: $('importInput'),
    primeCountInput: $('primeCountInput'),
    primeCountSlider: $('primeCountSlider'),
    fitPrimesBtn: $('fitPrimesBtn'),
    tableBtn: $('tableBtn'),
    primeTablePanel: $('primeTablePanel'),
    closeTableBtn: $('closeTableBtn'),
    tableSubtitle: $('tableSubtitle'),
    primeTableBody: $('primeTableBody'),
    nameDialog: $('nameDialog'),
    nameForm: $('nameForm'),
    nameDialogTitle: $('nameDialogTitle'),
    nameInput: $('nameInput'),
    nameConfirmBtn: $('nameConfirmBtn')
  };

  if (!window.Desmos) {
    els.calculator.innerHTML = '<div style="padding:24px;font-family:system-ui">No se pudo cargar el motor de Desmos. Revisa tu conexión a Internet e inténtalo de nuevo.</div>';
    return;
  }

  const calculator = Desmos.GraphingCalculator(els.calculator, {
    expressions: true,
    gestureHandling: 'greedy',
    fontSize: 16,
    expressionsTopbar: true,
    keypad: true,
    graphpaper: true,
    settingsMenu: true,
    zoomButtons: true,
    pointsOfInterest: true,
    trace: true,
    folders: true,
    notes: true,
    sliders: true,
    actions: 'auto',
    substitutions: true,
    links: true,
    distributions: true,
    capExpressionSize: false,
    authorFeatures: false
  });

  window.__nPrimosCalculator=calculator;
  window.dispatchEvent(new Event('gmr:desmos-ready'));
  const allPrimes = generateFirstPrimes(MAX_PRIMES);
  let store = loadStore();
  let currentProject = null;
  let saveTimer = null;
  let primeUpdateTimer = null;
  let dialogMode = 'new';
  let tableRenderedCount = 0;
  let renamingProjectId = null;
  window.__gmrPrimeValues = count => allPrimes.slice(0, Math.min(MAX_PRIMES, Math.max(0, Number(count) || 0))); 

  init();

  function init() {
    // La plantilla debe existir también para personas que ya tenían proyectos.
    // No se modifica ni se borra ninguna investigación anterior.
    if (!store.projects.some(p => p.id === EXAMPLE_ID)) {
      const example={...makeProject('Ejemplo · 10 000 números primos', 10000, true), id: EXAMPLE_ID};
      const wasEmpty=!store.projects.length;
      store.projects.unshift(example);
      if (wasEmpty) store.currentId=example.id;
      persistStore();
    }

    currentProject = store.projects.find(p => p.id === store.currentId) || store.projects[0];
    store.currentId = currentProject.id;

    restoreProject(currentProject, true); 
    updateProjectHeader();
    renderProjects();

    calculator.observeEvent('change.nprimos', (_name, event) => {
      if (event && event.isUserInitiated) scheduleSave();
    });

    bindEvents();
    window.__gmrSaveNPrimos = saveCurrentProject;
    window.__gmrExportNPrimosCsv = exportProjectCsv;
    saveCurrentProject();
  }

  function bindEvents() {
    els.projectsBtn.addEventListener('click', openProjects);
    els.closeProjectsBtn.addEventListener('click', closeProjects);
    els.backdrop.addEventListener('click', closeProjects);
    els.newProjectBtn.addEventListener('click', () => openNameDialog('new'));
    els.newProjectBtnPanel.addEventListener('click', () => openNameDialog('new'));
    els.projectNameBtn.addEventListener('click', () => openNameDialog('rename'));

    document.getElementById('enablePrimesBtn')?.addEventListener('click', () => {
      currentProject.hasPrimes=true;
      setPrimeCount(25, {activate:true,fit:true});
      updateProjectHeader();
    });
    els.primeCountInput.addEventListener('input', () => {
      const value = clampPrimeCount(els.primeCountInput.value);
      els.primeCountSlider.value = value;
      schedulePrimeUpdate(value);
    });
    els.primeCountInput.addEventListener('change', () => setPrimeCount(els.primeCountInput.value));
    els.primeCountSlider.addEventListener('input', () => {
      els.primeCountInput.value = els.primeCountSlider.value;
      schedulePrimeUpdate(els.primeCountSlider.value);
    });
    els.primeCountSlider.addEventListener('change', () => setPrimeCount(els.primeCountSlider.value));

    els.fitPrimesBtn.addEventListener('click', fitPrimeViewport);
    els.tableBtn.addEventListener('click', () => setTableOpen(!els.primeTablePanel.classList.contains('open')));
    els.closeTableBtn.addEventListener('click', () => setTableOpen(false));

    els.nameForm.addEventListener('submit', handleNameDialogSubmit);
    els.exportBtn.addEventListener('click', exportProjects);
    els.importInput.addEventListener('change', importProjects);

    window.addEventListener('beforeunload', saveCurrentProject);
    window.addEventListener('resize', () => calculator.resize());
    window.addEventListener('gmr:dataset-imported', event => {
      if (!currentProject || !event.detail || event.detail.lab !== 'prime') return;
      currentProject.dataset = event.detail.dataset;
      scheduleSave();
    });
    window.addEventListener('gmr:dataset-removed', event => {
      if (event.detail?.lab !== 'prime' || !currentProject) return;
      currentProject.dataset = null;
      scheduleSave();
    });
    window.addEventListener('gmr:dataset-request', event => {
      if (event.detail?.lab === 'prime' && typeof event.detail.respond === 'function')
        event.detail.respond(currentProject?.dataset || null);
    });
    // Tras mover el graficador al nuevo panel, vuelve a dimensionarlo y encuádrarlo.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      calculator.resize();
      if (currentProject?.hasPrimes) fitPrimeViewport();
      else if (!validBounds(calculator.getState()?.graph?.viewport)) calculator.setMathBounds(DEFAULT_BOUNDS);
    }));
  }

  function seedInitialResearch() {
    calculator.setBlank();
    calculator.setExpressions([
      { id: 'formula_usuario', latex: 'f(x)=x^{\\frac{1000}{707}}+x^{\\frac{1}{8}}', color: Desmos.Colors.GREEN },
      { id: 'aprox_clasica', latex: 'g(x)=x\\left(\\ln(x)+\\ln(\\ln(x))-1\\right)', color: Desmos.Colors.BLUE }
    ]);
    calculator.setMathBounds({ left: -1, right: 27, bottom: -5, top: 105 });
  }

  function validBounds(b) {
    // Desmos serializa 'xmin/xmax/ymin/ymax'; setMathBounds usa 'left/right/bottom/top'.
    if (!b) return false;
    const coords = 'xmin' in b ? [b.xmin,b.xmax,b.ymin,b.ymax] : [b.left,b.right,b.bottom,b.top];
    const [x0,x1,y0,y1] = coords.map(Number);
    return coords.every(x => x !== undefined && x !== null) &&
      [x0,x1,y0,y1].every(Number.isFinite) && x0 < x1 && y0 < y1 &&
      x1-x0 < 1e13 && y1-y0 < 1e13;
  }

  // Algunos estados guardados antes del arreglo contienen un viewport corrupto.
  // Se restaura el contenido matemático, pero nunca una ventana inválida.
  function safeState(state) {
    if (!state || typeof state !== 'object') return null;
    const result = JSON.parse(JSON.stringify(state));
    if (result.graph && result.graph.viewport && 'left' in result.graph.viewport) {
      const b=result.graph.viewport;
      result.graph.viewport={xmin:Number(b.left),xmax:Number(b.right),ymin:Number(b.bottom),ymax:Number(b.top)};
    }
    if (result.graph && !validBounds(result.graph.viewport)) {
      // No borrar el viewport: Desmos lo necesita al restaurar el estado.
      result.graph.viewport = {xmin:-10,xmax:40,ymin:-10,ymax:150};
      delete result.graph.__v12ViewportLatexStash;
    }
    // Los puntos de primos no forman parte de los datos personales del proyecto.
    // Se regeneran al entrar, sin depender de enormes expresiones serializadas.
    if (result.expressions?.list) {
      result.expressions.list = result.expressions.list.filter(e =>
        !String(e.id || '').startsWith('__np_') && !String(e.id || '').startsWith('__np_table_'));
    }
    return result;
  }

  function restoreProject(project, fit=false) {
    const state = safeState(project.state);
    try { if (state) calculator.setState(state); else calculator.setBlank(); }
    catch (error) { console.warn('Estado anterior no válido; vista nueva:', error); calculator.setBlank(); }
    // El proyecto de ejemplo trae las dos funciones solo en su primera apertura.
    if (project.hasPrimes && project.id === EXAMPLE_ID && !state) seedInitialResearch();
    if (project.hasPrimes) setPrimeCount(project.primeCount || 10000, {save:false,fit});
    else { clearPrimeExpressions(); els.primeCountInput.value = '0'; els.primeCountSlider.value = '0'; }
    setTableOpen(Boolean(project.showTable) && Boolean(project.hasPrimes), {save:false});
    document.body.dataset.primeProject = project.hasPrimes ? 'example' : 'blank';
    window.dispatchEvent(new CustomEvent('gmr:project-switched', {detail:{lab:'prime',dataset:project.dataset || null}}));
  }

  function clearPrimeExpressions() {
    ['__np_n','__np_p','__np_points'].forEach(id => {try {calculator.removeExpression({id})} catch(_){}});
    for (let i=0;i<25;i++) try {calculator.removeExpression({id:'__np_table_'+i})} catch(_) {}
    tableRenderedCount = 0;
    els.primeTableBody.replaceChildren();
    els.tableSubtitle.textContent = 'Proyecto sin datos';
  }

  function generateFirstPrimes(count) {
    let limit = 110000;
    while (true) {
      const composite = new Uint8Array(limit + 1);
      const primes = [];
      for (let i = 2; i <= limit && primes.length < count; i++) {
        if (!composite[i]) {
          primes.push(i);
          if (i * i <= limit) {
            for (let j = i * i; j <= limit; j += i) composite[j] = 1;
          }
        }
      }
      if (primes.length >= count) return primes;
      limit *= 2;
    }
  }

  function clampPrimeCount(value) {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n)) return MIN_PRIMES;
    return Math.min(MAX_PRIMES, Math.max(MIN_PRIMES, n));
  }

  function schedulePrimeUpdate(value) {
    window.clearTimeout(primeUpdateTimer);
    primeUpdateTimer = window.setTimeout(() => setPrimeCount(value), 90);
  }

  function setPrimeCount(value, options = {}) {
    if (!currentProject.hasPrimes) {
      if (!options.activate) return;
      currentProject.hasPrimes = true;
    }
    const count = clampPrimeCount(value);
    els.primeCountInput.value = count;
    els.primeCountSlider.value = count;
    currentProject.primeCount = count;

    // Dividir los 10 000 puntos en tablas moderadas evita una sola expresión
    // gigantesca que puede bloquear Desmos y contaminar el estado persistente.
    const CHUNK = 500;
    const required = Math.ceil(count / CHUNK);
    if (document.body.dataset.graphEngine === 'local') {
      const nList = Array.from({length:count}, (_,i)=>i+1).join(',');
      const pList = allPrimes.slice(0,count).join(',');
      calculator.setExpressions([
        {id:'__np_n',latex:`N_{primos}=[${nList}]`,secret:true},
        {id:'__np_p',latex:`P_{primos}=[${pList}]`,secret:true},
        {id:'__np_points',latex:'(N_{primos},P_{primos})',secret:true,color:Desmos.Colors.RED}
      ]);
    } else {
      for (let chunk=0;chunk<required;chunk++) {
        const first=chunk*CHUNK, last=Math.min(count,first+CHUNK);
        const xs=[],ys=[];
        for(let i=first;i<last;i++){xs.push(String(i+1));ys.push(String(allPrimes[i]));}
        calculator.setExpression({type:'table',id:'__np_table_'+chunk,secret:true,columns:[
          {latex:`n_{${chunk}}`,values:xs},
          {latex:`p_{${chunk}}`,values:ys,color:Desmos.Colors.RED,points:true,lines:false}
        ]});
      }
      for (let chunk=required;chunk<25;chunk++) try {calculator.removeExpression({id:'__np_table_'+chunk})}catch(_){}
      // Mantener N_primos para el análisis de funciones solo cuando sea manejable.
      // Los 10 000 valores reales se consultan directamente desde allPrimes.
      if (count<=1000) calculator.setExpressions([
        {id:'__np_n',latex:`N_{primos}=[${Array.from({length:count},(_,i)=>i+1).join(',')}]`,secret:true},
        {id:'__np_p',latex:`P_{primos}=[${allPrimes.slice(0,count).join(',')}]`,secret:true}
      ]);
      else for(const id of ['__np_n','__np_p','__np_points'])try{calculator.removeExpression({id})}catch(_){}
    }
    if (els.primeTablePanel.classList.contains('open')) renderPrimeTable(count);
    if (options.fit) fitPrimeViewport();
    if (options.save !== false) saveCurrentProject();
  }

  function fitPrimeViewport() {
    if (!currentProject?.hasPrimes) {
      calculator.setMathBounds(DEFAULT_BOUNDS);
      return;
    }
    const count = clampPrimeCount(currentProject.primeCount);
    const lastPrime = allPrimes[count - 1];
    const xPad = Math.max(2, count * 0.04);
    const yPad = Math.max(5, lastPrime * 0.05);
    calculator.setMathBounds({
      left: -xPad,
      right: count + xPad,
      bottom: -yPad * 0.3,
      top: lastPrime + yPad
    });
  }

  function setTableOpen(open, options = {}) {
    els.primeTablePanel.classList.toggle('open', open);
    els.primeTablePanel.setAttribute('aria-hidden', String(!open));
    els.tableBtn.setAttribute('aria-pressed', String(open));
    currentProject.showTable = open;
    if (open && currentProject.hasPrimes) renderPrimeTable(currentProject.primeCount || 25);
    if (options.save !== false) saveCurrentProject();
  }

  function renderPrimeTable(count) {
    count = clampPrimeCount(count);
    els.tableSubtitle.textContent = `Primeros ${count.toLocaleString('es-EC')} primos`;
    if (tableRenderedCount === count) return;

    const rows = new Array(count);
    for (let i = 0; i < count; i++) {
      rows[i] = `<tr><td>${i + 1}</td><td>${allPrimes[i]}</td></tr>`;
    }
    els.primeTableBody.innerHTML = rows.join('');
    tableRenderedCount = count;
  }

  function makeProject(name, primeCount = 0, hasPrimes = false) {
    return {
      id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name: name || 'Sin título',
      primeCount: hasPrimes ? clampPrimeCount(primeCount) : 0,
      hasPrimes,
      dataset: null,
      showTable: false,
      state: null,
      updatedAt: Date.now()
    };
  }

  function scheduleSave() {
    setSaveStatus('Guardando…');
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveCurrentProject, 550);
  }

  function saveCurrentProject() {
    if (!currentProject) return;
    try {
      currentProject.state = calculator.getState();
      currentProject.primeCount = currentProject.hasPrimes ? clampPrimeCount(els.primeCountInput.value) : 0;
      currentProject.state = safeState(currentProject.state);
      currentProject.showTable = els.primeTablePanel.classList.contains('open');
      currentProject.updatedAt = Date.now();
      persistStore();
      setSaveStatus('Guardado');
      renderProjects();
    } catch (error) {
      console.error(error);
      setSaveStatus('Error al guardar');
    }
  }

  function setSaveStatus(text) {
    els.saveStatus.textContent = text;
  }

  function switchProject(id) {
    if (id === currentProject.id) {
      closeProjects();
      return;
    }
    saveCurrentProject();
    const next = store.projects.find(p => p.id === id);
    if (!next) return;

    currentProject = next;
    store.currentId = next.id;
    persistStore();

    restoreProject(next, true);
    updateProjectHeader();
    renderProjects();
    closeProjects();
  }

  function deleteProject(id) {
    if (store.projects.length <= 1) {
      alert('Debe existir al menos un proyecto.');
      return;
    }
    const project = store.projects.find(p => p.id === id);
    if (!project || !confirm(`¿Eliminar “${project.name}”?`)) return;

    const wasCurrent = currentProject.id === id;
    store.projects = store.projects.filter(p => p.id !== id);

    if (wasCurrent) {
      currentProject = store.projects[0];
      store.currentId = currentProject.id;
      restoreProject(currentProject, true);
      updateProjectHeader();
    }
    persistStore();
    renderProjects();
  }

  function duplicateProject(id) {
    saveCurrentProject();
    const source = store.projects.find(p => p.id === id);
    if (!source) return;
    const copy = JSON.parse(JSON.stringify(source));
    copy.id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    copy.name = `${source.name} — copia`;
    copy.updatedAt = Date.now();
    store.projects.push(copy);
    persistStore();
    renderProjects();
  }

  function renderProjects() {
    if (!currentProject) return;
    els.projectList.innerHTML = store.projects
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(project => {
        const active = project.id === currentProject.id ? ' active' : '';
        return `
          <div class="project-card${active}" data-id="${escapeAttr(project.id)}">
            <div class="project-main" data-action="open">
              <div class="project-name">${escapeHtml(project.name)}</div>
              <div class="project-meta">${project.hasPrimes ? (project.primeCount || 0).toLocaleString('es-EC')+' primos' : (project.dataset ? 'Datos importados' : 'En blanco')} · ${formatDate(project.updatedAt)}</div>
            </div>
            <div class="project-actions">
              <button class="mini-btn" title="Renombrar" aria-label="Renombrar proyecto" data-action="rename">✎</button>
              <button class="mini-btn" title="Exportar CSV" aria-label="Exportar CSV" data-action="csv">CSV</button>
              <button class="mini-btn" title="Duplicar" data-action="duplicate">⧉</button>
              <button class="mini-btn danger" title="Eliminar" data-action="delete">×</button>
            </div>
          </div>`;
      }).join('');

    els.projectList.querySelectorAll('.project-card').forEach(card => {
      card.addEventListener('click', (event) => {
        const action = event.target.closest('[data-action]')?.dataset.action;
        const id = card.dataset.id;
        if (action === 'open') switchProject(id);
        if (action === 'duplicate') duplicateProject(id);
        if (action === 'rename') openNameDialog('rename', id);
        if (action === 'csv') exportProjectCsv(id);
        if (action === 'delete') deleteProject(id);
      });
    });
  }

  function updateProjectHeader() {
    els.currentProjectName.textContent = currentProject.name;
    document.getElementById('primeTools')?.classList.toggle('is-empty', !currentProject.hasPrimes);
    document.title = `${currentProject.name} · nPrimos`;
  }

  function openProjects() {
    renderProjects();
    els.projectsPanel.classList.add('open');
    els.projectsPanel.setAttribute('aria-hidden', 'false');
    els.backdrop.hidden = false;
  }

  function closeProjects() {
    els.projectsPanel.classList.remove('open');
    els.projectsPanel.setAttribute('aria-hidden', 'true');
    els.backdrop.hidden = true;
  }

  function openNameDialog(mode, id = null) {
    dialogMode = mode;
    renamingProjectId = id || currentProject.id;
    if (mode === 'rename') {
      els.nameDialogTitle.textContent = 'Renombrar proyecto';
      els.nameConfirmBtn.textContent = 'Guardar';
      els.nameInput.value = store.projects.find(p=>p.id===renamingProjectId)?.name || currentProject.name;
    } else {
      els.nameDialogTitle.textContent = 'Nuevo proyecto';
      els.nameConfirmBtn.textContent = 'Crear';
      els.nameInput.value = `Investigación ${store.projects.length + 1}`;
    }
    els.nameDialog.showModal();
    requestAnimationFrame(() => {
      els.nameInput.focus();
      els.nameInput.select();
    });
  }

  function handleNameDialogSubmit(event) {
    event.preventDefault();
    const name = els.nameInput.value.trim();
    if (!name) return;

    if (dialogMode === 'rename') {
      const target = store.projects.find(p=>p.id===renamingProjectId) || currentProject;
      target.name = name;
      target.updatedAt = Date.now();
      persistStore();
      updateProjectHeader();
      renderProjects();
    } else {
      saveCurrentProject();
      const project = makeProject(name);
      store.projects.push(project);
      currentProject = project;
      store.currentId = project.id;
      restoreProject(project, true);
      saveCurrentProject();
      updateProjectHeader();
      renderProjects();
      closeProjects();
    }
    els.nameDialog.close();
  }

  function csvEscape(value) {
    const s = String(value ?? '');
    return /[";,\r\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
  }
  function downloadCsv(filename, rows) {
    const body = '\uFEFF'+rows.map(row=>row.map(csvEscape).join(';')).join('\r\n')+'\r\n';
    const url=URL.createObjectURL(new Blob([body],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=filename;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function exportProjectCsv(id) {
    if(id===currentProject.id) saveCurrentProject();
    const project=store.projects.find(p=>p.id===id);
    if (!project) return;
    let rows;
    if (project.dataset && Array.isArray(project.dataset.rows))
      rows=[project.dataset.headers, ...project.dataset.rows];
    else if (project.hasPrimes)
      rows=[['n','p_n'],...allPrimes.slice(0,project.primeCount||10000).map((value,i)=>[i+1,value])];
    else rows=[['x','y']]; // proyecto completamente vacío: exportación válida sin datos ficticios
    const safe=project.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,65)||'investigacion';
    downloadCsv(safe+'.csv',rows);
  }

  function exportProjects() {
    saveCurrentProject();
    const payload = {
      app: 'nPrimos',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: store
    };
    if (window.AndroidBridge && typeof window.AndroidBridge.exportJson === 'function') { window.AndroidBridge.exportJson('nprimos-proyectos-'+new Date().toISOString().slice(0,10)+'.json', JSON.stringify(payload)); return; }
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nprimos-proyectos-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importProjects(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const incoming = parsed?.app === 'nPrimos' ? parsed.data : parsed;
      if (!incoming || !Array.isArray(incoming.projects) || !incoming.projects.length) throw new Error('Formato inválido');
      if (!confirm('Esto reemplazará los proyectos guardados en este navegador. ¿Continuar?')) return;
      store = normalizeStore(incoming);
      currentProject = store.projects.find(p => p.id === store.currentId) || store.projects[0];
      store.currentId = currentProject.id;
      persistStore();
      restoreProject(currentProject, true);
      updateProjectHeader();
      renderProjects();
    } catch (error) {
      console.error(error);
      alert('No pude importar ese archivo. Verifica que sea una exportación válida de nPrimos.');
    }
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return normalizeStore({ projects: [], currentId: null });
      return normalizeStore(JSON.parse(raw));
    } catch (error) {
      console.warn('No se pudo leer el almacenamiento local:', error);
      return normalizeStore({ projects: [], currentId: null });
    }
  }

  function normalizeStore(input) {
    const projects = Array.isArray(input?.projects) ? input.projects.map(p => ({
      id: String(p.id || `p_${Date.now()}_${Math.random()}`),
      name: String(p.name || 'Sin título').slice(0, 80),
      primeCount: p.hasPrimes === false ? 0 : clampPrimeCount(p.primeCount || 25),
      hasPrimes: p.hasPrimes === undefined ? Boolean(p.primeCount && p.primeCount > 0) : Boolean(p.hasPrimes),
      dataset: p.dataset && Array.isArray(p.dataset.rows) ? p.dataset : null,
      showTable: Boolean(p.showTable),
      state: p.state || null,
      updatedAt: Number(p.updatedAt) || Date.now()
    })) : [];
    return { version: 1, projects, currentId: input?.currentId || projects[0]?.id || null };
  }

  function persistStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (error) {
      console.error('Almacenamiento lleno o no disponible:', error);
      setSaveStatus('Almacenamiento lleno');
    }
  }

  function formatDate(timestamp) {
    try {
      return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
    } catch {
      return '';
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();