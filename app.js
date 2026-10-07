(async function () {
  // loadPolicies: try embedded JSON element first, else fetch policies.json
  async function loadPolicies() {
    const el = document.getElementById('policiesData');
    if (el) {
      try {
        const txt = (el.textContent || '').trim();
        if (txt) return JSON.parse(txt);
      } catch (e) {
        console.warn('policiesData parse fail', e);
      }
    }
    try {
      const res = await fetch('policies.json', { cache: 'no-store' });
      if (res.ok) return await res.json();
      console.warn('fetch policies.json failed', res.status);
    } catch (e) {
      console.warn('fetch policies.json error', e);
    }
    return window.POLICIES || [];
  }

  const policies = await loadPolicies();
  const listEl = document.getElementById('list');
  const countEl = document.getElementById('resultsCount');
  const searchInput = document.getElementById('searchInput');
  const filterProvince = document.getElementById('filterProvince');
  const filterType = document.getElementById('filterType');
  const formProvince = document.getElementById('formProvince');
  const statCount = document.getElementById('statCount');

  // populate province selects
  const provinces = Array.from(new Set(policies.map(p => p.provinceName).filter(Boolean))).sort();
  provinces.forEach(p => {
    const o = document.createElement('option');
    o.value = p; o.textContent = p;
    if (filterProvince) filterProvince.appendChild(o.cloneNode(true));
    if (formProvince) formProvince.appendChild(o.cloneNode(true));
  });

  function renderList(items) {
    listEl.innerHTML = '';
    if (countEl) countEl.textContent = `共 ${items.length} 条匹配结果`;
    if (statCount) statCount.textContent = String(items.length);
    if (!items.length) {
      listEl.innerHTML = '<div class="policy-card"><p class="meta">未找到匹配项，请调整筛选条件。</p></div>';
      return;
    }

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'policy-card';
      card.innerHTML = `
        <h3>${item.provinceName} · ${item.title}</h3>
        <div class="meta">${item.date || ''} · ${item.source || ''}</div>
        <p>${item.summary || ''}</p>
        <div class="actions">
          <button class="btn small" type="button" data-detail='${encodeURIComponent(JSON.stringify(item))}'>详情</button>
          <a href="${item.url}" target="_blank" rel="noopener noreferrer">原文链接</a>
        </div>
      `;
      const detailBtn = card.querySelector('[data-detail]');
      detailBtn.addEventListener('click', () => {
        const payload = JSON.parse(decodeURIComponent(detailBtn.dataset.detail));
        openModal(payload);
      });
      listEl.appendChild(card);
    });
  }

  function openModal(item) {
    const modal = document.getElementById('modal');
    const content = document.getElementById('modalContent');
    if (!content || !modal) return;
    content.innerHTML = `
      <h2>${item.title}</h2>
      <p class="meta">${item.provinceName} · ${item.date || ''} · ${item.source || ''}</p>
      <p>${item.summary || ''}</p>
      <p>原文： <a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.url}</a></p>
      <div class="actions">
        <button class="primary" type="button" onclick="navigator.clipboard && navigator.clipboard.writeText('${String(item.url).replace(/'/g, "\\'")}')">复制链接</button>
        <button class="secondary" type="button" onclick="downloadPolicy(${JSON.stringify(JSON.stringify(item)).replace(/\"/g, '&quot;')})">下载 JSON</button>
      </div>
    `;
    modal.setAttribute('aria-hidden', 'false');
  }

  function applyFilters() {
    const q = (searchInput && searchInput.value || '').trim().toLowerCase();
    const prov = filterProvince && filterProvince.value;
    const type = filterType && filterType.value;

    let items = policies.slice();
    if (prov) items = items.filter(i => i.provinceName === prov);
    if (type) items = items.filter(i => i.type === type);
    if (q) {
      items = items.filter(i => [i.title, i.summary, i.provinceName, i.source].join(' ').toLowerCase().includes(q));
    }
    renderList(items);
  }

  // wire events safely (elements may not exist in all variants)
  if (searchInput) searchInput.addEventListener('input', debounce(applyFilters, 180));
  if (filterProvince) filterProvince.addEventListener('change', applyFilters);
  if (filterType) filterType.addEventListener('change', applyFilters);

  function exportCsvVisible() {
    const q = (searchInput && searchInput.value || '').trim().toLowerCase();
    const prov = filterProvince && filterProvince.value;
    const type = filterType && filterType.value;
    let items = policies.slice();
    if (prov) items = items.filter(i => i.provinceName === prov);
    if (type) items = items.filter(i => i.type === type);
    if (q) items = items.filter(i => [i.title, i.summary, i.provinceName, i.source].join(' ').toLowerCase().includes(q));
    const rows = [
      ['provinceName', 'type', 'date', 'title', 'summary', 'url', 'source'],
      ...items.map(i => [i.provinceName, i.type, i.date, i.title, i.summary, i.url, i.source])
    ];
    const csv = rows.map(r => r.map(safeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'policies.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function safeCsv(value) {
    const s = value == null ? '' : String(value);
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function downloadJson(payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'policies.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  window.downloadPolicy = function(serialized) {
    try {
      const item = JSON.parse(serialized);
      const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = (item.title || 'policy') + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
  };

  window.copyText = function(id) {
    const el = document.getElementById(id);
    const text = el ? el.textContent.trim() : '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => alert('已复制到剪贴板')).catch(() => alert('复制失败'));
    } else {
      alert('当前浏览器不支持复制');
    }
  };

  function handleSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form).entries());
    const result = document.getElementById('submitResult');
    if (result) result.innerHTML = '<strong>已生成演示材料包（本地演示）</strong><pre>' + JSON.stringify(data, null, 2) + '</pre>';
  }
  window.handleSubmit = handleSubmit;

  window.closeModal = function() {
    const modal = document.getElementById('modal');
    if (modal) modal.setAttribute('aria-hidden', 'true');
  };

  // attach export/download buttons if present
  const btnExportCsv = document.getElementById('btnExportCsv');
  if (btnExportCsv) btnExportCsv.addEventListener('click', exportCsvVisible);
  const btnExportCsv2 = document.getElementById('btnExportCsv2');
  if (btnExportCsv2) btnExportCsv2.addEventListener('click', exportCsvVisible);
  const btnDownloadJson2 = document.getElementById('btnDownloadJson2');
  if (btnDownloadJson2) btnDownloadJson2.addEventListener('click', () => downloadJson(policies));

  const btnPack = document.getElementById('btnPack');
  if (btnPack) btnPack.addEventListener('click', () => {
    const text = `项目申报清单\n\n项目名称：\n项目所在地：\n项目类型：\n装机功率（MW）：\n储能容量（MWh）：\n申请单位：\n联系人：\n联系电话：\n邮箱：\n备注：`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'materials-package.txt';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  });

  const jumpToResults = document.getElementById('jumpToResults');
  if (jumpToResults) jumpToResults.addEventListener('click', () => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }));
  const jumpToTemplates = document.getElementById('jumpToTemplates');
  if (jumpToTemplates) jumpToTemplates.addEventListener('click', () => document.getElementById('templates')?.scrollIntoView({ behavior: 'smooth' }));

  // debounce helper
  function debounce(fn, wait) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); }; }

  // wire inputs
  if (searchInput) searchInput.addEventListener('input', debounce(applyFilters, 180));

  // initial render
  applyFilters();

  if (statCount) statCount.textContent = String(policies.length || 0);

  document.addEventListener('keydown', e => { if (e.key === 'Escape') window.closeModal(); });

})();
