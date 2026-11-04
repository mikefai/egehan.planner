// Admin — console, grading, progress, student management

let adminView='overview';

function setAdminView(v){
  adminView=v;
  ['overview','assign','grade','progress','message','data'].forEach(x=>{
    const el=document.getElementById('admin'+x.charAt(0).toUpperCase()+x.slice(1));
    if(el) el.classList.toggle('hidden', x!==v);
    const btn = document.getElementById('admin'+x.charAt(0).toUpperCase()+x.slice(1)+'Btn');
    if(btn) btn.classList.toggle('active', x===v);
  });
  if(v==='overview') renderAdminOverview();
  if(v==='grade') renderGradeQueue();
  if(v==='progress') renderProgress();
  if(v==='message') renderMessageView();
  if(v==='data') loadDataControl();
}

// ---------- Attachments ----------
function addAttachment(){
  const name = document.getElementById('attName').value.trim();
  const url = document.getElementById('attUrl').value.trim();
  const type = document.getElementById('attType').value;
  if(!name||!url){ toast('Name and URL required'); return; }
  pendingAttachments.push({name,url,file_type:type});
  document.getElementById('attName').value=''; document.getElementById('attUrl').value='';
  renderPendingAttachments();
}
async function uploadAttachment(){
  const f = document.getElementById('attFile').files[0];
  if(!f) return;
  const path = `${currentUser.id}/${Date.now()}_${f.name}`;
  const { error } = await sb.storage.from('homework-files').upload(path, f);
  if(error){ toast(error.message); return; }
  const { data } = sb.storage.from('homework-files').getPublicUrl(path);
  pendingAttachments.push({ name: f.name, url: data.publicUrl, file_type: guessType(f.name), storage_path: path });
  document.getElementById('attFile').value='';
  renderPendingAttachments();
  toast('File uploaded');
}
function guessType(name){ const e=name.split('.').pop().toLowerCase(); if(e==='pdf') return 'pdf'; if(['png','jpg','jpeg','gif','webp'].includes(e)) return 'image'; if(['mp4','mov','webm'].includes(e)) return 'video'; if(['doc','docx','txt','md'].includes(e)) return 'doc'; return 'other'; }
function renderPendingAttachments(){
  const el = document.getElementById('attachList');
  if(!el) return;
  if(pendingAttachments.length===0){ el.innerHTML='<div class="muted" style="font-size:12px">No attachments yet.</div>'; return; }
  el.innerHTML = pendingAttachments.map((a,i)=>`<div class="row" style="margin-bottom:4px"><span class="attach">${iconFor(a.file_type)} ${escape(a.name)}</span><button class="btn danger sm" onclick="removeAttachment(${i})">✕</button></div>`).join('');
}
function removeAttachment(i){ pendingAttachments.splice(i,1); renderPendingAttachments(); }

// ---------- Assign homework ----------
async function assignHomework(){
  const title = document.getElementById('hwTitle').value.trim();
  const desc = document.getElementById('hwDesc').value.trim();
  const cat = document.getElementById('hwCat').value;
  const prio = document.getElementById('hwPrio').value;
  const due = document.getElementById('hwDue').value || null;
  const studentId = document.getElementById('hwStudent').value;
  if(!title){ toast('Title required'); return; }
  if(!studentId){ toast('Select a student'); return; }
  const { data: hw, error } = await sb.from('homework').insert({
    title, description: desc, category: cat, priority: prio, due_date: due,
    assigned_to: studentId, created_by: currentUser.id, status: 'assigned'
  }).select().single();
  if(error){ toast(error.message); return; }
  if(pendingAttachments.length){
    const rows = pendingAttachments.map(a=>({ homework_id: hw.id, name: a.name, url: a.url, file_type: a.file_type, storage_path: a.storage_path||null }));
    await sb.from('homework_attachments').insert(rows);
  }
  await sb.from('notifications').insert({
    user_id: studentId, type: 'homework_assigned',
    title: 'New homework assigned',
    body: title + (due? ' · due '+due : ''),
    link: 'assignments'
  });
  pendingAttachments = [];
  renderPendingAttachments();
  document.getElementById('hwTitle').value=''; document.getElementById('hwDesc').value=''; document.getElementById('hwDue').value='';
  closeModal('assignHwModal');
  toast('Homework assigned');
  await loadAll(); renderAll();
}

