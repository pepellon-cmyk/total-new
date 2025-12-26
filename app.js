// Protótipo: mapeamento automático de abas/colunas para avaliação de desempenho
// Dependências: XLSX (SheetJS), Chart.js (incluídos via CDN no HTML)

// Elementos
const fileInput = document.getElementById('fileInput');
const sheetSelect = document.getElementById('sheetSelect');
const sheetsList = document.getElementById('sheetsList');
const loadedSheetEl = document.getElementById('loadedSheet');
const mappingPanel = document.getElementById('mappingPanel');
const autoMapBtn = document.getElementById('autoMapBtn');
const applyMapBtn = document.getElementById('applyMapBtn');

const kpisEl = document.getElementById('kpis');
const scoreCtx = document.getElementById('scoreChart').getContext('2d');
const tableWrap = document.getElementById('tableWrap');

const searchInput = document.getElementById('searchInput');
const filterStatus = document.getElementById('filterStatus');
const addBtn = document.getElementById('addBtn');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');
const formPanel = document.getElementById('formPanel');
const evalForm = document.getElementById('evalForm');
const cancelEditBtn = document.getElementById('cancelEdit');

let state = {
  workbook: null,
  sheetNames: [],
  rawSheets: {}, // sheetName -> array of objects (sheet_to_json)
  currentSheet: null,
  headersBySheet: {}, // sheetName -> array of header names (order)
  mappingBySheet: {}, // sheetName -> { Nome: headerX, ... }
  data: [], // array of standardized objects { Nome, Matrícula, Cargo, Data, Nota, Comentários, Status, ...}
  headers: [], // standardized field keys available
  chart: null,
  page: 1,
  pageSize: 10,
  editIndex: null
};

const STORAGE_KEY = 'kite_map_proto_v1';

// Util: persistência simples
function saveStateToStorage() {
  const payload = {
    sheetNames: state.sheetNames,
    rawSheets: state.rawSheets,
    headersBySheet: state.headersBySheet,
    mappingBySheet: state.mappingBySheet,
    currentSheet: state.currentSheet,
    data: state.data
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
function loadStateFromStorage() {
  const s = localStorage.getItem(STORAGE_KEY);
  if (!s) return false;
  try {
    const p = JSON.parse(s);
    state.sheetNames = p.sheetNames || [];
    state.rawSheets = p.rawSheets || {};
    state.headersBySheet = p.headersBySheet || {};
    state.mappingBySheet = p.mappingBySheet || {};
    state.currentSheet = p.currentSheet || null;
    state.data = p.data || [];
    return true;
  } catch (e) { return false; }
}

// Helpers de detecção
const SHEET_NAME_PATTERNS = [/avali/i, /evalu/i, /desempenho/i, /performance/i, /colaborad/i, /employees?/i];

function findBestSheet(names) {
  // retorna primeira que bater nas patterns, senão a primeira
  for (let p of SHEET_NAME_PATTERNS) {
    const hit = names.find(n => p.test(n));
    if (hit) return hit;
  }
  return names.length ? names[0] : null;
}

const STANDARD_FIELDS = ['Nome','Matrícula','Cargo','Data','Nota','Comentários','Status'];

// Leitura do arquivo (XLSX)
fileInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const data = evt.target.result;
    const workbook = XLSX.read(data, { type: 'binary' });
    state.workbook = workbook;
    state.sheetNames = workbook.SheetNames.slice();
    // converter cada aba para array de objetos sem assumir cabeçalho fixo
    workbook.SheetNames.forEach(name => {
      // obter matriz para inferir cabeçalhos
      const sheet = workbook.Sheets[name];
      // usar sheet_to_json com header:1 para ter a primeira linha como array
      const arr = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      // Extrair headers: a primeira linha não vazia
      let headers = [];
      for (let r of arr) {
        if (r && r.some(c => String(c).trim() !== '')) {
          headers = r.map(h => String(h).trim());
          break;
        }
      }
      // também gerar array de objetos com header row (sheet_to_json normal)
      const objs = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      state.rawSheets[name] = objs;
      state.headersBySheet[name] = headers.length ? headers : guessHeadersFromObjects(objs);
    });
    // escolher aba automaticamente
    state.currentSheet = findBestSheet(state.sheetNames);
    saveStateToStorage();
    renderAfterLoad();
  };
  reader.readAsBinaryString(f);
});

