// Render — all display rendering functions

// ---------- Tabs ----------
function setupTabs(){
  document.querySelectorAll('nav button').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
      document.getElementById(b.dataset.tab).classList.add('active');
      renderAll();
    });
  });
}

// ---------- Notifications ----------
function updateNotifBadge(){
  const unread = notifications.filter(n=>!n.read).length;
  const b = document.getElementById('notifBadge');
  if(unread>0){ b.textContent=unread; b.classList.remove('hidden'); } else { b.classList.add('hidden'); }
}

function toggleNotifPanel(){
  const p = document.getElementById('notifPanel');
  p.classList.toggle('show');
  if(p.classList.contains('show')) renderNotifPanel();
}

function renderNotifPanel(){
  const p = document.getElementById('notifPanel');
  if(notifications.length===0){ p.innerHTML='<div class="empty">No notifications</div>'; return; }
  p.innerHTML = notifications.slice(0,20).map(n=>`
    <div class="notif-item ${n.read?'':'unread'}" onclick="markNotifRead('${n.id}')">
      <div class="t">${escape(n.title)}</div>
      <div class="b">${escape(n.body||'')}</div>
      <div class="time">${new Date(n.created_at).toLocaleString()}</div>
    </div>
  `).join('');
}

async function markNotifRead(id){
  await sb.from('notifications').update({read:true}).eq('id', id);
  const n = notifications.find(x=>x.id===id); if(n) n.read=true;
  updateNotifBadge(); renderNotifPanel();
}

// ---------- Dashboard ----------
function renderDashboard(){
  const TEST_DATE = new Date(window.STUDENT?.testDate||'2026-12-05');
  const now = new Date();
  const diff = Math.ceil((TEST_DATE-now)/(1000*60*60*24));
  const el = document.getElementById('countdownText');
  if(el) el.textContent = diff>0 ? `${diff} days until test day` : 'Test day!';

  const start = window.STUDENT?.currentScore||1200;
  const target = window.STUDENT?.targetScore||1450;
  const latest = scores.length ? [...scores].sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0].total : start;
  document.getElementById('currentScore').textContent = latest;
  const pct = Math.min(100, Math.max(0, (latest-start)/(target-start)*100));
  document.getElementById('scoreBar').style.width = pct+'%';
  document.getElementById('scorePct').textContent = Math.round(pct)+'% of the way to '+target;

  const daily = window.STUDENT?.dailyStudyHours||3;
  const today = todayStr();
  const todayH = sessions.filter(s=>s.date===today).reduce((a,s)=>a+s.hours,0);
  document.getElementById('todayHours').textContent = todayH.toFixed(2).replace(/\.00$/,'');
  document.getElementById('todayBar').style.width = Math.min(100, todayH/daily*100)+'%';
  document.getElementById('todayStatus').textContent = todayH>=daily ? 'Daily promise met ✓' : `${(daily-todayH).toFixed(1)}h remaining`;

  const ws = weekStart();
  const weekH = sessions.filter(s=>s.date>=ws).reduce((a,s)=>a+s.hours,0);
  document.getElementById('weekHours').textContent = weekH.toFixed(1);
  document.getElementById('weekBar').style.width = Math.min(100, weekH/(daily*7)*100)+'%';
  const portWeek = portSessions.filter(s=>s.date>=ws).reduce((a,s)=>a+s.hours,0);
  document.getElementById('portWeek').textContent = portWeek.toFixed(1);

  const total = homework.length;
  const done = homework.filter(h=>h.status==='graded'||h.status==='submitted').length;
  document.getElementById('assignTotal').textContent = total;
  document.getElementById('assignDone').textContent = done;
  document.getElementById('assignBar').style.width = (total?done/total*100:0)+'%';
  document.getElementById('assignStatus').textContent = total ? `${done} of ${total} complete` : 'No assignments yet';

  const recent = document.getElementById('recentSessions');
  const rs = [...sessions].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,5);
  recent.innerHTML = rs.length ? rs.map(s=>`<li><span>${s.date} · ${escape(s.subject)}${s.start_time?' ('+s.start_time+'–'+s.end_time+')':''}</span><span class="pill info">${s.hours}h</span></li>`).join('') : '<li class="empty">No sessions yet</li>';

  const up = document.getElementById('upcomingAssign');
  const ua = homework.filter(h=>h.status!=='graded').sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999')).slice(0,5);
  up.innerHTML = ua.length ? ua.map(h=>`<li><span>${escape(h.title)}</span><span class="pill ${h.priority==='high'?'bad':h.priority==='med'?'warn':'good'}">${h.due_date||'no due'}</span></li>`).join('') : '<li class="empty">No pending homework</li>';

  const chart = document.getElementById('weekChart');
  const days=[]; for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(d.toISOString().slice(0,10));}
  const maxH = Math.max(1, ...days.map(d=>sessions.filter(s=>s.date===d).reduce((a,s)=>a+s.hours,0)));
  chart.innerHTML = days.map(d=>{const h=sessions.filter(s=>s.date===d).reduce((a,s)=>a+s.hours,0);const height=(h/maxH)*150;return `<div class="bar" style="height:${Math.max(4,height)}px"><span class="val">${h?h.toFixed(1):''}</span><span>${d.slice(5)}</span></div>`;}).join('');

  // Focus areas (from error log)
  const focusEl = document.getElementById('dashFocus');
  if(focusEl){
    if(!errorLog.length){ focusEl.innerHTML='<div class="empty">No weak points logged yet — start your Error Log.</div>'; }
    else {
      const top = topWeakAreas(4);
      focusEl.innerHTML = top.length ? top.map(t=>`<div class="list"><li><span>${escape(t.area)}</span><span class="pill warn">${t.count} open</span></li></div>`).join('') : '<div class="empty">All caught up — nothing open. Great job.</div>';
    }
  }
  // Next 1:1 session
  const nextEl = document.getElementById('dashNextSession');
  if(nextEl){
    const upcoming = oneOnOne.filter(s=>s.date>=todayStr() && s.status!=='cancelled').sort((a,b)=>a.date.localeCompare(b.date))[0];
    if(!upcoming) nextEl.innerHTML='<div class="empty">No upcoming 1:1 sessions.</div>';
    else {
      const needConfirm = !isAdmin && upcoming.status==='proposed';
      nextEl.innerHTML = `<div class="session-item ${upcoming.status}" style="margin:0"><div class="s-when">${new Date(upcoming.date).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}${upcoming.start_time?`<div class="muted small">${upcoming.start_time}</div>`:''}</div><div class="s-body"><div class="s-topic">${escape(upcoming.topic)}</div>${statusPill(upcoming)}</div><div class="s-actions">${needConfirm?`<button class="btn sm" onclick="document.querySelector('nav button[data-tab=sessions]').click()">Go confirm</button>`:``}</div></div>`;
    }
  }
}

