// API — Supabase client + all database operations

async function loadStudentData(){
  try {
    const [plan, resources, schedule, student] = await Promise.all([
      fetch('data/plan.json').then(r=>r.json()),
      fetch('data/resources.json').then(r=>r.json()),
      fetch('data/schedule.json').then(r=>r.json()),
      fetch('data/student.json').then(r=>r.json()),
    ]);
    window.STUDENT = student;
    window.PLAN = plan;
    window.RESOURCES = resources;
    window.SCHEDULE = schedule;
  } catch(e){
    console.warn('Could not load JSON files', e);
    // Fallback so app still runs (e.g. opened via file://)
    window.PLAN = []; window.RESOURCES = []; window.SCHEDULE = {weekly:[],milestones:[]};
    window.STUDENT = {displayName:'Egahan Sahban',currentScore:1200,targetScore:1450,testDate:'2026-12-05',dailyStudyHours:3,weeklyPortfolioHours:5};
  }
}

async function loadAll(){
  const uid = currentUser.id;
  const [s, sc, p, ps, g, hw, n] = await Promise.all([
    sb.from('study_sessions').select('*').eq('user_id', uid).order('date',{ascending:false}),
    sb.from('scores').select('*').eq('user_id', uid).order('date',{ascending:false}),
    sb.from('projects').select('*').eq('user_id', uid).order('created_at',{ascending:false}),
    sb.from('port_sessions').select('*').eq('user_id', uid).order('date',{ascending:false}),
    sb.from('goals').select('*').eq('user_id', uid).order('created_at',{ascending:false}),
    isAdmin
      ? sb.from('homework').select('*').order('created_at',{ascending:false})
      : sb.from('homework').select('*').eq('assigned_to', uid).order('created_at',{ascending:false}),
    sb.from('notifications').select('*').eq('user_id', uid).order('created_at',{ascending:false}),
  ]);
  sessions = s.data||[];
  scores = sc.data||[];
  projects = p.data||[];
  portSessions = ps.data||[];
  goals = g.data||[];
  homework = hw.data||[];
  notifications = n.data||[];

  if(isAdmin){
    const { data: studs } = await sb.from('profiles').select('*').eq('role','student');
    students = studs||[];
    const ids = homework.map(h=>h.id);
    if(ids.length){
      const { data: atts } = await sb.from('homework_attachments').select('*').in('homework_id', ids);
      hwAttachments = {};
      (atts||[]).forEach(a => { (hwAttachments[a.homework_id]=hwAttachments[a.homework_id]||[]).push(a); });
    }
    const opts = students.map(s=>`<option value="${s.id}">${escape(s.display_name||s.email)}</option>`).join('') || '<option value="">No students</option>';
    document.getElementById('hwStudent').innerHTML = opts;
    document.getElementById('progressStudent').innerHTML = opts;
    document.getElementById('dataStudentSel').innerHTML = opts;
  } else {
    const ids = homework.map(h=>h.id);
    if(ids.length){
      const { data: atts } = await sb.from('homework_attachments').select('*').in('homework_id', ids);
      hwAttachments = {};
      (atts||[]).forEach(a => { (hwAttachments[a.homework_id]=hwAttachments[a.homework_id]||[]).push(a); });
    }
  }
  updateNotifBadge();
}

function subscribeRealtime(){
  if(!sb || realtimeReady) return;
  realtimeReady = true;
  sb.channel('notif-channel')
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'notifications', filter:`user_id=eq.${currentUser.id}` },
      payload => { notifications.unshift(payload.new); updateNotifBadge(); renderAll(); toast(payload.new.title); })
    .subscribe();
  if(isAdmin){
    sb.channel('hw-channel')
      .on('postgres_changes', { event:'*', schema:'public', table:'homework' },
        async () => { await loadAll(); renderAll(); })
      .subscribe();
  } else {
    sb.channel('hw-student-channel')
      .on('postgres_changes', { event:'*', schema:'public', table:'homework', filter:`assigned_to=eq.${currentUser.id}` },
        async () => { await loadAll(); renderAll(); toast('Homework updated'); })
      .subscribe();
  }
}
