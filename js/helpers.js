// Helpers — pure utility functions
function escape(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function weekStart(){ const d=new Date(); d.setDate(d.getDate()-d.getDay()); return d.toISOString().slice(0,10); }
function iconFor(t){ return {pdf:'📄',video:'🎬',doc:'📝',image:'🖼️',link:'🔗',other:'📎'}[t]||'📎'; }

function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2200);
}
function closeModal(id){ document.getElementById(id).classList.remove('show'); }
// Returns true when a mutation should be blocked because the admin is in read-only student preview.
function guardWrite(){
  if(isAdmin && viewAsStudent){ toast('Read-only preview — exit preview to make changes.'); return true; }
  return false;
}

// Normalize a pasted link: add a scheme if missing; null if not URL-like.
function normalizeUrl(raw){
  let u = (raw||'').trim();
  if(!u) return null;
  if(!/^https?:\/\//i.test(u)){
    if(/^[\w.-]+\.[a-z]{2,}(\/[^\s]*)?$/i.test(u)) u = 'https://'+u; else return null;
  }
  try { const x=new URL(u); if(!x.hostname || !x.hostname.includes('.')) return null; return x.href; }
  catch { return null; }
}
// Best-effort human label for a URL attachment.
function deriveLinkName(u){
  try { const x=new URL(u); const seg=x.pathname.split('/').filter(Boolean).pop();
    if(seg) return decodeURIComponent(seg).replace(/\.[a-z0-9]+$/i,'').replace(/[-_]+/g,' ').slice(0,48);
    return x.hostname.replace(/^www\./,'');
  } catch { return u.slice(0,48); }
}
function hoursBetween(s,e){
  if(!s||!e) return 0;
  const [sh,sm]=s.split(':').map(Number);
  const [eh,em]=e.split(':').map(Number);
  let m=(eh*60+em)-(sh*60+sm);
  if(m<0) m+=24*60;
  return Math.round(m/60*100)/100;
}