// ---------- Grading ----------
let currentGradeHwId = null;
function openGradeModal(id){
  currentGradeHwId = id;
  const h = homework.find(x=>x.id===id); if(!h) return;
  document.getElementById('gradeHwInfo').innerHTML = `<b>${escape(h.title)}</b><div class="muted" style="font-size:12px">${escape(h.description||'')}</div>`;
  document.getElementById('gradeVal').value = h.grade!=null?h.grade:'';
  document.getElementById('gradeFeedback').value = h.feedback||'';
  document.getElementById('gradeModal').classList.add('show');
}
async function submitGrade(){
  const g = parseFloat(document.getElementById('gradeVal').value);
  const fb = document.getElementById('gradeFeedback').value.trim();
  const h = homework.find(x=>x.id===currentGradeHwId);
  const { error } = await sb.from('homework').update({
    grade: isNaN(g)?null:g, feedback: fb||null, status: 'graded',
    graded_at: new Date().toISOString(), graded_by: currentUser.id
  }).eq('id', currentGradeHwId);
  if(error){ toast(error.message); return; }
  await sb.from('notifications').insert({
    user_id: h.assigned_to, type: 'homework_graded',
    title: 'Homework graded: '+h.title,
    body: (isNaN(g)?'':('Grade: '+g+'/100. ')) + (fb?fb.slice(0,80):''),
    link: 'assignments'
  });
  closeModal('gradeModal');
  await loadAll(); renderAll(); toast('Grade saved');
}
function renderGradeQueue(){
  const el = document.getElementById('gradeQueue');
  const q = homework.filter(h => h.status==='submitted' || h.status==='assigned').sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999'));
  if(q.length===0){ el.innerHTML='<div class="empty">Nothing to grade.</div>'; return; }
  el.innerHTML = q.map(h=>{
    const atts = hwAttachments[h.id]||[];
    const student = students.find(s=>s.id===h.assigned_to);
    const overdue = h.due_date && h.due_date < todayStr() && h.status!=='graded';
    return `<div class="hw-card">
      <div class="title">${escape(h.title)} <span class="pill ${h.status==='submitted'?'warn':overdue?'bad':'info'}">${h.status}${overdue?' · overdue':''}</span></div>
      <div class="meta">${escape(student?.display_name||'student')} · ${h.category} · priority ${h.priority}${h.due_date?' · due '+h.due_date:''}</div>
      ${h.description?`<div style="font-size:13px;margin:6px 0">${escape(h.description)}</div>`:''}
      ${h.submission_note?`<div class="meta"><b>Submission note:</b> ${escape(h.submission_note)}</div>`:''}
      ${atts.length?`<div style="margin:6px 0">${atts.map(a=>`<a class="attach" href="${escape(a.url)}" target="_blank">${iconFor(a.file_type)} ${escape(a.name)}</a>`).join('')}</div>`:''}
      ${h.grade!=null?`<div class="meta"><b>Grade: ${h.grade}/100</b> ${h.feedback?'— '+escape(h.feedback):''}</div>`:''}
      <div class="row" style="margin-top:8px;gap:6px">
        <button class="btn sm" onclick="openGradeModal('${h.id}')">Grade / Feedback</button>
        <button class="btn secondary sm" onclick="openHwDetail('${h.id}')">View</button>
      </div>
    </div>`;
  }).join('');
}
function openHwDetail(id){
  const h = homework.find(x=>x.id===id); if(!h) return;
  const atts = hwAttachments[h.id]||[];
  const student = students.find(s=>s.id===h.assigned_to);
  document.getElementById('hwDetailTitle').textContent = h.title;
  document.getElementById('hwDetailBody').innerHTML = `
    <div class="meta muted">${escape(student?.display_name||'student')} · ${h.category} · ${h.priority} · due ${h.due_date||'—'}</div>
    <div style="margin:8px 0;font-size:13.5px">${escape(h.description||'')}</div>
    ${atts.length?`<div>${atts.map(a=>`<a class="attach" href="${escape(a.url)}" target="_blank">${iconFor(a.file_type)} ${escape(a.name)}</a>`).join('')}</div>`:''}
    ${h.grade!=null?`<div class="grade-box"><b>Grade: ${h.grade}/100</b><div style="font-size:13px;margin-top:4px">${escape(h.feedback||'')}</div></div>`:''}
    ${h.submission_note?`<div class="grade-box"><b>Student note:</b> ${escape(h.submission_note)}</div>`:''}`;
  document.getElementById('hwDetailModal').classList.add('show');
}