// ---------- Assignments ----------
function openAssignModal(){ document.getElementById('assignModal').classList.add('show'); }
function openAssignHwModal(){
  if(!isAdmin){ toast('Admin only'); return; }
  pendingAttachments = [];
  renderPendingAttachments();
  document.getElementById('hwTitle').value=''; document.getElementById('hwDesc').value=''; document.getElementById('hwDue').value=todayStr();
  document.getElementById('assignHwModal').classList.add('show');
}

function savePersonalAssignment(){
  if(guardWrite()) return;
  const statusMap = { todo:'assigned', doing:'submitted', done:'graded' };
  const hw = {
    title: document.getElementById('aTitle').value.trim(),
    description: document.getElementById('aNotes').value.trim(),
    category: document.getElementById('aCat').value,
    priority: document.getElementById('aPrio').value,
    due_date: document.getElementById('aDue').value || null,
    status: statusMap[document.getElementById('aStatus').value] || 'assigned',
    assigned_to: currentUser.id,
    created_by: currentUser.id,
  };
  if(!hw.title){ toast('Title required'); return; }
  sb.from('homework').insert(hw).then(({error})=>{
    if(error){ toast(error.message); return; }
    closeModal('assignModal');
    ['aTitle','aDue','aNotes'].forEach(id=>document.getElementById(id).value='');
    loadAll().then(renderAll);
    toast('Assignment added');
  });
}

function moveAssign(id, status){
  if(guardWrite()) return;
  const patch = { status };
  if(status==='submitted'){ patch.submitted_at = new Date().toISOString(); }
  sb.from('homework').update(patch).eq('id', id).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    await loadAll(); renderAll();
  });
}

function delAssign(id){
  if(guardWrite()) return;
  if(!confirm('Delete this assignment?')) return;
  sb.from('homework').delete().eq('id', id).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    await loadAll(); renderAll();
  });
}

function renderAssignments(){
  const filter = document.getElementById('assignFilter').value;
  let items = [...homework];
  if(filter!=='all'){
    if(['todo','doing','done'].includes(filter)) items = items.filter(h=> (h.status==='assigned'?'todo':h.status==='submitted'?'doing':'done')===filter || h.status===filter);
    else if(filter==='homework') items = items.filter(h=> h.created_by !== h.assigned_to);
    else items = items.filter(h=> h.category===filter);
  }
  const mapStatus = s => s==='assigned'?'todo' : s==='submitted'?'doing' : 'done';
  ['todo','doing','done'].forEach(col=>{
    const el = document.getElementById('col-'+col);
    const colItems = items.filter(h=>mapStatus(h.status)===col);
    if(colItems.length===0){ el.innerHTML='<div class="empty">Empty</div>'; return; }
    el.innerHTML = colItems.map(h=>{
      const isHw = h.created_by !== h.assigned_to;
      const atts = hwAttachments[h.id]||[];
      const dueSoon = h.due_date && h.due_date < todayStr() && mapStatus(h.status)!=='done';
      return `<div class="kcard${dueSoon?' due-soon':''}">
        <div class="title">${escape(h.title)} ${isHw?'<span class="pill purple">HW</span>':''}</div>
        <div class="meta">${h.category||''} · ${h.priority||''} priority${h.due_date?' · due '+h.due_date:''}</div>
        ${h.description?`<div class="meta">${escape(h.description).slice(0,80)}</div>`:''}
        ${atts.length?`<div style="margin-top:4px">${atts.map(a=>`<a class="attach" href="${escape(a.url)}" target="_blank">${iconFor(a.file_type)} ${escape(a.name)}</a>`).join('')}</div>`:''}
        ${h.grade!=null?`<div class="meta"><b>Grade: ${h.grade}/100</b>${h.feedback?' — '+escape(h.feedback).slice(0,60):''}</div>`:''}
        <div class="row" style="margin-top:6px;gap:4px">
          ${mapStatus(h.status)!=='todo'?'<button class="btn secondary sm" onclick="moveAssign(\''+h.id+'\',\'assigned\')">← To Do</button>':''}
          ${mapStatus(h.status)!=='doing' && h.created_by!==h.assigned_to?'<button class="btn secondary sm" onclick="moveAssign(\''+h.id+'\',\'submitted\')">Submit</button>':''}
          ${mapStatus(h.status)!=='done' && (isAdmin || h.created_by===h.assigned_to)?'<button class="btn secondary sm" onclick="moveAssign(\''+h.id+'\',\'graded\')">Done ✓</button>':''}
          ${isAdmin?'<button class="btn secondary sm" onclick="openGradeModal(\''+h.id+'\')">Grade</button>':''}
          ${(isAdmin || h.created_by===currentUser.id)?'<button class="btn danger sm" onclick="delAssign(\''+h.id+'\')">✕</button>':''}
        </div>
      </div>`;
    }).join('');
  });
}