// tenta inferir headers quando não há linha de headers: union das chaves
function guessHeadersFromObjects(objs) {
  const s = new Set();
  objs.forEach(o => Object.keys(o).forEach(k => s.add(String(k))));
  return Array.from(s);
}

// render após carregar workbook ou carregar do storage
function renderAfterLoad() {
  // preencher lista de abas
  sheetSelect.innerHTML = '';
  sheetsList.innerHTML = '';
  state.sheetNames.forEach(name => {
    const opt = document.createElement('option'); opt.value = name; opt.textContent = name;
    sheetSelect.appendChild(opt);
    const li = document.createElement('li'); li.textContent = name + (name === state.currentSheet ? ' (selecionada)' : '');
    sheetsList.appendChild(li);
  });
  if (state.currentSheet) sheetSelect.value = state.currentSheet;
  loadedSheetEl.textContent = state.currentSheet ? `Aba: ${state.currentSheet}` : 'Nenhuma aba carregada';

  // construir painel de mapeamento com selects usando headers detectados
  buildMappingPanel();

  // se já houver um mapeamento salvo, aplicar automaticamente
  if (state.mappingBySheet[state.currentSheet]) {
    // aplicar mapeamento salvo
    applyMapping(state.mappingBySheet[state.currentSheet]);
  }
}

// Constroi UI de mapeamento (selects)
function buildMappingPanel() {
  mappingPanel.innerHTML = '';
  const headers = state.headersBySheet[state.currentSheet] || [];
  const options = [''].concat(headers);
  STANDARD_FIELDS.forEach(field => {
    const lbl = document.createElement('label');
    lbl.textContent = field;
    const sel = document.createElement('select');
    sel.name = field;
    options.forEach(o => {
      const opt = document.createElement('option'); opt.value = o; opt.textContent = o || '(não mapear)';
      sel.appendChild(opt);
    });
    // se existir mapping salvo, selecionar
    const saved = state.mappingBySheet[state.currentSheet] && state.mappingBySheet[state.currentSheet][field];
    if (saved) sel.value = saved;
    mappingPanel.appendChild(lbl);
    mappingPanel.appendChild(sel);
  });
}

// heurística de mapeamento automático: combina cabeçalhos com palavras-chave
const FIELD_KEYWORDS = {
  'Nome': ['nome','name','colaborador','funcionario','funcionário','employee'],
  'Matrícula': ['matr','matrícula','matricula','id','registro','registration'],
  'Cargo': ['cargo','position','role','função','funcao'],
  'Data': ['data','date','avaliação','avaliacao','assessment'],
  'Nota': ['nota','pontua','pontuação','pontuacao','score','resultado','rating'],
  'Comentários': ['coment','observa','comments','observations','obs'],
  'Status': ['status','situação','situacao','estado']
};

function autoMapForSheet(sheetName) {
  const headers = state.headersBySheet[sheetName] || [];
  const mapping = {};
  const hLower = headers.map(h => String(h).toLowerCase());
  STANDARD_FIELDS.forEach(field => {
    const keys = FIELD_KEYWORDS[field] || [];
    let found = '';
    // procurar header que contenha qualquer keyword
    for (let i=0;i<hLower.length;i++) {
      for (let k of keys) {
        if (hLower[i].includes(k)) { found = headers[i]; break; }
      }
      if (found) break;
    }
    // fallback: tentar igualdade limpa
    if (!found) {
      for (let i=0;i<hLower.length;i++) {
        if (hLower[i] === field.toLowerCase()) { found = headers[i]; break; }
      }
    }
    mapping[field] = found || '';
  });
  return mapping;
}