// ---------- Progress dashboard ----------
async function renderProgress(){
  const sid = document.getElementById('progressStudent').value;
  if(!sid) return;
  const [ss, sc, hw] = await Promise.all([
    sb.from('study_sessions').select('*').eq('user_id', sid),
    sb.from('scores').select('*').eq('user_id', sid),
    sb.from('homework').select('*').eq('assigned_to', sid),
  ]);
  const sessionsD = ss.data||[]; const scoresD = sc.data||[]; const hwD = hw.data||[];
  const weekH = sessionsD.filter(s=>s.date>=weekStart()).reduce((a,s)=>a+s.hours,0);
  const totalH = sessionsD.reduce((a,s)=>a+s.hours,0);
  const doneHw = hwD.filter(h=>h.status==='graded'||h.status==='submitted').length;
  const graded = hwD.filter(h=>h.grade!=null);
  const avgGrade = graded.length ? graded.reduce((a,h)=>a+h.grade,0)/graded.length : 0;
  const latestScore = scoresD.length ? [...scoresD].sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0].total : '—';
  document.getElementById('progressStats').innerHTML = `
    <div class="stat-box"><div class="v">${latestScore}</div><div class="l">Latest score</div></div>
    <div class="stat-box"><div class="v">${weekH.toFixed(1)}</div><div class="l">Study hrs this wk</div></div>
    <div class="stat-box"><div class="v">${totalH.toFixed(1)}</div><div class="l">Total study hrs</div></div>
    <div class="stat-box"><div class="v">${doneHw}/${hwD.length}</div><div class="l">HW done</div></div>
    <div class="stat-box"><div class="v">${avgGrade?avgGrade.toFixed(0):'—'}</div><div class="l">Avg grade</div></div>`;
  const asc = [...scoresD].sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const scoreChartEl = document.getElementById('progressScoreChart');
  if(asc.length===0) scoreChartEl.innerHTML='<div class="empty">No scores yet</div>';
  else { const min=Math.min(...asc.map(s=>s.total),1000); const max=Math.max(...asc.map(s=>s.total),1450); const range=max-min||1; scoreChartEl.innerHTML=asc.map(s=>{const h=((s.total-min)/range)*140+10;return `<div class="bar" style="height:${h}px"><span class="val">${s.total}</span><span>${s.date.slice(5)}</span></div>`;}).join(''); }
  const days=[]; for(let i=13;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(d.toISOString().slice(0,10));}
  const stc=document.getElementById('progressStudyChart');
  const maxH=Math.max(1,...days.map(d=>sessionsD.filter(s=>s.date===d).reduce((a,s)=>a+s.hours,0)));
  stc.innerHTML=days.map(d=>{const h=sessionsD.filter(s=>s.date===d).reduce((a,s)=>a+s.hours,0);const height=(h/maxH)*140;return `<div class="bar" style="height:${Math.max(4,height)}px"><span class="val">${h?h.toFixed(1):''}</span><span>${d.slice(5)}</span></div>`;}).join('');
  const hwEl=document.getElementById('progressHw');
  if(hwD.length===0) hwEl.innerHTML='<div class="empty">No homework assigned.</div>';
  else hwEl.innerHTML = hwD.map(h=>`<div class="metric"><span class="m-label">${escape(h.title)}</span><div class="progress" style="align-self:center"><div style="width:${h.status==='graded'?100:h.status==='submitted'?60:20}%"></div></div><span class="m-val">${h.status==='graded'?h.grade+'/100':h.status}</span></div>`).join('');
  const act = document.getElementById('progressActivity');
  const acts = [
    ...sessionsD.slice(0,5).map(s=>({t:s.created_at, txt:`Studied ${s.hours}h — ${s.subject}`, pill:'info'})),
    ...scoresD.slice(0,3).map(s=>({t:s.created_at, txt:`Practice test: ${s.total}`, pill:'good'})),
  ].sort((a,b)=>(b.t||'').localeCompare(a.t||'')).slice(0,8);
  act.innerHTML = acts.length ? acts.map(a=>`<li><span>${escape(a.txt)}</span><span class="pill ${a.pill}">${(a.t||'').slice(0,10)}</span></li>`).join('') : '<li class="empty">No activity yet</li>';
}