// ---------- Study Log ----------
function addSession(){
  if(guardWrite()) return;
  const start = document.getElementById('logStart').value;
  const end = document.getElementById('logEnd').value;
  const hours = hoursBetween(start,end);
  const s = { user_id: currentUser.id, date: document.getElementById('logDate').value||todayStr(), start_time:start, end_time:end, hours: hours>0?hours:0, subject: document.getElementById('logSubject').value, notes: document.getElementById('logNotes').value.trim() };
  if(s.hours<=0){ toast('Enter valid start/end times'); return; }
  sb.from('study_sessions').insert(s).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    document.getElementById('logStart').value=''; document.getElementById('logEnd').value=''; document.getElementById('logNotes').value='';
    await loadAll(); renderAll(); toast('Session logged: '+s.hours+'h');
  });
}

function delSession(id){
  if(guardWrite()) return;
  sb.from('study_sessions').delete().eq('id',id).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    await loadAll(); renderAll();
  });
}

function renderSessions(){
  const tb = document.getElementById('sessionTable');
  const sorted = [...sessions].sort((a,b)=>(b.date||'').localeCompare(a.date||'') || (b.start_time||'').localeCompare(a.start_time||''));
  if(sorted.length===0){ tb.innerHTML='<tr><td colspan="6" class="empty">No sessions yet</td></tr>'; return; }
  tb.innerHTML = sorted.map(s=>`<tr>
    <td>${s.date}</td><td>${s.start_time||'—'}–${s.end_time||'—'}</td><td>${s.hours}</td><td>${escape(s.subject)}</td><td>${escape(s.notes)}</td>
    <td><button class="btn danger sm" onclick="delSession('${s.id}')">✕</button></td>
  </tr>`).join('');
}

// ---------- Scores ----------
function addScore(){
  if(guardWrite()) return;
  const sc = { user_id: currentUser.id, date: document.getElementById('scoreDate').value||todayStr(), total: parseInt(document.getElementById('scoreTotal').value)||0, math: parseInt(document.getElementById('scoreMath').value)||0, rw: parseInt(document.getElementById('scoreRW').value)||0, notes: document.getElementById('scoreNotes').value.trim() };
  if(sc.total<400){ toast('Enter total score'); return; }
  sb.from('scores').insert(sc).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    ['scoreTotal','scoreMath','scoreRW','scoreNotes'].forEach(id=>document.getElementById(id).value='');
    await loadAll(); renderAll(); toast('Score logged');
  });
}

function delScore(id){
  if(guardWrite()) return;
  sb.from('scores').delete().eq('id',id).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    await loadAll(); renderAll();
  });
}

// ---- Scores: progress-over-time trajectory ----
function setScoreSeries(s){
  scoreSeries = s;
  document.querySelectorAll('#scores .seg-btn').forEach(b=>b.classList.toggle('active', b.dataset.series===s));
  renderScores();
}
function toggleScoreMilestones(){ renderScores(); }

function seriesConfig(){
  const st = window.STUDENT||{};
  if(scoreSeries==='math') return { key:'math', label:'Math', target:750, start:600, assumedStart:true, lo:400, hi:800, unit:'' };
  if(scoreSeries==='rw')   return { key:'rw',   label:'Reading & Writing', target:750, start:600, assumedStart:true, lo:400, hi:800, unit:'' };
  return { key:'total', label:'Total', target:(st.targetScore||1450), start:(st.currentScore||1200), assumedStart:false, lo:1000, hi:1600, unit:'' };
}

function scorePoints(cfg){
  const st = window.STUDENT||{};
  const pts = [];
  if(st.scoreDate) pts.push({ t:new Date(st.scoreDate+'T00:00:00').getTime(), v:cfg.start, baseline:true });
  [...scores]
    .filter(s=>s[cfg.key]!=null && !isNaN(+s[cfg.key]))
    .sort((a,b)=>(a.date||'').localeCompare(b.date||''))
    .forEach(s=> pts.push({ t:new Date(s.date+'T00:00:00').getTime(), v:+s[cfg.key], id:s.id }));
  return pts;
}

