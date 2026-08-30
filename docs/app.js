const app = document.getElementById('app');
const toastEl = document.getElementById('toast');
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxCaption = document.getElementById('lightboxCaption');
const EVALUATORS = ['Luciana','Idejan','Laércio','Cláudia','Beto','Thierry'];
const PHASE_FILES = ['human_phase1','human_phase2','human_phase3','horse_phase1','horse_phase2','horse_phase3'];
const CONFIG = window.HR_REVIEW_CONFIG || {};
const API_URL = String(CONFIG.APPS_SCRIPT_URL || '').trim();
const state = { bank:null, name:'', reviews:{}, progress:{last_uid:null}, current:null };
window.HR_MEDIA = {};

const esc = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const pct = (n,d) => d ? Math.round(n*100/d) : 0;
const letter = i => String.fromCharCode(65+i);
const configured = () => /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(API_URL);

function toast(msg, error=false){ toastEl.textContent=msg; toastEl.className='toast show'+(error?' error':''); clearTimeout(toastEl._t); toastEl._t=setTimeout(()=>toastEl.className='toast',2800); }
function mimeFor(path){ const e=path.split('.').pop().toLowerCase(); return e==='webp'?'image/webp':e==='gif'?'image/gif':e==='jpg'||e==='jpeg'?'image/jpeg':'image/png'; }
function imageSrc(name){ return window.HR_MEDIA[name] || ''; }

async function loadMedia(){
  const [manifestRes, zipRes] = await Promise.all([
    fetch('media_manifest.json',{cache:'no-store'}),
    fetch('media_review.zip',{cache:'force-cache'})
  ]);
  if(!manifestRes.ok) throw new Error('Could not load media manifest.');
  if(!zipRes.ok) throw new Error('Could not load media_review.zip. Upload it to the docs folder.');
  const manifest = await manifestRes.json();
  const bytes = new Uint8Array(await zipRes.arrayBuffer());
  if(!window.fflate) throw new Error('Media decompressor did not load.');
  const files = window.fflate.unzipSync(bytes);
  Object.entries(manifest).forEach(([logical,path])=>{
    const data = files[path];
    if(data) window.HR_MEDIA[logical] = URL.createObjectURL(new Blob([data],{type:mimeFor(path)}));
  });
}

async function loadBank(){
  const parts = await Promise.all(PHASE_FILES.map(async id=>{
    const r=await fetch(`data/${id}.json`,{cache:'no-store'}); if(!r.ok) throw new Error(`Could not load ${id}.json`); return r.json();
  }));
  const sections=[]; const questions=[];
  for(const sectionId of ['human','horse']){
    const secParts=parts.filter(p=>p.section===sectionId);
    sections.push({id:sectionId,count:secParts[0].section_count,phases:secParts.map(p=>p.phase)});
    secParts.forEach(p=>questions.push(...p.questions));
  }
  return {total_questions:questions.length,sections,questions};
}

function jsonp(params){
  if(!configured()) return Promise.reject(new Error('Google Sheets backend is not configured in config.js.'));
  return new Promise((resolve,reject)=>{
    const cb='__hr_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const s=document.createElement('script');
    const timer=setTimeout(()=>done(new Error('Google Sheets did not respond in time.')),15000);
    function done(err,val){ clearTimeout(timer); s.remove(); try{delete window[cb]}catch{} err?reject(err):resolve(val); }
    window[cb]=payload=>payload&&payload.ok!==false?done(null,payload):done(new Error(payload?.error||'Google Sheets request failed.'));
    s.onerror=()=>done(new Error('Could not reach the Google Sheets backend.'));
    s.src=API_URL+'?'+new URLSearchParams({...params,callback:cb}); document.head.appendChild(s);
  });
}
async function sheetWrite(payload){
  if(!configured()) throw new Error('Google Sheets backend is not configured in config.js.');
  await fetch(API_URL,{method:'POST',mode:'no-cors',body:new URLSearchParams({payload:JSON.stringify(payload)})});
}
async function getState(name){ return jsonp({action:'state',name}); }
async function verifyReview(uid,decision){
  for(let i=0;i<4;i++){ const d=await getState(state.name); const r=d.reviews?.[uid]; if(r?.decision===decision) return {d,r}; await new Promise(x=>setTimeout(x,650)); }
  throw new Error('The response was sent, but could not yet be verified in Google Sheets. Please try again.');
}

function header(){ return `<header class="topbar"><div class="brand"><span class="brandmark">HR</span><div><b>Horse–Rider Image Review</b><small>Image validation workspace</small></div></div><div class="topactions"><span>${esc(state.name)}</span><button class="btn quiet" id="changeEvaluator">Change evaluator</button></div></header>`; }
function wireHeader(){ document.getElementById('changeEvaluator')?.addEventListener('click',()=>{state.name='';state.reviews={};state.current=null;renderLogin();}); }
function count(filter){ return state.bank.questions.filter(q=>filter(q)&&state.reviews[q.uid]).length; }
function summary(){ const v=Object.values(state.reviews); return {done:v.length,agree:v.filter(x=>x.decision==='agree').length,change:v.filter(x=>x.decision==='change').length,remove:v.filter(x=>x.decision==='remove').length}; }