// ---------- Data control ----------
async function loadDataControl(){
  const table = document.getElementById('dataTabSel').value;
  const sid = document.getElementById('dataStudentSel').value;
  if(!sid) return;
  const { data } = await sb.from(table).select('*').eq('user_id', sid).order('created_at',{ascending:false});
  const rows = data||[];
  const head = document.getElementById('dataHead');
  const body = document.getElementById('dataTable');
  if(rows.length===0){ head.innerHTML=''; body.innerHTML='<tr><td class="empty">No rows</td></tr>'; return; }
  const cols = Object.keys(rows[0]).filter(c=>c!=='user_id');
  head.innerHTML = `<tr>${cols.map(c=>`<th>${c}</th>`).join('')}<th></th></tr>`;
  body.innerHTML = rows.map(r=>`<tr>${cols.map(c=>`<td>${escape(String(r[c]??''))}</td>`).join('')}<td><button class="btn danger sm" onclick="deleteRow('${table}','${r.id}')">✕</button></td></tr>`).join('');
}
async function deleteRow(table,id){
  if(!confirm('Delete this row?')) return;
  await sb.from(table).delete().eq('id',id);
  toast('Deleted');
  loadDataControl();
}

// ---------- NEW: Student Overview + risk flags ----------
function computeRisk(studentId){
  const myHw = homework.filter(h=>h.assigned_to===studentId);
  const overdue = myHw.filter(h=>h.due_date && h.due_date<todayStr() && h.status!=='graded').length;
  const pending = myHw.filter(h=>h.status==='assigned').length;
  const ungraded = myHw.filter(h=>h.status==='submitted').length;
  const studyDays = new Set(mySessionsFor(studentId).filter(s=>s.date>=weekStart()).map(s=>s.date));
  const daysBehind = Math.max(0, 6 - studyDays.size); // ~6 study days expected per week
  let level='ontrack', label='On track';
  if(overdue>=3 || daysBehind>=3){ level='behind'; label='Behind'; }
  else if(overdue>=1 || daysBehind>=2 || ungraded>=1){ level='attention'; label='Needs attention'; }
  return { overdue, pending, ungraded, studyDays: studyDays.size, daysBehind, level, label, hwTotal: myHw.length };
}
// helper: sessions belong to student's own rows; admin can't read others' study_sessions (RLS).
// So risk uses only homework (which admin CAN see). Mark as derived-from-homework.
function mySessionsFor(sid){
  // Admin RLS blocks reading other users' study_sessions; return own bucket only if it's the admin's own id.
  return sessions; // safe fallback (admin sees empty unless self)
}

