// app.js - policies page behavior
(function(){
  // Load policies from embedded <script id="policiesData"> content or fallback to global variable `POLICIES`
  function loadPolicies(){
    const el = document.getElementById('policiesData');
    if(el){
      try{ return JSON.parse(el.textContent); } catch(e){ console.warn('policiesData parse fail', e); }
    }
    return window.POLICIES || [];
  }

  const policies = loadPolicies();
  const listEl = document.getElementById('list');
  const countEl = document.getElementById('resultsCount');
  const searchInput = document.getElementById('searchInput');
  const filterProvince = document.getElementById('filterProvince');
  const filterType = document.getElementById('filterType');
  const formProvince = document.getElementById('formProvince');

  // populate province filters
  const provinces = Array.from(new Set(policies.map(p=>p.provinceName).filter(Boolean))).sort();
  provinces.forEach(p=>{
    const o = document.createElement('option'); o.value = p; o.textContent = p;
    filterProvince.appendChild(o);
    const o2 = o.cloneNode(true); formProvince.appendChild(o2);
  });

  function renderList(items){
    listEl.innerHTML = '';
    countEl.textContent = `共 ${items.length} 条匹配结果`;
    if(!items.length){ listEl.innerHTML = '<p class="meta">未找到匹配项</p>'; return; }
    items.forEach(item=>{
      const card = document.createElement('div'); card.className = 'policy-card';
      card.style.border = '1px solid #eef3ff';
      card.style.padding = '12px'; card.style.marginBottom = '10px'; card.style.borderRadius='8px';
      const h = document.createElement('h3'); h.textContent = `${item.provinceName} · ${item.title}`;
      h.style.margin = '0 0 6px 0';
      const meta = document.createElement('div'); meta.className='meta'; meta.textContent = `${item.date || ''} · ${item.source || ''}`;
      const excerpt = document.createElement('p'); excerpt.textContent = item.summary || ''; excerpt.className='note';
      const actions = document.createElement('div'); actions.style.marginTop='8px';
      const btnDetail = document.createElement('button'); btnDetail.className='btn small'; btnDetail.textContent='详情';
      btnDetail.onclick = ()=>openModal(item);
      const link = document.createElement('a'); link.href = item.url; link.target='_blank'; link.rel='noopener noreferrer';
      link.textContent = '原文链接';
      link.style.marginLeft='8px'; link.style.color='#0b5fff'; link.style.fontWeight=700;
      actions.appendChild(btnDetail); actions.appendChild(link);
      card.appendChild(h); card.appendChild(meta); card.appendChild(excerpt); card.appendChild(actions);
      listEl.appendChild(card);
    });
  }

  function openModal(item){
    const modal = document.getElementById('modal'); const content = document.getElementById('modalContent');
    content.innerHTML = `<h2>${item.title}</h2>
      <p class="meta">${item.provinceName} · ${item.date || ''} · ${item.source || ''}</p>
      <p>${item.summary || ''}</p>
      <p>原文： <a href="${item.url}" target="_blank">${item.url}</a></p>
      <p><button class="btn" onclick="navigator.clipboard && navigator.clipboard.writeText('${item.url.replace(/'/g,"\\'")}')">复制链接</button>
      <button class="btn" onclick="downloadPolicy(${JSON.stringify(JSON.stringify(item)).replace(/\"/g,"&quot;")})" style="margin-left:8px">下载 JSON</button></p>`;
    modal.setAttribute('aria-hidden','false');
  }
  window.closeModal = function(){ document.getElementById('modal').setAttribute('aria-hidden','true'); }

  function downloadPolicy(serialized){
    try{
      const item = JSON.parse(JSON.parse(serialized));
      const blob = new Blob([JSON.stringify(item,null,2)],{type:'application/json'});
      const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download = (item.title||'policy') + '.json';
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }catch(e){ console.error(e); }
  }

  window.downloadPolicy = downloadPolicy;

  // search + filter
  function applyFilters(){
    const q = (searchInput.value||'').trim().toLowerCase();
    const prov = filterProvince.value;
    const type = filterType.value;
    let items = policies.slice();
    if(prov) items = items.filter(i=>i.provinceName === prov);
    if(type) items = items.filter(i=>i.type === type);
    if(q){
      items = items.filter(i=>{
        return (i.title||'').toLowerCase().includes(q) ||
               (i.summary||'').toLowerCase().includes(q) ||
               (i.provinceName||'').toLowerCase().includes(q) ||
               (i.source||'').toLowerCase().includes(q);
      });
    }
    renderList(items);
  }

  searchInput.addEventListener('input', debounce(applyFilters, 250));
  filterProvince.addEventListener('change', applyFilters);
  filterType.addEventListener('change', applyFilters);

  // export CSV
  document.getElementById('btnExportCsv').addEventListener('click',()=>{
    const items = Array.from(listEl.querySelectorAll('.policy-card')).length ? null : null;
    // easier: export all currently filtered items
    const q = (searchInput.value||'').trim().toLowerCase();
    const prov = filterProvince.value;
    const type = filterType.value;
    let itemsArr = policies.slice();
    if(prov) itemsArr = itemsArr.filter(i=>i.provinceName===prov);
    if(type) itemsArr = itemsArr.filter(i=>i.type===type);
    if(q) itemsArr = itemsArr.filter(i=>(i.title||'').toLowerCase().includes(q) || (i.summary||'').toLowerCase().includes(q));
    const header = ['provinceName','type','date','title','summary','url','source'];
    const csv = [header.join(',')].concat(itemsArr.map(it=>header.map(h=>safeCSV(it[h])).join(','))).join('\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='policies.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  function safeCSV(val){ if(val===undefined || val===null) return '""'; return '"'+String(val).replace(/"/g,'""')+'"'; }

  // download full JSON
  document.getElementById('btnDownloadJson').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(policies,null,2)],{type:'application/json'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='policies.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  // open all / close all
  document.getElementById('openAllBtn').addEventListener('click', ()=>{
    const btn = document.getElementById('openAllBtn');
    const open = btn.textContent.includes('展开');
    document.querySelectorAll('.province-list details').forEach(d=>d.open = open);
    btn.textContent = open ? '全部收起' : '全部展开';
  });

  // copy template helper
  window.copyText = function(id){
    const text = document.getElementById(id).textContent;
    if(!navigator.clipboard){ alert('浏览器不支持剪贴板 API，请手动复制'); return; }
    navigator.clipboard.writeText(text).then(()=>{ alert('已复制到剪贴板'); }, ()=>{ alert('复制失败'); });
  }

  // submit form demo
  function handleSubmit(e){
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    document.getElementById('submitResult').textContent = '已生成演示材料包（本地演示）:\n' + JSON.stringify(data,null,2);
  }
  window.handleSubmit = handleSubmit;

  // debounce
  function debounce(fn,wait){ let t; return function(...a){ clearTimeout(t); t = setTimeout(()=>fn.apply(this,a), wait); }; }

  // initial render
  renderList(policies);
  applyFilters();

  // keyboard: Esc to close modal
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });

})();