function renderLogin(){
  const remembered=EVALUATORS.includes(localStorage.hrReviewEvaluator)?localStorage.hrReviewEvaluator:'';
  app.innerHTML=`<main class="loginwrap"><section class="logincard"><div class="loginmark">HR</div><h1>Horse–Rider<br>Image Review</h1><p>Review each image in context. Select your name to load your progress and continue where you left off.</p>${configured()?'':'<div class="warning"><b>Setup required:</b> the Google Apps Script URL still needs to be added to <code>config.js</code>.</div>'}<form id="loginForm"><label>Evaluator</label><select id="name" required><option value="" disabled ${remembered?'':'selected'}>Select your name…</option>${EVALUATORS.map(n=>`<option ${n===remembered?'selected':''}>${esc(n)}</option>`).join('')}</select><button class="btn primary" ${configured()?'':'disabled'}>Start review</button></form><small class="muted">No account or password is required. Progress is saved automatically.</small></section></main>`;
  document.getElementById('loginForm').onsubmit=async e=>{e.preventDefault();const name=document.getElementById('name').value;if(!EVALUATORS.includes(name))return; try{const d=await getState(name);state.name=d.evaluator.name;state.reviews=d.reviews||{};state.progress=d.progress||{last_uid:null};localStorage.hrReviewEvaluator=state.name;renderDashboard();}catch(err){toast(err.message,true)}};
}