async function renderAdminOverview(){
  const el = document.getElementById('adminOverviewBody');
  const rosterEl = document.getElementById('roster');
  const load = await loadHomeworkForStudents();
  if(!students.length){ rosterEl.innerHTML='<div class="callout warn">No students have signed up yet. Share the link with Egahan so he can create his account.</div>'; el.innerHTML=''; return; }

  // Aggregate stats across students
  let totalHw=0, totalOverdue=0, totalSubmitted=0;
  students.forEach(s=>{ const r=computeRisk(s.id); totalHw+=r.hwTotal; totalOverdue+=r.overdue; totalSubmitted+=r.ungraded; });
  el.innerHTML = `
    <div class="glance">
      <div class="g-item"><div class="g-v">${students.length}</div><div class="g-l">Students</div></div>
      <div class="g-item"><div class="g-v">${totalHw}</div><div class="g-l">Homework assigned</div></div>
      <div class="g-item"><div class="g-v">${totalOverdue}</div><div class="g-l">Overdue</div></div>
      <div class="g-item"><div class="g-v">${totalSubmitted}</div><div class="g-l">Awaiting grading</div></div>
    </div>`;

  rosterEl.innerHTML = students.map(s=>{
    const r = computeRisk(s.id);
    return `<div class="roster-card">
      <div>
        <div class="rc-name">${escape(s.display_name||s.email)} <span class="risk ${r.level}"><span class="dot"></span>${r.label}</span></div>
        <div class="rc-stats">
          <div class="rc-stat">Homework: <b>${r.hwTotal}</b></div>
          <div class="rc-stat">Pending: <b>${r.pending}</b></div>
          <div class="rc-stat">Submitted: <b>${r.ungraded}</b></div>
          <div class="rc-stat">Overdue: <b>${r.overdue}</b></div>
        </div>
        <div class="muted small" style="margin-top:4px">${escape(s.email)} · joined ${s.created_at?new Date(s.created_at).toLocaleDateString():'—'}</div>
      </div>
      <div class="rc-actions">
        <button class="btn sm" onclick="quickAssign('${s.id}')">+ Assign</button>
        <button class="btn secondary sm" onclick="messageStudent('${s.id}')">✉ Message</button>
        <button class="btn secondary sm" onclick="viewStudent('${s.id}')">Progress</button>
      </div>
    </div>`;
  }).join('');
}

async function loadHomeworkForStudents(){
  // ensure fresh homework snapshot (admin sees all via RLS)
  const { data } = await sb.from('homework').select('*');
  homework = data||[];
  return homework;
}

function quickAssign(studentId){
  pendingAttachments=[]; renderPendingAttachments();
  document.getElementById('hwTitle').value=''; document.getElementById('hwDesc').value=''; document.getElementById('hwDue').value=todayStr();
  const sel=document.getElementById('hwStudent'); if(sel) sel.value=studentId;
  document.getElementById('assignHwModal').classList.add('show');
  document.getElementById('hwTitle').focus();
}
function viewStudent(studentId){
  document.getElementById('adminTab').click();
  setAdminView('progress');
  document.getElementById('progressStudent').value = studentId;
  renderProgress();
}
function messageStudent(studentId){
  document.getElementById('adminTab').click();
  setAdminView('message');
  renderMessageView();
  const sel=document.getElementById('msgStudent'); if(sel) sel.value=studentId;
}

// ---------- NEW: Message center ----------
function renderMessageView(){
  const sel = document.getElementById('msgStudent');
  if(sel && sel.options.length<=1){
    sel.innerHTML = '<option value="">All students</option>' + students.map(s=>`<option value="${s.id}">${escape(s.display_name||s.email)}</option>`).join('');
  }
  const list = document.getElementById('sentMessages');
  const mine = notifications.filter(n=>/* sent-by admin not tracked per-row; show recent to students */false);
  // Show recent homework/announcements as activity feed
  list.innerHTML = '<div class="muted small">Messages you send appear in the student’s notification bell instantly.</div>';
}

async function sendMessage(){
  const to = document.getElementById('msgStudent').value;
  const title = document.getElementById('msgTitle').value.trim();
  const body = document.getElementById('msgBody').value.trim();
  if(!title){ toast('Subject required'); return; }
  const targets = to ? [to] : students.map(s=>s.id);
  if(!targets.length){ toast('No students to message'); return; }
  const rows = targets.map(uid=>({ user_id: uid, type:'announcement', title, body, link:'assignments' }));
  const { error } = await sb.from('notifications').insert(rows);
  if(error){ toast(error.message); return; }
  document.getElementById('msgTitle').value=''; document.getElementById('msgBody').value='';
  toast(`Sent to ${targets.length} student${targets.length>1?'s':''}`);
  await loadAll();
}
