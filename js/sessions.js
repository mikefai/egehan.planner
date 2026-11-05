// Sessions — 1:1 study session calendar (teacher proposes, learner confirms)

let pendingSessionAttachments = null; // unused, reserved

function shiftMonth(delta){
  oneOnOneMonth = new Date(oneOnOneMonth.getFullYear(), oneOnOneMonth.getMonth()+delta, 1);
  renderSessionsCalendar();
}

function statusPill(s){
  if(s.status==='confirmed') return '<span class="pill good">confirmed</span>';
  if(s.status==='cancelled') return '<span class="pill gray">cancelled</span>';
  return '<span class="pill warn">awaiting confirmation</span>';
}

function renderSessionsCalendar(){
  const wrap = document.getElementById('sessionsCalendar');
  const list = document.getElementById('sessionsList');
  // role-specific helper text
  const hint = document.getElementById('sessionsHint');
  if(hint) hint.textContent = isAdmin
    ? 'Click any day to propose a session. It stays “awaiting confirmation” until the student accepts.'
    : 'These are sessions your teacher scheduled. Confirm the ones that work and request a reschedule when needed.';
  if(!wrap) return;
  const y=oneOnOneMonth.getFullYear(), m=oneOnOneMonth.getMonth();
  const first=new Date(y,m,1), last=new Date(y,m+1,0);
  const startDay=first.getDay(), daysInMonth=last.getDate();
  const monthName=first.toLocaleString('default',{month:'long',year:'numeric'});

  // header with month nav (+ Add button for admin)
  document.getElementById('sessionsMonthLabel').textContent = monthName;
  const addBtn = document.getElementById('addSessionBtn');
  if(addBtn) addBtn.style.display = isAdmin ? '' : 'none';

  let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    .map(d=>`<div style="text-align:center;font-size:10px;color:var(--muted);font-weight:700;padding:6px 0">${d}</div>`).join('');
  for(let i=0;i<startDay;i++) html += `<div class="cal-cell s-cal"></div>`;
  for(let d=1;d<=daysInMonth;d++){
    const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const daySessions = oneOnOne.filter(s=>s.date===ds);
    const isToday = ds===todayStr();
    const clickable = isAdmin ? ` onclick="openProposeSession('${ds}')" style="cursor:pointer"` : '';
    html += `<div class="cal-cell s-cal${daySessions.length?' has':''}${isToday?' today':''}"${clickable}>
      <div class="d">${d}</div>
      ${daySessions.map(s=>`<div class="s-chip ${s.status}">${s.start_time?escape(s.start_time)+' · ':''}${escape(s.topic)}</div>`).join('')}
      ${isAdmin?'<div class="cal-add">＋</div>':''}
    </div>`;
  }
  wrap.innerHTML = `<div class="cal-grid">${html}</div>`;

  // upcoming list with actions
  const upcoming = oneOnOne.filter(s=>s.date>=todayStr() && s.status!=='cancelled').sort((a,b)=>a.date.localeCompare(b.date));
  if(!upcoming.length){ list.innerHTML='<div class="empty">No upcoming 1:1 sessions.</div>'; return; }
  list.innerHTML = upcoming.map(s=>{
    const canConfirm = !isAdmin && s.status==='proposed';
    const canManage = isAdmin;
    return `<div class="session-item ${s.status}">
      <div class="s-when">${new Date(s.date).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}<div class="muted small">${s.start_time||'TBD'}${s.end_time?'–'+s.end_time:''}</div></div>
      <div class="s-body">
        <div class="s-topic">${escape(s.topic)}</div>
        ${s.notes?`<div class="muted small">${escape(s.notes)}</div>`:''}
        <div style="margin-top:4px">${statusPill(s)}</div>
      </div>
      <div class="s-actions">
        ${canConfirm?`<button class="btn sm" onclick="confirmSession('${s.id}')">Confirm</button>`:''}
        ${canConfirm?`<button class="btn secondary sm" onclick="declineSession('${s.id}')">Reschedule</button>`:''}
        ${canManage&&s.status==='proposed'?`<span class="muted small">sent to student</span>`:''}
        ${canManage&&s.status==='confirmed'?`<span class="pill good">confirmed by student</span>`:''}
        ${canManage?`<button class="btn secondary sm" onclick="cancelSession('${s.id}')">Cancel</button>`:''}
      </div>
    </div>`;
  }).join('');
}