// botão: tentar mapear automaticamente baseado em heurísticas
autoMapBtn.addEventListener('click', () => {
  const sheet = sheetSelect.value;
  if (!sheet) return alert('Selecione uma aba primeiro.');
  const mapping = autoMapForSheet(sheet);
  state.mappingBySheet[sheet] = mapping;
  saveStateToStorage();
  buildMappingPanel();
  alert('Mapeamento sugerido aplicado (revisar e clique em "Aplicar Mapeamento").');
});

// aplicar mapeamento da UI
applyMapBtn.addEventListener('click', () => {
  const sheet = sheetSelect.value;
  if (!sheet) return alert('Selecione uma aba primeiro.');
  const selects = mappingPanel.querySelectorAll('select');
  const mapping = {};
  selects.forEach(s => { mapping[s.name] = s.value; });
  state.mappingBySheet[sheet] = mapping;
  saveStateToStorage();
  applyMapping(mapping);
});

// aplicar mapping: transforma rawSheets[sheet] em objetos padronizados (Nome, Matrícula, ...)
function applyMapping(mapping) {
  const sheet = sheetSelect.value;
  state.currentSheet = sheet;
  loadedSheetEl.textContent = `Aba: ${state.currentSheet}`;
  const raw = state.rawSheets[sheet] || [];
  // criar data padronizada
  const mapped = raw.map(obj => {
    const out = {};
    // copiar campos mapeados
    STANDARD_FIELDS.forEach(f => {
      const source = mapping[f];
      if (source && source in obj) out[f] = obj[source];
      else if (source && source !== '') {
        // tentar acessar por header search ignoring whitespace
        const key = findKeyIgnoringCase(Object.keys(obj), source);
        if (key) out[f] = obj[key];
        else out[f] = '';
      } else {
        out[f] = '';
      }
    });
    // conservar outros campos também
    Object.keys(obj).forEach(k => {
      if (!Object.values(mapping).includes(k)) out[k] = obj[k];
    });
    return out;
  });
  state.data = mapped;
  state.headers = inferStandardHeaders(state.data);
  // persistir e renderizar
  saveStateToStorage();
  populateStatusFilter();
  renderKPIs();
  renderChart();
  state.page = 1;
  renderTable();
}

// util: achar chave de objeto ignorando case/acentos/espacos aproximado
function normalizeKey(s) {
  return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g,'').toLowerCase();
}
function findKeyIgnoringCase(keys, target) {
  const t = normalizeKey(target);
  return keys.find(k => normalizeKey(k) === t);
}

// inferir headers padrão a partir do primeiro objeto
function inferStandardHeaders(data) {
  if (!data || !data.length) return STANDARD_FIELDS.slice();
  const first = data[0];
  return Object.keys(first);
}

// KPIs
function renderKPIs() {
  kpisEl.innerHTML = '';
  const total = state.data.length;
  const filled = state.data.filter(r => Object.values(r).some(v => String(v).trim() !== '')).length;
  const avgScore = computeAverageScore();
  const cards = [
    { label: 'Registros', value: total },
    { label: 'Preenchidos', value: filled },
    { label: 'Média de nota', value: isNaN(avgScore) ? '—' : avgScore.toFixed(1) },
    { label: 'Colunas detectadas', value: state.headers.length }
  ];
  cards.forEach(c => {
    const d = document.createElement('div'); d.className = 'glass kpi';
    d.innerHTML = `<div class="label">${c.label}</div><div class="value">${c.value}</div>`;
    kpisEl.appendChild(d);
  });
}

