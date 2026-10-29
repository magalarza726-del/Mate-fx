(() => {
  'use strict';

  const STORAGE_KEY = 'nprimos:projects:desmos:v1'; // Estados avanzados separados del motor local
  const MIN_PRIMES = 25;
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

  init();

  function init() {
    if (!store.projects.length) {
      store.projects.push(makeProject('Investigación 1', 25));
      store.currentId = store.projects[0].id;
      persistStore();
    }

    currentProject = store.projects.find(p => p.id === store.currentId) || store.projects[0];
    store.currentId = currentProject.id;

    if (currentProject.state) {
      calculator.setState(currentProject.state);
    } else {
      seedInitialResearch();
    }

    setPrimeCount(currentProject.primeCount || 25, { save: false, fit: !currentProject.state });
    setTableOpen(Boolean(currentProject.showTable), { save: false });
    updateProjectHeader();
    renderProjects();

    calculator.observeEvent('change.nprimos', (_name, event) => {
      if (event && event.isUserInitiated) scheduleSave();
    });

    bindEvents();
    window.__gmrSaveNPrimos = saveCurrentProject;
    saveCurrentProject();
  }

  function bindEvents() {
    els.projectsBtn.addEventListener('click', openProjects);
    els.closeProjectsBtn.addEventListener('click', closeProjects);
    els.backdrop.addEventListener('click', closeProjects);
    els.newProjectBtn.addEventListener('click', () => openNameDialog('new'));
    els.newProjectBtnPanel.addEventListener('click', () => openNameDialog('new'));
    els.projectNameBtn.addEventListener('click', () => openNameDialog('rename'));

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
  }

  function seedInitialResearch() {
    calculator.setBlank();
    calculator.setExpressions([
      { id: 'formula_usuario', latex: 'f(x)=x^{\\frac{1000}{707}}+x^{\\frac{1}{8}}', color: Desmos.Colors.GREEN },
      { id: 'aprox_clasica', latex: 'g(x)=x\\left(\\ln(x)+\\ln(\\ln(x))-1\\right)', color: Desmos.Colors.BLUE }
    ]);
    calculator.setMathBounds({ left: -1, right: 27, bottom: -5, top: 105 });
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
    const count = clampPrimeCount(value);
    els.primeCountInput.value = count;
    els.primeCountSlider.value = count;
    currentProject.primeCount = count;

    const nList = Array.from({ length: count }, (_, i) => i + 1).join(',');
    const pList = allPrimes.slice(0, count).join(',');

    calculator.setExpressions([
      { id: '__np_n', latex: `N_{primos}=[${nList}]`, secret: true },
      { id: '__np_p', latex: `P_{primos}=[${pList}]`, secret: true },
      {
        id: '__np_points',
        latex: '(N_{primos},P_{primos})',
        color: Desmos.Colors.RED,
        pointStyle: Desmos.Styles.POINT,
        pointSize: count > 3000 ? 2.5 : count > 1000 ? 3.5 : 5,
        pointOpacity: count > 3000 ? 0.55 : 0.82,
        lines: false,
        secret: true,
        dragMode: Desmos.DragModes.NONE
      }
    ]);

    if (els.primeTablePanel.classList.contains('open')) renderPrimeTable(count);
    if (options.fit) fitPrimeViewport();
    if (options.save !== false) saveCurrentProject();
  }

  function fitPrimeViewport() {
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
    if (open) renderPrimeTable(currentProject.primeCount || 25);
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

  function makeProject(name, primeCount = 25) {
    return {
      id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name: name || 'Sin título',
      primeCount: clampPrimeCount(primeCount),
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
      currentProject.primeCount = clampPrimeCount(els.primeCountInput.value);
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

    if (next.state) calculator.setState(next.state);
    else calculator.setBlank();

    setPrimeCount(next.primeCount || 25, { save: false });
    setTableOpen(Boolean(next.showTable), { save: false });
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
      if (currentProject.state) calculator.setState(currentProject.state);
      else calculator.setBlank();
      setPrimeCount(currentProject.primeCount || 25, { save: false });
      setTableOpen(Boolean(currentProject.showTable), { save: false });
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
              <div class="project-meta">${(project.primeCount || 25).toLocaleString('es-EC')} primos · ${formatDate(project.updatedAt)}</div>
            </div>
            <div class="project-actions">
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
        if (action === 'delete') deleteProject(id);
      });
    });
  }

  function updateProjectHeader() {
    els.currentProjectName.textContent = currentProject.name;
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

  function openNameDialog(mode) {
    dialogMode = mode;
    if (mode === 'rename') {
      els.nameDialogTitle.textContent = 'Renombrar proyecto';
      els.nameConfirmBtn.textContent = 'Guardar';
      els.nameInput.value = currentProject.name;
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
      currentProject.name = name;
      currentProject.updatedAt = Date.now();
      persistStore();
      updateProjectHeader();
      renderProjects();
    } else {
      saveCurrentProject();
      const project = makeProject(name, 25);
      store.projects.push(project);
      currentProject = project;
      store.currentId = project.id;
      calculator.setBlank();
      setPrimeCount(25, { save: false, fit: true });
      setTableOpen(false, { save: false });
      saveCurrentProject();
      updateProjectHeader();
      renderProjects();
      closeProjects();
    }
    els.nameDialog.close();
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
      if (currentProject.state) calculator.setState(currentProject.state);
      else calculator.setBlank();
      setPrimeCount(currentProject.primeCount || 25, { save: false });
      setTableOpen(Boolean(currentProject.showTable), { save: false });
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
      primeCount: clampPrimeCount(p.primeCount || 25),
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