function openProposeSession(dateStr){
  if(!isAdmin){ toast('Teacher only'); return; }
  if(viewAsStudent){ toast('Exit student preview to schedule sessions.'); return; }
  document.getElementById('ssDate').value = dateStr || todayStr();
  document.getElementById('ssTopic').value=''; document.getElementById('ssNotes').value='';
  document.getElementById('ssStart').value=''; document.getElementById('ssEnd').value='';
  document.getElementById('proposeSessionModal').classList.add('show');
}

async function proposeSession(){
  if(guardWrite()) return;
  const date=document.getElementById('ssDate').value;
  const topic=document.getElementById('ssTopic').value.trim();
  const notes=document.getElementById('ssNotes').value.trim();
  const start=document.getElementById('ssStart').value;
  const end=document.getElementById('ssEnd').value;
  const studentId=document.getElementById('ssStudent').value;
  if(!date||!topic){ toast('Date and topic required'); return; }
  if(!studentId){ toast('Select a student'); return; }
  const { error } = await sb.from('sessions_1on1').insert({
    date, start_time:start||null, end_time:end||null, topic, notes:notes||null,
    student_id:studentId, teacher_id:currentUser.id, status:'proposed'
  });
  if(error){ toast(error.message); return; }
  await sb.from('notifications').insert({
    user_id:studentId, type:'session_proposed',
    title:'New 1:1 session proposed',
    body:`${topic} · ${date}${start?' '+start:''} — open Sessions to confirm.`,
    link:'sessions'
  });
  closeModal('proposeSessionModal');
  toast('Session proposed');
  await loadAll(); renderAll();
}

async function confirmSession(id){
  if(guardWrite()) return;
  const s=oneOnOne.find(x=>x.id===id); if(!s) return;
  const { error } = await sb.from('sessions_1on1').update({ status:'confirmed', confirmed_at:new Date().toISOString() }).eq('id', id);
  if(error){ toast(error.message); return; }
  await sb.from('notifications').insert({
    user_id: s.teacher_id, type:'session_confirmed',
    title:'Student confirmed your 1:1', body:`${s.topic} · ${s.date}`, link:'sessions'
  });
  toast('Session confirmed');
  await loadAll(); renderAll();
}

async function declineSession(id){
  if(guardWrite()) return;
  const s=oneOnOne.find(x=>x.id===id); if(!s) return;
  const { error } = await sb.from('sessions_1on1').update({ status:'proposed', notes: (s.notes?s.notes+' | ':'')+'student requested reschedule' }).eq('id', id);
  if(error){ toast(error.message); return; }
  await sb.from('notifications').insert({
    user_id: s.teacher_id, type:'session_reschedule',
    title:'Student wants to reschedule', body:`${s.topic} · ${s.date}`, link:'sessions'
  });
  toast('Teacher notified');
  await loadAll(); renderAll();
}

async function cancelSession(id){
  if(guardWrite()) return;
  if(!confirm('Cancel this session?')) return;
  const s=oneOnOne.find(x=>x.id===id); if(!s) return;
  const { error } = await sb.from('sessions_1on1').update({ status:'cancelled' }).eq('id', id);
  if(error){ toast(error.message); return; }
  await sb.from('notifications').insert({
    user_id: s.student_id, type:'session_cancelled',
    title:'1:1 session cancelled', body:`${s.topic} · ${s.date}`, link:'sessions'
  });
  toast('Session cancelled');
  await loadAll(); renderAll();
}

// populate the propose-student dropdown (called from loadAll when admin)
function renderSessionStudentOptions(){
  const sel=document.getElementById('ssStudent');
  if(sel) sel.innerHTML = students.map(s=>`<option value="${s.id}">${escape(s.display_name||s.email)}</option>`).join('') || '<option value="">No students</option>';
}