// média das notas (tenta chaves comuns)
function computeAverageScore() {
  const scoreKeys = ['Nota','Pontuacao','Pontuação','Score','score'];
  let sum=0,count=0;
  state.data.forEach(r => {
    for (let k of scoreKeys) {
      if (k in r && r[k] !== '') {
        const n = Number(String(r[k]).replace(',', '.'));
        if (!isNaN(n)) { sum+=n; count++; }
        break;
      }
    }
  });
  return count ? sum/count : NaN;
}

// gráfico
function renderChart() {
  const labels = [];
  const data = [];
  for (let i=0;i<Math.min(100,state.data.length);i++) {
    const r = state.data[i];
    const name = r['Nome'] || `R${i+1}`;
    labels.push(name);
    const val = r['Nota'] ?? r['Pontuação'] ?? r['Pontuacao'] ?? r['score'] ?? 0;
    const n = Number(String(val).replace(',', '.'));
    data.push(isNaN(n) ? 0 : n);
  }
  if (state.chart) state.chart.destroy();
  state.chart = new Chart(scoreCtx, {
    type: 'bar',
    data: { labels, datasets: [{ label:'Notas (amostra)', data, backgroundColor: 'rgba(124,231,196,0.8)' }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} }
  });
}

// preencher filtro status
function populateStatusFilter() {
  const statuses = new Set();
  state.data.forEach(r => {
    const s = r['Status'] || r['status'] || '';
    if (s && String(s).trim() !== '') statuses.add(String(s).trim());
  });
  filterStatus.innerHTML = '<option value="">Todos status</option>';
  Array.from(statuses).forEach(s => {
    const opt = document.createElement('option'); opt.value = s; opt.textContent = s;
    filterStatus.appendChild(opt);
  });
}