function renderDashboard(){
  const s=summary();
  app.innerHTML=`${header()}<main class="main"><section class="hero"><div><span class="kicker">Review dashboard</span><h1>Welcome, ${esc(state.name)}</h1><p>Review all 106 question-image sets. Your choices are stored in Google Sheets as you work.</p><div class="track"><i style="width:${pct(s.done,state.bank.total_questions)}%"></i></div><b>${s.done}/${state.bank.total_questions} completed</b></div><div class="summary"><div><b>${s.agree}</b><span>Agree</span></div><div><b>${s.change}</b><span>Change</span></div><div><b>${s.remove}</b><span>Remove</span></div></div></section><section class="sections">${state.bank.sections.map(section=>`<article class="section"><div class="sectionhead"><div><span class="sectionicon">${section.id==='human'?'R':'H'}</span><h2>${section.id==='human'?'Human / Rider':'Horse'}</h2></div><b>${count(q=>q.section===section.id)}/${section.count}</b></div>${section.phases.map(ph=>{const done=count(q=>q.phase_id===ph.id);return `<button class="phase" data-phase="${ph.id}"><div><b>Phase ${ph.number} — ${esc(ph.label)}</b><small>${done}/${ph.count} reviewed</small><div class="minitrack"><i style="width:${pct(done,ph.count)}%"></i></div></div><span>Open →</span></button>`}).join('')}</article>`).join('')}</section></main>`;
  wireHeader(); document.querySelectorAll('.phase').forEach(b=>b.onclick=()=>openPhase(b.dataset.phase));
}
function openPhase(phaseId){ const qs=state.bank.questions.filter(q=>q.phase_id===phaseId); const last=state.progress.last_uid; const target=(qs.find(q=>q.uid===last&&!state.reviews[q.uid])||qs.find(q=>!state.reviews[q.uid])||qs[0]); renderQuestion(target.uid); }
function qByUid(uid){ return state.bank.questions.find(q=>q.uid===uid); }
function questionVisuals(q){
  let h=''; const cover=q.cover||q.image;
  if(cover&&imageSrc(cover)) h+=`<div class="cover"><img class="zoom" src="${imageSrc(cover)}" data-cap="${esc(cover)}"><small>${esc(cover)}</small></div>`;
  if(q.type==='bipolar_scale_group'&&q.scales?.length) h+=`<div class="scales">${q.scales.map(s=>`<div><b>${esc(s.left)}</b><span>${Array.from({length:q.steps||5},()=>'<i></i>').join('')}</span><b>${esc(s.right)}</b></div>`).join('')}</div>`;
  if(q.options?.length) h+=`<div class="options">${q.options.map((o,i)=>`<div class="option"><div><span>${letter(i)}</span>${esc(o.label)}</div>${o.image&&imageSrc(o.image)?`<figure><img class="zoom" src="${imageSrc(o.image)}" data-cap="${esc(o.image)}"><figcaption>${esc(o.image)}</figcaption></figure>`:''}</div>`).join('')}</div>`;
  if(!q.image_refs?.length) h+=`<div class="warning"><b>No image linked in the JSON.</b><br>The question is still shown so the reviewer can decide whether an image should be added or whether no image is needed.</div>`;
  return h;
}
function renderQuestion(uid){
  const q=qByUid(uid); if(!q)return renderDashboard(); state.current=uid; const idx=state.bank.questions.findIndex(x=>x.uid===uid); const phaseQs=state.bank.questions.filter(x=>x.phase_id===q.phase_id); const pidx=phaseQs.findIndex(x=>x.uid===uid); const done=count(x=>x.phase_id===q.phase_id); const r=state.reviews[uid];
  app.innerHTML=`${header()}<main class="main"><div class="qprogress"><span>${esc(q.section_label)} · Phase ${q.phase_number} — ${esc(q.phase_label)}</span><b>${done}/${phaseQs.length} reviewed</b><div class="track"><i style="width:${pct(done,phaseQs.length)}%"></i></div></div><div class="qlayout"><article class="context"><button class="btn quiet" id="dashboard">← Dashboard</button><div class="qcode"><span>${esc(q.display_number)}</span><b>${esc(q.question_id)}</b></div><h1>${esc(q.text)}</h1>${questionVisuals(q)}</article><aside class="review"><h2>Image review</h2><p>${q.image_refs.length} linked image(s). The decision applies to the image set shown for this question.</p><button class="decision agree ${r?.decision==='agree'?'active':''}" data-d="agree">✓ Agree <small>Keep image</small></button><button class="decision change ${r?.decision==='change'?'active':''}" data-d="change">✎ Change / replace <small>Add details</small></button><button class="decision remove ${r?.decision==='remove'?'active':''}" data-d="remove">× Remove <small>Remove image</small></button><div id="changeBox" class="changebox" ${r?.decision==='change'?'':'hidden'}><label>Describe what should be changed</label><textarea id="feedback" maxlength="5000">${esc(r?.feedback||'')}</textarea><button class="btn primary" id="saveChange">Save change</button></div><div id="saved" class="saved">${r?'Saved automatically · '+r.decision.toUpperCase():'No decision saved yet'}</div><hr><div class="nav"><button class="btn" id="prev" ${idx===0?'disabled':''}>← Previous</button><button class="btn primary" id="next" ${idx===state.bank.questions.length-1?'disabled':''}>Next →</button></div><small>Question ${idx+1}/${state.bank.total_questions} · Phase item ${pidx+1}/${phaseQs.length}</small></aside></div></main>`;
  wireHeader(); wireZoom(); document.getElementById('dashboard').onclick=renderDashboard; document.getElementById('prev').onclick=()=>idx>0&&navigate(state.bank.questions[idx-1].uid); document.getElementById('next').onclick=()=>idx<state.bank.questions.length-1&&navigate(state.bank.questions[idx+1].uid); document.querySelectorAll('.decision').forEach(b=>b.onclick=()=>choose(b.dataset.d)); document.getElementById('saveChange')?.addEventListener('click',saveChange); saveProgress(uid);
}
async function navigate(uid){ await saveProgress(uid); renderQuestion(uid); window.scrollTo({top:0,behavior:'smooth'}); }
async function choose(d){ if(d==='change'){document.getElementById('changeBox').hidden=false;document.getElementById('feedback').focus();return;} await persist(d,''); }
async function saveChange(){const f=document.getElementById('feedback').value.trim();if(!f)return toast('Please describe the requested change before saving.',true);await persist('change',f);}
async function persist(decision,feedback){ const q=qByUid(state.current), saved=document.getElementById('saved'); saved.textContent='Saving…'; document.querySelectorAll('.decision').forEach(b=>b.disabled=true); try{await sheetWrite({action:'review',name:state.name,uid:q.uid,decision,feedback,section:q.section,phase_id:q.phase_id,phase_number:q.phase_number,display_number:q.display_number,question_id:q.question_id,image_files:(q.image_refs||[]).join('; ')}); const {d,r}=await verifyReview(q.uid,decision); state.reviews=d.reviews||state.reviews;state.progress=d.progress||state.progress;saved.textContent='Saved automatically · '+decision.toUpperCase();toast('Saved');document.querySelectorAll('.decision').forEach(b=>b.classList.toggle('active',b.dataset.d===decision)); if(decision!=='change')document.getElementById('changeBox').hidden=true;}catch(err){saved.textContent=err.message;toast(err.message,true)}finally{document.querySelectorAll('.decision').forEach(b=>b.disabled=false)} }
async function saveProgress(uid){ if(!state.name)return; state.progress.last_uid=uid; try{await sheetWrite({action:'progress',name:state.name,last_uid:uid})}catch(e){console.warn(e)} }
function wireZoom(){document.querySelectorAll('.zoom').forEach(img=>img.onclick=()=>{lightboxImage.src=img.src;lightboxCaption.textContent=img.dataset.cap||'';lightbox.hidden=false;document.body.style.overflow='hidden'});}
function closeLightbox(){lightbox.hidden=true;lightboxImage.src='';document.body.style.overflow='';}
document.getElementById('lightboxClose').onclick=closeLightbox;lightbox.onclick=e=>{if(e.target===lightbox)closeLightbox()};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!lightbox.hidden)closeLightbox()});

async function boot(){
  app.innerHTML='<main class="loading"><div class="spinner"></div><h2>Loading review workspace…</h2><p>Preparing the question bank and image set.</p></main>';
  try{ [state.bank] = await Promise.all([loadBank(),loadMedia()]); renderLogin(); }
  catch(err){ app.innerHTML=`<main class="errorcard"><h2>Could not start the application</h2><p>${esc(err.message)}</p></main>`; }
}
boot();