// least-squares fit over the non-baseline points
function fitLine(pts){
  const d = pts.filter(p=>!p.baseline);
  if(d.length<2) return null;
  const n=d.length, t0=d[0].t;
  let sx=0,sy=0,sxx=0,sxy=0;
  d.forEach(p=>{ const x=(p.t-t0)/86400000; sx+=x; sy+=p.v; sxx+=x*x; sxy+=x*p.v; });
  const denom = (n*sxx - sx*sx);
  if(!denom) return null;
  const b = (n*sxy - sx*sy)/denom;   // points per day
  const a = (sy - b*sx)/n;
  return { a, b, t0 };
}

function parseMilestones(cfg){
  if(scoreSeries!=='total' || !window.SCHEDULE || !window.SCHEDULE.milestones) return [];
  const year = (window.STUDENT && window.STUDENT.testDate ? new Date(window.STUDENT.testDate).getFullYear() : 2026);
  const MON={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  return window.SCHEDULE.milestones.map(m=>{
    const mnum = m.target && m.target.match(/→\s*(\d{3,4})/);
    const dnum = m.label && m.label.match(/(\w+\s+\d+)\s*-\s*(\w+\s+\d+)/);
    if(!mnum || !dnum) return null;
    const v=+mnum[1];
    // end date of range: e.g. "Nov 10"
    const end = dnum[2]; const em=end.match(/(\w+)\s+(\d+)/);
    if(!em) return null;
    const mo=MON[em[1].slice(0,3)]; if(mo==null) return null;
    const t=new Date(year, mo, +em[2]).getTime();
    return { v, t, label:m.label };
  }).filter(Boolean);
}

function renderScores(){
  const cfg = seriesConfig();
  const showMile = document.getElementById('mileToggle') && document.getElementById('mileToggle').checked;

  // ---- history table with delta from previous chronological point ----
  const tb = document.getElementById('scoreTable');
  const chrono = [...scores].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  let prevTotal = (window.STUDENT&&window.STUDENT.currentScore)||null;
  const deltas = chrono.map(s=>{ const d = (prevTotal!=null && s.total!=null)?(s.total-prevTotal):null; prevTotal = s.total!=null?s.total:prevTotal; return d; });
  const rows = [...scores].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  if(rows.length===0){ tb.innerHTML='<tr><td colspan="7" class="empty">No practice tests logged yet.</td></tr>'; }
  else {
    tb.innerHTML = rows.map(s=>{
      const i = chrono.indexOf(s); const d = deltas[i];
      const dcell = d==null?'<span class="pill gray">—</span>'
        : d>0?`<span class="pill good">▲ ${d}</span>`
        : d<0?`<span class="pill bad">▼ ${Math.abs(d)}</span>`
        : `<span class="pill gray">= 0</span>`;
      return `<tr><td>${s.date}</td><td><b>${s.total}</b></td><td>${dcell}</td><td>${s.math??'—'}</td><td>${s.rw??'—'}</td><td>${escape(s.notes)}</td><td><button class="btn danger sm" onclick="delScore('${s.id}')">✕</button></td></tr>`;
    }).join('');
  }

  // ---- build the trajectory chart ----
  const chart = document.getElementById('scoreChart');
  const stats = document.getElementById('scoreStats');
  const legend = document.getElementById('scoreLegend');
  const pts = scorePoints(cfg);
  const testT = new Date(((window.STUDENT&&window.STUDENT.testDate)||'2026-12-05')+'T00:00:00').getTime();
  const real = pts.filter(p=>!p.baseline);

  // stats + projection
  const fit = fitLine(pts);
  const latest = real.length? real[real.length-1].v : (cfg.start);
  const projected = fit ? Math.round(fit.a + fit.b*((testT-fit.t0)/86400000)) : latest;
  const gain = real.length ? (latest - cfg.start) : 0;
  const gap = cfg.target - latest;
  const firstReal = real.length? real[0].v : null;
  const trendD = real.length>=2 ? (real[real.length-1].v - real[real.length-2].v) : null;

  if(stats){
    const trendCls = trendD==null?'':(trendD>0?'up':trendD<0?'down':'');
    const projCls = projected>=cfg.target?'up':(projected>=latest?'near':'down');
    stats.innerHTML = `
      <div class="ts"><div class="ts-v ${trendCls}">${latest}</div><div class="ts-l">Current ${cfg.label}</div></div>
      <div class="ts"><div class="ts-v ${gain>0?'up':gain<0?'down':''}">${gain>=0?'+':''}${gain}</div><div class="ts-l">vs baseline</div></div>
      <div class="ts"><div class="ts-v ${trendD==null?'':(trendD>0?'up':'down')}">${trendD==null?'—':(trendD>0?'+':'')+trendD}</div><div class="ts-l">Last change</div></div>
      <div class="ts"><div class="ts-v ${projCls}">${fit?projected:'—'}</div><div class="ts-l">Projected on test day</div></div>
      <div class="ts"><div class="ts-v ${gap<=0?'up':'near'}">${gap<=0?'✓ reached':gap}</div><div class="ts-l">To target ${cfg.target}</div></div>`;
  }

  if(!real.length){
    chart.innerHTML = `<svg viewBox="0 0 720 300" role="img" aria-label="Score trajectory, no data yet">
      <rect x="0" y="0" width="720" height="300" fill="transparent"></rect>
      <text x="360" y="150" text-anchor="middle" class="empty-note">Log your first practice test to start your trajectory.</text>
      <text x="360" y="172" text-anchor="middle" class="axis-txt">Baseline ${cfg.label} shown as a dashed line — every logged test becomes a point.</text>
    </svg>`;
    if(legend) legend.innerHTML='';
    return;
  }

  // scales
  const allV = [latest, projected, cfg.target, cfg.start].filter(v=>v!=null);
  let yMin = Math.min(cfg.lo, ...allV); let yMax = Math.max(cfg.hi, ...allV, ...real.map(p=>p.v));
  if(scoreSeries!=='total'){ yMin = cfg.lo; yMax = cfg.hi; }
  else { yMin = Math.min(1100, yMin); yMax = Math.max(1500, yMax, projected); }
  const yPad = (yMax-yMin)*0.08||10; yMin-=yPad; yMax+=yPad;
  let xMin = Math.min(pts[0].t, showMile?Math.min(...parseMilestones(cfg).map(m=>m.t),xMin):pts[0].t); xMin=Math.min(pts[0].t, testT - 0); 
  xMin = Math.min(...pts.map(p=>p.t));
  const xMax = testT;
  const spanX = (xMax-xMin)||1;
  const W=720,H=300,PADL=46,PADR=18,PADT=16,PADB=34;
  const X = t => PADL + ((t-xMin)/spanX)*(W-PADL-PADR);
  const Y = v => H-PADB - ((v-yMin)/(yMax-yMin))*(H-PADT-PADB);

  // gridlines + y labels (5 ticks)
  let g=''; const ticks=5;
  for(let i=0;i<=ticks;i++){ const v=yMin+(yMax-yMin)*i/ticks; const y=Y(v);
    g+=`<line x1="${PADL}" x2="${W-PADR}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" class="grid"></line>`+
       `<text x="${PADL-8}" y="${(y+3).toFixed(1)}" text-anchor="end" class="axis-txt">${Math.round(v)}</text>`;
  }

  // x labels: a few dates
  let xlab=''; const nx=Math.min(5, pts.length); 
  for(let i=0;i<nx;i++){ const p=pts[Math.round(i*(pts.length-1)/Math.max(1,nx-1))]; const dt=new Date(p.t);
    xlab+=`<text x="${X(p.t).toFixed(1)}" y="${H-12}" text-anchor="middle" class="axis-txt">${dt.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</text>`;
  }

  // target line
  const ty=Y(cfg.target);
  let targetLine=`<line x1="${PADL}" x2="${W-PADR}" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}" class="tline"></line>`+
    `<text x="${W-PADR}" y="${(ty-5).toFixed(1)}" text-anchor="end" class="tlabel">Target ${cfg.target}</text>`;

  // baseline (start) line
  let baseLine = cfg.start!=null && cfg.start>=yMin ? `<line x1="${PADL}" x2="${W-PADR}" y1="${Y(cfg.start).toFixed(1)}" y2="${Y(cfg.start).toFixed(1)}" class="bline"></line>` : '';

  // area + line path over the points (chronological)
  const ordered=[...pts].sort((a,b)=>a.t-b.t);
  let line='', area='';
  ordered.forEach((p,i)=>{ const x=X(p.t).toFixed(1), y=Y(p.v).toFixed(1);
    line += (i===0?`M ${x} ${y}`:` L ${x} ${y}`);
    area += (i===0?`M ${x} ${Y(yMin).toFixed(1)} L ${x} ${y}`:` L ${x} ${y}`);
  });
  const lastP=ordered[ordered.length-1];
  area += ` L ${X(lastP.t).toFixed(1)} ${Y(yMin).toFixed(1)} Z`;

  // projection to test day
  let proj='';
  if(fit && lastP.t < testT){
    const pv = fit.a + fit.b*((testT-fit.t0)/86400000);
    const pvy = Math.max(yMin, Math.min(yMax, pv));
    proj=`<line x1="${X(lastP.t).toFixed(1)}" y1="${Y(lastP.v).toFixed(1)}" x2="${X(testT).toFixed(1)}" y2="${Y(pvy).toFixed(1)}" class="proj"></line>`+
         `<text x="${X(testT).toFixed(1)}" y="${(Y(pvy)-6).toFixed(1)}" text-anchor="end" class="projlabel">${Math.round(pv)}</text>`;
  }

  // checkpoints
  let mile='';
  if(showMile && scoreSeries==='total'){
    parseMilestones(cfg).forEach(m=>{ const x=X(m.t).toFixed(1), y=Y(m.v).toFixed(1);
      mile+=`<path d="M ${x} ${(y-4).toFixed(1)} l 4 4 l -4 4 l -4 -4 z" class="mile"></path>`+
            `<text x="${x}" y="${(y-8).toFixed(1)}" text-anchor="middle" class="mile-txt">${m.v}</text>`;
    });
  }

  // points
  let dots='';
  ordered.forEach(p=>{ const x=X(p.t).toFixed(1), y=Y(p.v).toFixed(1);
    dots += `<circle cx="${x}" cy="${y}" r="4" class="pt"></circle>`;
  });
  const cur = ordered[ordered.length-1];
  dots += `<circle cx="${X(cur.t).toFixed(1)}" cy="${Y(cur.v).toFixed(1)}" r="5.5" class="pt-cur"></circle>`;

  chart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${cfg.label} score trajectory">
    ${g}${xlab}${baseLine}${targetLine}${mile}
    <path d="${area}" class="area"></path>
    <path d="${line}" class="line"></path>
    ${proj}${dots}
  </svg>`;

  if(legend){
    const items=[['Solid line','var(--primary)','scored trajectory'],['Dashed violet','var(--violet)','projected pace'],['Green dashed','var(--success)','target']];
    if(cfg.assumedStart) items.push(['Baseline dashed','var(--line-strong)','assumed section baseline']);
    if(showMile && scoreSeries==='total') items.push(['Diamond','var(--warn)','plan checkpoint']);
    legend.innerHTML = items.map(it=>`<span class="lg"><span class="sw" style="border-top-color:${it[1]}"></span>${it[2]}</span>`).join('');
  }
}

// ---------- Portfolio ----------
// Unlock rule: the portfolio page opens once the learner has logged at least one
// study session for today (i.e. entered their daily study log). Admin bypasses.
function portfolioUnlocked(){
  if(isAdmin && !viewAsStudent) return true;
  return sessions.some(s=>s.date===todayStr());
}
function tryUnlockPortfolio(){
  if(portfolioUnlocked()){ applyPortfolioLock(); toast('Portfolio unlocked'); }
  else { toast('Log today\u2019s study session first (Study Log tab).'); }
}
function applyPortfolioLock(){
  const unlocked = portfolioUnlocked();
  document.getElementById('portLock').classList.toggle('hidden', unlocked);
  document.getElementById('portfolioBody').classList.toggle('hidden', !unlocked);
  const st = document.getElementById('portLockStatus');
  if(st && !unlocked) st.textContent = 'No study logged today yet. Log a session in the Study Log tab to unlock.';
  // lock indicator on the nav item
  const navBtn = document.querySelector('nav button[data-tab="portfolio"]');
  if(navBtn){
    const ico = navBtn.querySelector('.ico');
    if(ico) ico.textContent = unlocked ? '🤖' : '🔒';
  }
}
function openProjModal(){ document.getElementById('projModal').classList.add('show'); }
function saveProject(){
  if(guardWrite()) return;
  const p = { user_id: currentUser.id, name: document.getElementById('pName').value.trim(), category: document.getElementById('pCat').value, status: document.getElementById('pStatus').value, target_hours: parseFloat(document.getElementById('pTarget').value)||0, description: document.getElementById('pDesc').value.trim(), progress: 0 };
  if(!p.name){ toast('Name required'); return; }
  sb.from('projects').insert(p).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    closeModal('projModal');
    ['pName','pDesc','pTarget'].forEach(id=>document.getElementById(id).value='');
    await loadAll(); renderAll(); toast('Project added');
  });
}
function delProject(id){
  if(guardWrite()) return;
  sb.from('projects').delete().eq('id',id).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    await loadAll(); renderAll();
  });
}
function setProjStatus(id,status){ if(guardWrite()) return; sb.from('projects').update({status}).eq('id',id).then(async ({error})=>{ if(error) toast(error.message); else { await loadAll(); renderAll(); } }); }
function setProjProgress(id,val){ if(guardWrite()) return; sb.from('projects').update({progress:Math.max(0,Math.min(100,val))}).eq('id',id).then(async ({error})=>{ if(error) toast(error.message); else { await loadAll(); renderPortfolio(); } }); }
function addPortSession(){
  if(guardWrite()) return;
  if(!portfolioUnlocked()){ toast('Log today\u2019s study session first.'); return; }
  const ps = { user_id: currentUser.id, date: document.getElementById('portDate').value||todayStr(), hours: parseFloat(document.getElementById('portHours').value)||0, project: document.getElementById('portProject').value, notes: document.getElementById('portNotes').value.trim() };
  if(ps.hours<=0){ toast('Enter hours'); return; }
  sb.from('port_sessions').insert(ps).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    document.getElementById('portHours').value=''; document.getElementById('portNotes').value='';
    await loadAll(); renderAll(); toast('Portfolio hours logged');
  });
}
function delPort(id){
  if(guardWrite()) return;
  sb.from('port_sessions').delete().eq('id',id).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    await loadAll(); renderAll();
  });
}
function renderPortfolio(){
  applyPortfolioLock();
  const daily = window.STUDENT?.dailyStudyHours||3;
  const weeklyPort = window.STUDENT?.weeklyPortfolioHours||5;
  const todayStudy = sessions.filter(s=>s.date===todayStr()).reduce((a,s)=>a+s.hours,0);
  const ws = weekStart();
  const weekPort = portSessions.filter(s=>s.date>=ws).reduce((a,s)=>a+s.hours,0);
  const totalPort = portSessions.reduce((a,s)=>a+s.hours,0);
  document.getElementById('portStats').innerHTML = `
    <div class="stat-box"><div class="v">${projects.length}</div><div class="l">Projects</div></div>
    <div class="stat-box"><div class="v">${weekPort.toFixed(1)}</div><div class="l">This week (h)</div></div>
    <div class="stat-box"><div class="v">${totalPort.toFixed(1)}</div><div class="l">Total hours</div></div>
    <div class="stat-box"><div class="v">${Math.max(0,weeklyPort-weekPort).toFixed(1)}</div><div class="l">Remaining (h)</div></div>`;
  const statusEl = document.getElementById('portStudyStatus');
  if(todayStudy>=daily) statusEl.innerHTML = `<span class="pill good">Daily SAT study complete: ${todayStudy.toFixed(1)}h / ${daily}h</span> — portfolio hours are extra. Check override to log.`;
  else statusEl.innerHTML = `<span class="pill warn">Daily SAT study: ${todayStudy.toFixed(1)}h / ${daily}h</span> — portfolio hours allowed.`;
  const list = document.getElementById('projList');
  if(projects.length===0) list.innerHTML='<div class="empty">No projects yet. Add one to start tracking.</div>';
  else list.innerHTML = projects.map(p=>{
    const projHours = portSessions.filter(s=>s.project===p.name).reduce((a,s)=>a+s.hours,0);
    return `<div class="proj-card"><div class="head"><div><div class="name">${escape(p.name)} <span class="pill info">${p.category||''}</span></div><div class="meta">${escape(p.description||'No description')} · Target ${p.target_hours||0}h/week</div></div>
      <div class="row" style="gap:4px"><select onchange="setProjStatus('${p.id}',this.value)" style="width:auto;padding:4px 6px;font-size:11px">${['Planning','In Progress','Completed'].map(st=>`<option ${p.status===st?'selected':''}>${st}</option>`).join('')}</select>
      <button class="btn danger sm" onclick="delProject('${p.id}')">✕</button></div></div>
      <div class="meta">Hours logged: <b>${projHours.toFixed(1)}h</b> · Status: <b>${p.status}</b></div>
      <div class="row" style="gap:8px;margin-top:6px"><label style="margin:0;white-space:nowrap">Progress %</label><input type="number" min="0" max="100" value="${p.progress||0}" style="width:70px" onchange="setProjProgress('${p.id}',parseInt(this.value)||0)">
      <div class="progress" style="flex:1"><div style="width:${p.progress||0}%"></div></div><span style="font-size:12px;font-weight:600">${p.progress||0}%</span></div></div>`;
  }).join('');
  const sel = document.getElementById('portProject');
  sel.innerHTML = projects.length ? projects.map(p=>`<option>${escape(p.name)}</option>`).join('') : '<option>No projects</option>';
  const tb = document.getElementById('portTable');
  const sorted = [...portSessions].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  if(sorted.length===0){ tb.innerHTML='<tr><td colspan="5" class="empty">No sessions</td></tr>'; return; }
  tb.innerHTML = sorted.map(s=>`<tr><td>${s.date}</td><td>${s.hours}</td><td>${escape(s.project)}</td><td>${escape(s.notes)}</td><td><button class="btn danger sm" onclick="delPort('${s.id}')">✕</button></td></tr>`).join('');
}

// ---------- Goals ----------
let goalView='list';
function setGoalView(v){ goalView=v; document.getElementById('goalListBtn').classList.toggle('active',v==='list'); document.getElementById('goalCalBtn').classList.toggle('active',v==='calendar'); renderGoals(); }
function openGoalModal(){ document.getElementById('goalModal').classList.add('show'); }
function saveGoal(){
  if(guardWrite()) return;
  const g = { user_id: currentUser.id, text: document.getElementById('gText').value.trim(), category: document.getElementById('gCat').value, due_date: document.getElementById('gDate').value||null, priority: document.getElementById('gPrio').value, done:false };
  if(!g.text){ toast('Goal required'); return; }
  sb.from('goals').insert(g).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    closeModal('goalModal'); document.getElementById('gText').value=''; document.getElementById('gDate').value='';
    await loadAll(); renderAll(); toast('Goal added');
  });
}
function toggleGoal(i){
  if(guardWrite()) return;
  const g = goals[i];
  sb.from('goals').update({done:!g.done}).eq('id',g.id).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    await loadAll(); renderGoals();
  });
}
function delGoal(i){
  if(guardWrite()) return;
  const g = goals[i];
  sb.from('goals').delete().eq('id',g.id).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    await loadAll(); renderAll();
  });
}
function renderGoals(){
  const listEl=document.getElementById('goalsList'); const calEl=document.getElementById('goalsCalendar');
  if(goalView==='list'){
    listEl.style.display='block'; calEl.style.display='none';
    if(goals.length===0){ listEl.innerHTML='<div class="empty">No goals yet</div>'; return; }
    const groups = [
      { key:'realistic', title:'Realistic — this sprint', hint:'Doable in your 31-day window. Checking these off builds unstoppable momentum.', tone:'info' },
      { key:'dreamy', title:'Dreamy — the reason why', hint:'The bigger vision. These keep the daily work feeling like it means something.' }
    ];
    listEl.innerHTML = groups.map(gp=>{
      const items = goals.filter(g=>(g.category||'realistic')===gp.key);
      if(!items.length) return '';
      const doneCount = items.filter(g=>g.done).length;
      return `<div class="goal-group">
        <div class="goal-group-head">
          <h3>${gp.title}</h3>
          <span class="pill ${gp.key==='dreamy'?'purple':'info'}">${doneCount}/${items.length}</span>
        </div>
        ${gp.hint?`<p class="muted" style="font-size:12.5px;margin:-2px 0 8px">${gp.hint}</p>`:''}
        ${items.map(g=>{
          const realIdx = goals.indexOf(g);
          const overdue = g.due_date && !g.done && g.due_date < todayStr();
          return `<div class="list"><li><label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1"><input type="checkbox" class="checkbox" ${g.done?'checked':''} onchange="toggleGoal(${realIdx})"><span style="${g.done?'text-decoration:line-through;color:var(--muted)':''}">${escape(g.text)}</span></label>
          <div class="row" style="gap:6px">${g.due_date?`<span class="pill ${overdue?'bad':g.done?'good':'info'}">${g.due_date}</span>`:'<span class="pill gray">no date</span>'}<span class="pill ${g.priority==='high'?'bad':g.priority==='med'?'warn':'good'}">${g.priority}</span><button class="btn danger sm" onclick="delGoal(${realIdx})">✕</button></div></li></div>`;
        }).join('')}
      </div>`;
    }).join('');
  } else {
    listEl.style.display='none'; calEl.style.display='block';
    const now=new Date(); const y=now.getFullYear(), m=now.getMonth();
    const first=new Date(y,m,1); const last=new Date(y,m+1,0); const startDay=first.getDay(); const daysInMonth=last.getDate();
    const monthName=first.toLocaleString('default',{month:'long',year:'numeric'});
    let html=`<h3 style="text-transform:none;letter-spacing:0;color:var(--ink);font-size:15px;margin-bottom:8px">${monthName}</h3><div class="cal-grid">`;
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d=>{ html+=`<div style="text-align:center;font-size:10px;color:var(--muted);font-weight:700;padding:4px">${d}</div>`; });
    for(let i=0;i<startDay;i++) html+=`<div class="cal-cell"></div>`;
    for(let d=1;d<=daysInMonth;d++){
      const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayGoals=goals.filter(g=>g.due_date===ds);
      html+=`<div class="cal-cell ${dayGoals.length?'has':''}"><div class="d">${d}</div>${dayGoals.map(g=>`<div class="goal">${escape(g.text.slice(0,22))}</div>`).join('')}</div>`;
    }
    html+='</div>'; calEl.innerHTML=html;
  }
}

// ---------- Schedule ----------
function renderSchedule(){
  const wk = document.getElementById('weeklySchedule');
  if(wk && window.SCHEDULE && window.SCHEDULE.weekly.length){
    wk.innerHTML = window.SCHEDULE.weekly.map(d=>`<tr><td><b>${d.day}</b></td><td>${d.study}</td><td>${d.port}</td><td>${d.checkpoint}</td></tr>`).join('');
  }
  const ms = document.getElementById('milestones');
  if(ms && window.SCHEDULE && window.SCHEDULE.milestones.length){
    ms.innerHTML = window.SCHEDULE.milestones.map(m=>`<li><span><b>${m.label}:</b> ${m.desc}</span><span class="pill ${m.tone}">${m.target}</span></li>`).join('');
  }
}

// ---------- Day plan ----------
function resourceCell(day){
  const list = day.res||[];
  if(!list.length) return '<span class="muted">—</span>';
  if(list.length===1){
    const r=list[0];
    return `<a href="${escape(r.u)}" target="_blank" rel="noopener" class="res-link">${escape(r.t)}${r.paid?' <span class="pill warn">paid</span>':''}</a>`;
  }
  // multiple → dropdown that opens the chosen resource
  return `<select class="res-drop" onchange="if(this.value){window.open(this.value,'_blank');this.selectedIndex=0;}" aria-label="${list.length} resources">
    <option value="">${list.length} resources ▾</option>
    ${list.map(r=>`<option value="${escape(r.u)}">${escape(r.t)}${r.paid?' (paid)':''}</option>`).join('')}
  </select>`;
}

function renderDayPlan(){
  const tb = document.getElementById('dayPlanTable');
  if(!tb||!window.PLAN||!window.PLAN.length) return;
  tb.innerHTML = window.PLAN.map(e=>{
    const isToday = e.d === todayStr();
    const past = e.d < todayStr();
    return `<tr style="${isToday?'background:#eef2ff;font-weight:600':''}${past?'opacity:.7':''}">
      <td>${e.d}<br><span style="font-size:10px;color:var(--muted)">${new Date(e.d).toLocaleDateString('en-US',{weekday:'short'})}</span></td>
      <td><span class="pill ${e.ph==='TEST DAY'?'warn':'info'}">${e.ph}</span></td>
      <td style="font-size:12px">${e.sat}</td>
      <td style="font-size:12px">${e.port}</td>
      <td style="font-size:12px">${resourceCell(e)}</td>
      <td style="font-size:12px">${e.chk}</td>
    </tr>`;
  }).join('');
}

// ---------- Resources ----------
function renderResources(){
  const el = document.getElementById('resourceList');
  if(!el||!window.RESOURCES) return;
  el.innerHTML = window.RESOURCES.map(g=>`<h3>${g.category}</h3>`+g.resources.map(r=>`<div class="resource"><div class="title">${escape(r.title)}</div><div class="meta">${escape(r.meta)}</div><div class="desc">${escape(r.desc)}</div></div>`).join('')).join('');
}

// ---------- Master render ----------
function renderAll(){
  renderDashboard();
  renderAssignments();
  renderSessions();
  renderSessionsCalendar();
  renderErrorLog();
  renderScores();
  renderPortfolio();
  renderGoals();
  renderSchedule();
  renderDayPlan();
  renderResources();
  if(isAdmin && document.getElementById('admin') && document.getElementById('admin').classList.contains('active')){
    if(adminView==='overview') renderAdminOverview();
    if(adminView==='grade') renderGradeQueue();
    if(adminView==='progress') renderProgress();
    if(adminView==='message') renderMessageView();
  }
}