// Render tabela com paginação
function renderTable() {
  tableWrap.innerHTML = '';
  if (!state.data || state.data.length === 0) {
    tableWrap.innerHTML = '<div style="color:var(--muted)">Nenhum dado</div>';
    pageInfo.textContent = 'Página 0/0';
    return;
  }
  const query = (searchInput.value || '').toLowerCase();
  const statusFilter = filterStatus.value;
  let filtered = state.data.filter(r => {
    let matchQ = true;
    if (query) matchQ = Object.values(r).join(' ').toLowerCase().includes(query);
    let matchS = true;
    if (statusFilter) matchS = String(r['Status'] || r['status'] || '').trim() === statusFilter;
    return matchQ && matchS;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;
  const start = (state.page -1) * state.pageSize;
  const pageRows = filtered.slice(start, start + state.pageSize);

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headerKeys = state.headers;
  thead.innerHTML = `<tr>${headerKeys.map(h => `<th>${h}</th>`).join('')}<th>Ações</th></tr>`;
  table.appendChild(thead);
  const tbody = document.createElement('tbody');

  pageRows.forEach((row, idx) => {
    const tr = document.createElement('tr');
    headerKeys.forEach(k => {
      const v = row[k] ?? '';
      tr.innerHTML += `<td>${escapeHtml(String(v))}</td>`;
    });
    const globalIndex = state.data.indexOf(pageRows[idx]);
    const actions = `<td class="table-actions">
      <button data-index="${globalIndex}" class="editBtn">Editar</button>
      <button data-index="${globalIndex}" class="delBtn">Excluir</button>
    </td>`;
    tr.innerHTML += actions;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  pageInfo.textContent = `Página ${state.page}/${totalPages}`;

  // ligar eventos ações
  Array.from(document.getElementsByClassName('editBtn')).forEach(b => {
    b.onclick = (ev) => {
      const i = Number(ev.currentTarget.dataset.index);
      openEditForm(i);
    };
  });
  Array.from(document.getElementsByClassName('delBtn')).forEach(b => {
    b.onclick = (ev) => {
      const i = Number(ev.currentTarget.dataset.index);
      if (confirm('Excluir este registro?')) {
        state.data.splice(i,1);
        saveStateToStorage();
        renderKPIs(); renderChart(); renderTable();
      }
    };
  });
}

// escape HTML
function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// formulário de edição/adicionar
addBtn.addEventListener('click', () => openEditForm(null));
function openEditForm(index) {
  formPanel.style.display = 'block';
  document.getElementById('tablePanel').style.display = 'none';
  document.getElementById('dashboardPanel').style.display = 'none';
  evalForm.reset();
  state.editIndex = index;
  if (index !== null) {
    const row = state.data[index];
    // preencher campos do form com chaves padrão
    const map = { 'Nome':'Nome', 'Matrícula':'Matrícula','Cargo':'Cargo','Data':'Data','Nota':'Nota','Status':'Status','Comentários':'Comentários' };
    Object.keys(map).forEach(k => {
      const el = evalForm.elements.namedItem(k);
      if (el) el.value = row[k] ?? '';
    });
  }
}
cancelEditBtn.addEventListener('click', () => {
  formPanel.style.display = 'none';
  document.getElementById('tablePanel').style.display = 'block';
  document.getElementById('dashboardPanel').style.display = 'block';
  state.editIndex = null;
});

evalForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const formData = new FormData(evalForm);
  const obj = {};
  for (let [k,v] of formData.entries()) obj[k] = v;
  if (state.editIndex === null) {
    state.data.push(obj);
  } else {
    state.data[state.editIndex] = Object.assign({}, state.data[state.editIndex], obj);
  }
  state.headers = inferStandardHeaders(state.data);
  saveStateToStorage();
  formPanel.style.display = 'none';
  document.getElementById('tablePanel').style.display = 'block';
  document.getElementById('dashboardPanel').style.display = 'block';
  renderAfterLoad();
});

// export CSV
exportBtn.addEventListener('click', () => {
  if (!state.data || state.data.length === 0) return alert('Nenhum dado a exportar.');
  const keys = state.headers;
  const lines = [keys.join(',')];
  state.data.forEach(r => {
    const row = keys.map(k => `"${String(r[k] ?? '').replace(/"/g,'""')}"`).join(',');
    lines.push(row);
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'export_kite.csv'; a.click();
  URL.revokeObjectURL(url);
});

// busca, filtro e paginação
searchInput.addEventListener('input', () => { state.page = 1; renderTable(); });
filterStatus.addEventListener('change', () => { state.page = 1; renderTable(); });
prevPageBtn.addEventListener('click', () => { if (state.page>1) { state.page--; renderTable(); } });
nextPageBtn.addEventListener('click', () => { state.page++; renderTable(); });

// limpar storage e estado
clearBtn.addEventListener('click', () => {
  if (!confirm('Remover dados e mapeamentos salvos no navegador?')) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

// tentativa de carregar do storage ao iniciar
if (loadStateFromStorage()) {
  // reconstruir interface básica
  if (state.sheetNames && state.sheetNames.length) {
    // preencher selects/listas
    renderAfterLoad();
  } else if (state.data && state.data.length) {
    state.headers = inferStandardHeaders(state.data);
    populateStatusFilter();
    renderKPIs();
    renderChart();
    renderTable();
  }
}

// quando usuário troca aba no select
sheetSelect.addEventListener('change', (e) => {
  state.currentSheet = sheetSelect.value;
  loadedSheetEl.textContent = `Aba: ${state.currentSheet}`;
  buildMappingPanel();
});

// util: inferir headers a partir dos dados padronizados
function inferStandardHeaders(data) {
  if (!data || !data.length) return STANDARD_FIELDS.slice();
  const set = new Set();
  data.forEach(r => Object.keys(r).forEach(k => set.add(k)));
  // garantir que campos padrão apareçam na frente
  const out = STANDARD_FIELDS.filter(f => set.has(f));
  Array.from(set).forEach(k => { if (!out.includes(k)) out.push(k); });
  return out;
}