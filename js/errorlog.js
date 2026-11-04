// Error Log — track weak points until they become strengths

let errorFilter = 'all';

const ERR_SUBJECTS = ['SAT Math','SAT Reading','SAT Writing'];
const ERR_STATUSES = [
  { key:'weak', label:'Still weak', tone:'bad' },
  { key:'improving', label:'Improving', tone:'warn' },
  { key:'mastered', label:'Mastered', tone:'good' },
];

function openErrorModal(){
  document.getElementById('eSubject').innerHTML = ERR_SUBJECTS.map(s=>`<option>${s}</option>`).join('');
  document.getElementById('eTopic').value=''; document.getElementById('eDesc').value=''; document.getElementById('eDate').value=todayStr();
  document.getElementById('eStatus').innerHTML = ERR_STATUSES.map(s=>`<option value="${s.key}">${s.label}</option>`).join('');
  document.getElementById('errorModal').classList.add('show');
}

function saveErrorEntry(){
  const entry = {
    user_id: currentUser.id,
    date: document.getElementById('eDate').value||todayStr(),
    subject: document.getElementById('eSubject').value,
    topic: document.getElementById('eTopic').value.trim(),
    description: document.getElementById('eDesc').value.trim(),
    status: document.getElementById('eStatus').value,
  };
  if(!entry.topic){ toast('Name the weak point (topic)'); return; }
  sb.from('error_log').insert(entry).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    closeModal('errorModal'); toast('Weak point logged');
    await loadAll(); renderAll();
  });
}

function cycleErrorStatus(id){
  const e = errorLog.find(x=>x.id===id); if(!e) return;
  const order = ['weak','improving','mastered'];
  const next = order[(order.indexOf(e.status)+1)%order.length];
  sb.from('error_log').update({ status:next }).eq('id',id).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    await loadAll(); renderAll();
  });
}

function delErrorEntry(id){
  if(!confirm('Delete this error-log entry?')) return;
  sb.from('error_log').delete().eq('id',id).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    await loadAll(); renderAll();
  });
}

function setStatusFilter(v){ errorFilter=v; renderErrorLog(); }

function statusMeta(k){ return ERR_STATUSES.find(s=>s.key===k) || ERR_STATUSES[0]; }

function renderErrorLog(){
  const el = document.getElementById('errorLogList');
  if(!el) return;
  if(errorLog.length===0){ el.innerHTML='<div class="empty">No weak points logged yet. Every miss you record here is a point you\u2019re about to gain.</div>'; return; }
  // counts
  const counts = { weak:0, improving:0, mastered:0 };
  errorLog.forEach(e=>{ if(counts[e.status]!=null) counts[e.status]++; });
  const summary = `<div class="stat-row">
    <div class="stat-box"><div class="v" style="color:var(--danger)">${counts.weak}</div><div class="l">Still weak</div></div>
    <div class="stat-box"><div class="v" style="color:var(--warn)">${counts.improving}</div><div class="l">Improving</div></div>
    <div class="stat-box"><div class="v" style="color:var(--success)">${counts.mastered}</div><div class="l">Mastered</div></div>
  </div>
  <div class="field" style="max-width:240px"><label>Filter by status</label>
    <select onchange="setStatusFilter(this.value)">
      <option value="all" ${errorFilter==='all'?'selected':''}>All</option>
      <option value="weak" ${errorFilter==='weak'?'selected':''}>Still weak</option>
      <option value="improving" ${errorFilter==='improving'?'selected':''}>Improving</option>
      <option value="mastered" ${errorFilter==='mastered'?'selected':''}>Mastered</option>
    </select></div>`;

  let items = errorLog;
  if(errorFilter!=='all') items = items.filter(e=>e.status===errorFilter);
  const bySubject = {};
  items.forEach(e=>{ (bySubject[e.subject]=bySubject[e.subject]||[]).push(e); });

  const body = Object.keys(bySubject).length ? Object.entries(bySubject).map(([subj,list])=>`
    <h3>${escape(subj)} <span class="pill gray">${list.length}</span></h3>
    ${list.map(e=>{
      const meta=statusMeta(e.status);
      return `<div class="err-item ${e.status}">
        <div class="err-main">
          <div class="err-topic">${escape(e.topic)}</div>
          ${e.description?`<div class="muted small">${escape(e.description)}</div>`:''}
          <div class="muted small" style="margin-top:2px">Logged ${e.date}</div>
        </div>
        <div class="row" style="gap:6px">
          <span class="pill ${meta.tone}">${meta.label}</span>
          <button class="btn secondary sm" onclick="cycleErrorStatus('${e.id}')" title="Move to next stage">Advance ↻</button>
          <button class="btn danger sm" onclick="delErrorEntry('${e.id}')">✕</button>
        </div>
      </div>`;
    }).join('')}
  `).join('') : '<div class="empty">Nothing in this filter — nice.</div>';

  el.innerHTML = summary + body;
}

// Top weak subjects for dashboard/admin rollup
function topWeakAreas(limit=3){
  const agg={};
  errorLog.filter(e=>e.status!=='mastered').forEach(e=>{
    const k = e.subject+' · '+e.topic;
    agg[k]=(agg[k]||0)+1;
  });
  return Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([k,v])=>({area:k,count:v}));
}
