// Auth — Supabase auth flow + profile setup

async function init(){
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  sb.auth.onAuthStateChange(async (event, session) => {
    if(session){ await onLogin(session.user); }
    else { showAuth(); }
  });
  const { data } = await sb.auth.getSession();
  if(data.session){ await onLogin(data.session.user); }
  else { showAuth(); }
}

function showAuth(){ document.getElementById('authScreen').classList.remove('hidden'); document.getElementById('app').classList.add('hidden'); }
function showApp(){ document.getElementById('authScreen').classList.add('hidden'); document.getElementById('app').classList.remove('hidden'); }

let authMode = 'signin';
function toggleAuthMode(){
  authMode = authMode==='signin'?'signup':'signin';
  document.getElementById('authTitle').textContent = authMode==='signin'?'Sign in':'Sign up';
  document.getElementById('authSub').textContent = authMode==='signin'?'Access your SAT planner.':'Create your account.';
  document.getElementById('authBtn').textContent = authMode==='signin'?'Sign in':'Sign up';
  document.getElementById('authToggle').textContent = authMode==='signin'?'Need an account? Sign up':'Already have an account? Sign in';
  document.getElementById('authNameField').classList.toggle('hidden', authMode!=='signup');
}

async function doAuth(){
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPass').value;
  const name = document.getElementById('authName').value.trim();
  const err = document.getElementById('authErr');
  err.textContent = '';
  try {
    if(authMode==='signup'){
      const { error } = await sb.auth.signUp({ email, password: pass, options: { data: { display_name: name||email.split('@')[0] } } });
      if(error) throw error;
      toast('Account created. Sign in to continue.');
      authMode='signin'; toggleAuthMode();
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if(error) throw error;
    }
  } catch(e){ err.textContent = e.message; }
}

async function doLogout(){ await sb.auth.signOut(); location.reload(); }

async function onLogin(user){
  currentUser = user;
  const { data: prof } = await sb.from('profiles').select('*').eq('id', user.id).single();
  currentProfile = prof;
  isAdmin = prof?.role === 'admin';

  document.getElementById('userName').textContent = prof?.display_name || user.email;
  document.getElementById('userAvatar').textContent = (prof?.display_name||user.email).slice(0,2).toUpperCase();
  const rb = document.getElementById('userRole');
  rb.textContent = prof?.role||'student';
  rb.className = 'role-badge '+(prof?.role||'student');

  if(isAdmin){
    document.getElementById('adminTab').classList.remove('hidden');
    const b=document.getElementById('assignHwBtn'); if(b) b.style.display='';
  }

  showApp();
  await loadAll();
  renderAll();
  subscribeRealtime();
}
