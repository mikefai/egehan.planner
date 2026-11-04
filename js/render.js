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
  const patch = { status };
  if(status==='submitted'){ patch.submitted_at = new Date().toISOString(); }
  sb.from('homework').update(patch).eq('id', id).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    await loadAll(); renderAll();
  });
}

function delAssign(id){
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
  const sc = { user_id: currentUser.id, date: document.getElementById('scoreDate').value||todayStr(), total: parseInt(document.getElementById('scoreTotal').value)||0, math: parseInt(document.getElementById('scoreMath').value)||0, rw: parseInt(document.getElementById('scoreRW').value)||0, notes: document.getElementById('scoreNotes').value.trim() };
  if(sc.total<400){ toast('Enter total score'); return; }
  sb.from('scores').insert(sc).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    ['scoreTotal','scoreMath','scoreRW','scoreNotes'].forEach(id=>document.getElementById(id).value='');
    await loadAll(); renderAll(); toast('Score logged');
  });
}

function delScore(id){
  sb.from('scores').delete().eq('id',id).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    await loadAll(); renderAll();
  });
}

function renderScores(){
  const tb = document.getElementById('scoreTable');
  const sorted = [...scores].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  if(sorted.length===0){ tb.innerHTML='<tr><td colspan="6" class="empty">No scores yet</td></tr>'; return; }
  tb.innerHTML = sorted.map(s=>`<tr><td>${s.date}</td><td><b>${s.total}</b></td><td>${s.math}</td><td>${s.rw}</td><td>${escape(s.notes)}</td><td><button class="btn danger sm" onclick="delScore('${s.id}')">✕</button></td></tr>`).join('');
  const asc = [...scores].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const chart = document.getElementById('scoreChart');
  if(asc.length===0){ chart.innerHTML=''; return; }
  const min = Math.min(...asc.map(s=>s.total),1000); const max = Math.max(...asc.map(s=>s.total),1450); const range = max-min||1;
  chart.innerHTML = asc.map(s=>{ const h=((s.total-min)/range)*150+10; return `<div class="bar" style="height:${h}px"><span class="val">${s.total}</span><span>${s.date.slice(5)}</span></div>`; }).join('');
}

// ---------- Portfolio ----------
// Unlock rule: the portfolio page opens once the learner has logged at least one
// study session for today (i.e. entered their daily study log). Admin bypasses.
function portfolioUnlocked(){
  if(isAdmin) return true;
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
  sb.from('projects').delete().eq('id',id).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    await loadAll(); renderAll();
  });
}
function setProjStatus(id,status){ sb.from('projects').update({status}).eq('id',id).then(async ({error})=>{ if(error) toast(error.message); else { await loadAll(); renderAll(); } }); }
function setProjProgress(id,val){ sb.from('projects').update({progress:Math.max(0,Math.min(100,val))}).eq('id',id).then(async ({error})=>{ if(error) toast(error.message); else { await loadAll(); renderPortfolio(); } }); }
function addPortSession(){
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
  const g = { user_id: currentUser.id, text: document.getElementById('gText').value.trim(), category: document.getElementById('gCat').value, due_date: document.getElementById('gDate').value||null, priority: document.getElementById('gPrio').value, done:false };
  if(!g.text){ toast('Goal required'); return; }
  sb.from('goals').insert(g).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    closeModal('goalModal'); document.getElementById('gText').value=''; document.getElementById('gDate').value='';
    await loadAll(); renderAll(); toast('Goal added');
  });
}
function toggleGoal(i){
  const g = goals[i];
  sb.from('goals').update({done:!g.done}).eq('id',g.id).then(async ({error})=>{
    if(error){ toast(error.message); return; }
    await loadAll(); renderGoals();
  });
}
function delGoal(i){
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
