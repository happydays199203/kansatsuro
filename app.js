const CONFIG = window.KANSATSURO_CONFIG || {};
const SUPABASE_READY = Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && window.supabase);
const db = SUPABASE_READY ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY) : null;

const imageAssets = {
  seedling: './assets/seedling.svg', dandelion: './assets/dandelion.svg', soil: './assets/soil.svg',
  watering: './assets/watering.svg', insect: './assets/insect.svg', leaf: './assets/leaf.svg'
};

const sampleObservations = [
  { id:'sample-1', title:'苗の様子', category:'苗', status:'needs_check', image_url:imageAssets.seedling, observed_at:'2026-05-30T08:35:00+09:00', location:'第一畑', weather:'晴れ', temperature:18, memo:'苗の葉が少し下を向いている。', hypothesis:'水不足か、植え付けのストレスかもしれない。', question:'この状態は様子見でいいですか？', tags:['苗','トマト','水やり'], owner_name:'観察太郎' },
  { id:'sample-2', title:'ヨモギ', category:'植物・草', status:'ok', image_url:imageAssets.dandelion, observed_at:'2026-05-30T08:12:00+09:00', location:'畑の端', weather:'晴れ', temperature:18, memo:'乾いた場所に多く生えている。', hypothesis:'乾きやすい場所でも残りやすい草かもしれない。', question:'ヨモギが多い場所は土の状態と関係ありますか？', tags:['ヨモギ','乾燥気味'], owner_name:'観察太郎' },
  { id:'sample-3', title:'土の状態', category:'土', status:'ok', image_url:imageAssets.soil, observed_at:'2026-05-30T07:45:00+09:00', location:'倉庫横', weather:'晴れ', temperature:18, memo:'表面が少し乾いていて、団粒が小さい。', hypothesis:'水が入りにくい場所かもしれない。', question:'', tags:['土壌','乾燥'], owner_name:'観察太郎' },
  { id:'sample-4', title:'水やり後の様子', category:'作業', status:'ok', image_url:imageAssets.watering, observed_at:'2026-05-29T17:20:00+09:00', location:'第一畑', weather:'晴れ', temperature:17, memo:'水やり後、葉のハリが少し戻った。', hypothesis:'水分状態が葉の向きに関係している可能性がある。', question:'水やり量の判断基準はどこを見るといいですか？', tags:['水やり','トマト'], owner_name:'観察太郎' },
  { id:'sample-5', title:'虫の観察', category:'虫', status:'ok', image_url:imageAssets.insect, observed_at:'2026-05-29T10:05:00+09:00', location:'倉庫横', weather:'晴れ', temperature:17, memo:'葉の裏に小さな虫を確認。', hypothesis:'同じ株で増えていないか経過を見る。', question:'', tags:['虫','葉の裏'], owner_name:'観察太郎' }
];

let observations = [], workspaces = [], currentWorkspace = null, currentUser = null, currentProfile = null;
let sortDesc = true, selectedPhotoFile = null, selectedPhotoDataUrl = '', authMode = 'signin';
let pendingJoinCode = new URLSearchParams(location.search).get('join') || '';

const $ = id => document.getElementById(id);
const els = {
  authGate:$('authGate'), appShell:$('appShell'), authForm:$('authForm'), authDisplayName:$('authDisplayName'), authEmail:$('authEmail'),
  authPassword:$('authPassword'), authSubmit:$('authSubmit'), authMessage:$('authMessage'), displayNameLabel:$('displayNameLabel'),
  signOutBtn:$('signOutBtn'), pageTitle:$('pageTitle'), pageSubTitle:$('pageSubTitle'), currentWeather:$('currentWeather'),
  temperatureCard:$('temperatureCard'), needCheckCount:$('needCheckCount'), hero:$('heroObservation'), list:$('observationList'),
  dashboardQuickList:$('dashboardQuickList'), libraryGrid:$('libraryGrid'), questionList:$('questionList'), summaryTotal:$('summaryTotal'),
  summaryPlants:$('summaryPlants'), summaryTasks:$('summaryTasks'), summaryQuestions:$('summaryQuestions'), summaryNotes:$('summaryNotes'),
  searchInput:$('searchInput'), categoryFilter:$('categoryFilter'), locationFilter:$('locationFilter'), dialog:$('observationDialog'),
  settingsDialog:$('settingsDialog'), form:$('observationForm'), photoInput:$('photoInput'), photoPreview:$('photoPreview'),
  userDisplayName:$('userDisplayName'), nameSetting:$('nameSetting'), workspaceChip:$('workspaceChip'), workspaceSelect:$('workspaceSelect'),
  inviteCodeText:$('inviteCodeText'), inviteUrlInput:$('inviteUrlInput'), copyInviteBtn:$('copyInviteBtn'), copyShareUrlBtn:$('copyShareUrlBtn'),
  joinCodeInput:$('joinCodeInput'), joinWorkspaceBtn:$('joinWorkspaceBtn'), newWorkspaceName:$('newWorkspaceName'), createWorkspaceBtn:$('createWorkspaceBtn'), supabaseModeHint:$('supabaseModeHint')
};
const timeFormatter = new Intl.DateTimeFormat('ja-JP',{hour:'2-digit',minute:'2-digit',hour12:false});
const html = v => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
function tags(v){ if(!v) return []; return Array.isArray(v) ? v.filter(Boolean).map(x=>String(x).trim()).filter(Boolean) : String(v).split(',').map(x=>x.trim()).filter(Boolean); }
function dateParts(value){ const d=new Date(value); return {day:`${d.getMonth()+1}/${d.getDate()}`, weekday:`(${['日','月','火','水','木','金','土'][d.getDay()]})`, time:timeFormatter.format(d), full:`${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${['日','月','火','水','木','金','土'][d.getDay()]} ${timeFormatter.format(d)}`}; }
function tagClass(c){ return c==='土'?'cat-soil':c==='水やり'?'blue':c==='異常'?'warn':''; }
function getUserName(){ return currentProfile?.display_name || currentUser?.user_metadata?.display_name || localStorage.getItem('kansatsuro_user_name') || '観察太郎'; }
function setUserName(name){ localStorage.setItem('kansatsuro_user_name', name || '観察太郎'); els.userDisplayName.textContent = getUserName(); }
function localData(){ try{ const d=JSON.parse(localStorage.getItem('kansatsuro_observations')||'null'); return Array.isArray(d)&&d.length?d:sampleObservations; }catch{ return sampleObservations; } }
function saveLocal(){ localStorage.setItem('kansatsuro_observations', JSON.stringify(observations)); }
function showAuth(){ els.authGate.hidden=false; els.appShell.hidden=true; document.querySelector('.mobile-tabs').style.display='none'; }
function showApp(){ els.authGate.hidden=true; els.appShell.hidden=false; document.querySelector('.mobile-tabs').style.display=''; }

function setAuthMode(mode){
  authMode=mode;
  document.querySelectorAll('[data-auth-mode]').forEach(b=>b.classList.toggle('active', b.dataset.authMode===mode));
  els.displayNameLabel.style.display = mode==='signup' ? 'grid' : 'none';
  els.authSubmit.textContent = mode==='signup' ? 'アカウントを作成' : 'ログイン';
  els.authPassword.autocomplete = mode==='signup' ? 'new-password' : 'current-password';
  els.authMessage.textContent = pendingJoinCode ? `共有コード「${pendingJoinCode}」への参加はログイン後に自動で処理します。` : '';
}
async function handleAuth(e){
  e.preventDefault(); if(!SUPABASE_READY) return;
  const email=els.authEmail.value.trim(), password=els.authPassword.value, displayName=els.authDisplayName.value.trim() || email.split('@')[0] || '観察者';
  els.authMessage.textContent='処理中です...';
  if(authMode==='signup'){
    const {data,error}=await db.auth.signUp({email,password,options:{data:{display_name:displayName}}});
    if(error){ els.authMessage.textContent=`作成に失敗しました：${error.message}`; return; }
    if(!data.session){ els.authMessage.textContent='確認メールを送信しました。メール確認後にログインしてください。'; setAuthMode('signin'); return; }
    return;
  }
  const {error}=await db.auth.signInWithPassword({email,password});
  if(error) els.authMessage.textContent=`ログインに失敗しました：${error.message}`;
}
async function signOut(){ if(SUPABASE_READY) await db.auth.signOut(); currentUser=null; currentProfile=null; currentWorkspace=null; observations=[]; showAuth(); }
async function ensureProfile(){
  if(!SUPABASE_READY||!currentUser) return;
  const name=currentUser.user_metadata?.display_name || localStorage.getItem('kansatsuro_user_name') || currentUser.email?.split('@')[0] || '観察者';
  const {data,error}=await db.from('profiles').upsert({id:currentUser.id, display_name:name, email:currentUser.email},{onConflict:'id'}).select().single();
  if(!error) currentProfile=data;
  setUserName(getUserName());
}
async function updateProfileName(name){
  setUserName(name);
  if(!SUPABASE_READY||!currentUser) return;
  const {data,error}=await db.from('profiles').update({display_name:name||'観察者'}).eq('id',currentUser.id).select().single();
  if(error){ alert('表示名の保存に失敗しました。'); console.warn(error); return; }
  currentProfile=data; setUserName(name);
}
async function fetchWorkspaces(){
  if(!SUPABASE_READY){ currentWorkspace={id:'local',name:'ローカル観察',invite_code:'local'}; return; }
  const {data,error}=await db.from('workspaces').select('id,name,invite_code,created_by,created_at').order('created_at',{ascending:true});
  if(error){ console.warn(error); workspaces=[]; return; }
  workspaces=data||[];
}
async function createWorkspace(name){
  if(!SUPABASE_READY) return null;
  const {data,error}=await db.rpc('create_workspace',{p_name:(name||CONFIG.DEFAULT_WORKSPACE_NAME||'観察チーム').trim()});
  if(error){ alert('チーム作成に失敗しました。supabase-schema.sqlを実行してください。'); console.warn(error); return null; }
  await fetchWorkspaces(); currentWorkspace=Array.isArray(data)?data[0]:data; localStorage.setItem('kansatsuro_workspace_id', currentWorkspace.id); renderWorkspace(); return currentWorkspace;
}
async function joinWorkspace(code){
  if(!SUPABASE_READY) return null;
  code=(code||'').trim(); if(!code) return null;
  const {data,error}=await db.rpc('join_workspace',{p_invite_code:code});
  if(error){ alert('共有チームに参加できませんでした。共有コードを確認してください。'); console.warn(error); return null; }
  await fetchWorkspaces(); currentWorkspace=Array.isArray(data)?data[0]:data; localStorage.setItem('kansatsuro_workspace_id', currentWorkspace.id);
  pendingJoinCode=''; const u=new URL(location.href); u.searchParams.delete('join'); history.replaceState({},'',u.toString()); renderWorkspace(); await loadObservations(); return currentWorkspace;
}
async function setupWorkspace(){
  if(!SUPABASE_READY){ currentWorkspace={id:'local',name:'ローカル観察',invite_code:'local'}; renderWorkspace(); return; }
  await fetchWorkspaces(); if(pendingJoinCode) await joinWorkspace(pendingJoinCode);
  if(!workspaces.length) await createWorkspace(CONFIG.DEFAULT_WORKSPACE_NAME||'観察チーム');
  else { const saved=localStorage.getItem('kansatsuro_workspace_id'); currentWorkspace=workspaces.find(w=>w.id===saved)||workspaces[0]; localStorage.setItem('kansatsuro_workspace_id',currentWorkspace.id); }
  renderWorkspace();
}
function shareUrl(w=currentWorkspace){ if(!w?.invite_code) return ''; const base=CONFIG.SHARE_BASE_URL || location.origin+location.pathname; const u=new URL(base, location.href); u.searchParams.set('join',w.invite_code); return u.toString(); }
function renderWorkspace(){
  els.workspaceChip.textContent=currentWorkspace?.name||'観察チーム';
  els.workspaceSelect.innerHTML=workspaces.map(w=>`<option value="${html(w.id)}">${html(w.name)}</option>`).join('');
  if(currentWorkspace?.id) els.workspaceSelect.value=currentWorkspace.id;
  els.inviteCodeText.textContent=currentWorkspace?.invite_code||'未設定'; els.inviteUrlInput.value=shareUrl();
  els.supabaseModeHint.textContent=SUPABASE_READY?'この共有コードを渡すと、相手は自分のアカウントで同じ観察チームに参加できます。':'現在はローカル保存です。Supabase設定後にアカウント作成と共有が使えます。';
}
async function loadObservations(){
  if(!SUPABASE_READY){ observations=localData(); render(); return; }
  if(!currentWorkspace?.id){ observations=[]; render(); return; }
  const {data,error}=await db.from('observations').select('*').eq('workspace_id',currentWorkspace.id).order('observed_at',{ascending:false});
  observations=error?[]:(data||[]).map(o=>({...o,tags:tags(o.tags)})); if(error) console.warn(error); render();
}
function filtered(){
  const q=els.searchInput.value.trim().toLowerCase(), cat=els.categoryFilter.value, loc=els.locationFilter.value;
  let d=[...observations];
  if(q) d=d.filter(o=>[o.title,o.category,o.location,o.memo,o.hypothesis,o.question,o.owner_name,...tags(o.tags)].join(' ').toLowerCase().includes(q));
  if(cat!=='all') d=d.filter(o=>o.category===cat); if(loc!=='all') d=d.filter(o=>o.location===loc);
  d.sort((a,b)=>sortDesc?new Date(b.observed_at)-new Date(a.observed_at):new Date(a.observed_at)-new Date(b.observed_at)); return d;
}
function renderStatus(){ const needs=observations.filter(o=>o.status==='needs_check').length, latest=filtered()[0]||observations[0]; const w=latest?`${latest.weather||'晴れ'} ${latest.temperature||18}℃`:'晴れ 18℃'; els.needCheckCount.textContent=needs; els.temperatureCard.textContent=w; els.currentWeather.textContent=w; }
function renderHero(data){
  const item=data[0];
  if(!item){ els.hero.innerHTML='<div class="empty-hero"><h3>まだ観察記録がありません</h3><p>「新しい観察を記録」から最初の写真とメモを追加してください。</p></div>'; return; }
  const d=dateParts(item.observed_at), alert=item.status==='needs_check'?`<div class="alert-box"><span>ⓘ</span><span>${html(item.memo||'状態を確認してください')} / 要確認</span></div>`:`<div class="alert-box ok"><span>✓</span><span>今のところ順調</span></div>`;
  const t=tags(item.tags).slice(0,4).map((x,i)=>`<span class="tag ${i===2?'blue':''}">${html(x)}</span>`).join('');
  els.hero.innerHTML=`<div class="hero-photo"><img src="${html(item.image_url||imageAssets.leaf)}" alt="${html(item.title)}"><span class="badge-current">今の状態</span></div><div class="hero-content"><div class="hero-title-row"><h3>${html(item.title)}</h3><button class="more-btn">…</button></div>${alert}<div class="hero-meta"><span>📅 ${html(d.full)}</span><span>📍 ${html(item.location||'未設定')}</span><span>👤 ${html(item.owner_name||'観察者')}</span></div><div class="hero-tags">${t}</div></div>`;
}
function renderRows(data){ els.list.innerHTML=''; data.slice(1).forEach(item=>{ const d=dateParts(item.observed_at); const t=tags(item.tags).slice(0,2).map(x=>`<span class="tag ${tagClass(item.category)}">${html(x)}</span>`).join(''); const row=document.createElement('article'); row.className='observation-row'; row.innerHTML=`<img class="thumb" src="${html(item.image_url||imageAssets.leaf)}" alt="${html(item.title)}"><div class="row-date"><strong>${html(d.day)}</strong><span>${html(d.weekday)}</span><small>${html(d.time)}</small></div><div class="row-main"><h4>${html(item.title)} <span class="tag ${tagClass(item.category)}">${html(item.category)}</span></h4><div class="row-meta"><span>📅 ${html(d.day)} ${html(d.weekday)} ${html(d.time)}</span><span>📍 ${html(item.location||'未設定')}</span><span>👤 ${html(item.owner_name||'観察者')}</span></div><p>${html(item.memo||'')}</p></div><div class="row-tags">${t}</div><button class="row-arrow">›</button>`; row.onclick=()=>showDetail(item); els.list.appendChild(row); }); }
function showDetail(item){ alert([`【${item.title}】`,`記録者：${item.owner_name||'観察者'}`,`カテゴリ：${item.category}`,`場所：${item.location||'未設定'}`,`観察：${item.memo||''}`,item.hypothesis?`仮説：${item.hypothesis}`:'',item.question?`師匠に聞く：${item.question}`:'',tags(item.tags).length?`タグ：${tags(item.tags).join(', ')}`:''].filter(Boolean).join('\n')); }
function renderDashboard(){ const a=observations.filter(o=>o.status==='needs_check'||o.question).slice(0,6); els.dashboardQuickList.innerHTML=a.map(o=>`<div class="compact-item"><strong>${html(o.title)}</strong><br><span>${html(o.question||o.memo||'')}</span></div>`).join('')||'<p>要確認の記録はありません。</p>'; }
function renderLibrary(){ const g=observations.reduce((a,o)=>(a[o.title]||(a[o.title]={title:o.title,image_url:o.image_url,count:0,category:o.category}),a[o.title].count++,a),{}); els.libraryGrid.innerHTML=Object.values(g).map(o=>`<article class="library-card"><img src="${html(o.image_url||imageAssets.leaf)}" alt="${html(o.title)}"><h4>${html(o.title)}</h4><p>${html(o.category)}・観察記録 ${o.count}件</p></article>`).join('')||'<p>図鑑に表示する観察はまだありません。</p>'; }
function renderQuestions(){ const qs=observations.filter(o=>o.question).sort((a,b)=>new Date(b.observed_at)-new Date(a.observed_at)); els.questionList.innerHTML=qs.map(o=>`<label class="question-item"><input type="checkbox"><span><strong>${html(o.question)}</strong><br><small>${html(o.title)} / ${html(o.location||'未設定')} / ${html(o.owner_name||'観察者')}</small></span></label>`).join('')||'<p>質問はまだありません。</p>'; }
function renderSummary(){ const plants=observations.filter(o=>['苗','植物・草'].includes(o.category)).length, tasks=observations.filter(o=>['作業','水やり'].includes(o.category)).length, qs=observations.filter(o=>o.question).length; els.summaryTotal.textContent=observations.length; els.summaryPlants.textContent=plants; els.summaryTasks.textContent=tasks; els.summaryQuestions.textContent=qs; els.summaryNotes.innerHTML=observations.slice(0,4).map(o=>`<li>${html(o.memo||o.title)}</li>`).join('')||'<li>まだ記録がありません。</li>'; }
function render(){ const d=filtered(); renderStatus(); renderHero(d); renderRows(d); renderDashboard(); renderLibrary(); renderQuestions(); renderSummary(); }
function switchView(view){ document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); $(`view-${view}`)?.classList.add('active'); document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view)); const names={dashboard:['ダッシュボード','今日の確認を一箇所にまとめる'],list:['観察一覧','今の状態を見て、必要な確認だけ拾う'],library:['図鑑','同じ植物・虫・土の記録を束ねて見る'],questions:['質問リスト','師匠に聞くことを逃さない'],summary:['まとめ・振り返り','観察を学びに変える']}; els.pageTitle.textContent=names[view]?.[0]||'観察一覧'; els.pageSubTitle.textContent=names[view]?.[1]||''; }
function resetForm(){ els.form.reset(); selectedPhotoFile=null; selectedPhotoDataUrl=''; els.photoPreview.classList.remove('has-image'); els.photoPreview.style.backgroundImage=''; const n=new Date(); n.setMinutes(n.getMinutes()-n.getTimezoneOffset()); $('dateInput').value=n.toISOString().slice(0,16); $('weatherInput').value='晴れ'; $('tempInput').value='18'; }
async function uploadPhoto(file){ if(!file) return imageAssets.leaf; if(!SUPABASE_READY) return selectedPhotoDataUrl||imageAssets.leaf; const ext=file.name.split('.').pop()||'jpg', path=`${currentWorkspace?.id||'no-workspace'}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`; const {error}=await db.storage.from(CONFIG.STORAGE_BUCKET||'observation-photos').upload(path,file,{cacheControl:'3600'}); if(error){ console.warn(error); return selectedPhotoDataUrl||imageAssets.leaf; } return db.storage.from(CONFIG.STORAGE_BUCKET||'observation-photos').getPublicUrl(path).data.publicUrl; }
async function handleSubmit(e){ e.preventDefault(); const image_url=await uploadPhoto(selectedPhotoFile); const item={title:$('titleInput').value.trim(),category:$('catInput').value,status:$('statusInput').checked?'needs_check':'ok',image_url,observed_at:new Date($('dateInput').value).toISOString(),location:$('placeInput').value.trim(),weather:$('weatherInput').value.trim()||'晴れ',temperature:Number($('tempInput').value||18),memo:$('memoInput').value.trim(),hypothesis:$('hypothesisInput').value.trim(),question:$('questionInput').value.trim(),tags:tags($('tagsInput').value),owner_name:getUserName()}; if(SUPABASE_READY){ const {error}=await db.from('observations').insert({...item,workspace_id:currentWorkspace.id,user_id:currentUser.id}); if(error){ alert('保存に失敗しました。'); console.warn(error); return; } await loadObservations(); } else { observations.unshift({...item,id:`local-${Date.now()}`}); saveLocal(); render(); } els.dialog.close(); }
function copyText(text,msg){ if(!text) return; navigator.clipboard?.writeText(text).then(()=>alert(msg)).catch(()=>prompt('コピーしてください', text)); }
function initEvents(){
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
  document.querySelectorAll('[data-auth-mode]').forEach(b=>b.onclick=()=>setAuthMode(b.dataset.authMode)); els.authForm?.addEventListener('submit',handleAuth); els.signOutBtn?.addEventListener('click',signOut);
  $('newObservationBtn').onclick=()=>{resetForm(); els.dialog.showModal();}; $('mobileNewBtn').onclick=()=>{resetForm(); els.dialog.showModal();}; $('cancelObservation').onclick=()=>els.dialog.close();
  $('sortBtn').onclick=e=>{sortDesc=!sortDesc; e.currentTarget.textContent=sortDesc?'新しい順 ↓':'古い順 ↑'; render();}; [els.searchInput,els.categoryFilter,els.locationFilter].forEach(x=>x.addEventListener('input',render)); els.form.addEventListener('submit',handleSubmit);
  els.photoInput.onchange=e=>{ const f=e.target.files?.[0]; selectedPhotoFile=f||null; if(!f) return; const r=new FileReader(); r.onload=()=>{selectedPhotoDataUrl=r.result; els.photoPreview.classList.add('has-image'); els.photoPreview.style.backgroundImage=`url(${selectedPhotoDataUrl})`;}; r.readAsDataURL(f); };
  $('openSettings').onclick=()=>{els.nameSetting.value=getUserName(); renderWorkspace(); els.settingsDialog.showModal();}; els.workspaceChip.onclick=()=>$('openSettings').click(); $('closeSettings').onclick=()=>els.settingsDialog.close(); $('saveSettings').onclick=async()=>{await updateProfileName(els.nameSetting.value.trim()); alert('表示名を保存しました。');};
  els.workspaceSelect.onchange=async e=>{currentWorkspace=workspaces.find(w=>w.id===e.target.value)||currentWorkspace; localStorage.setItem('kansatsuro_workspace_id',currentWorkspace.id); renderWorkspace(); await loadObservations();};
  els.copyInviteBtn.onclick=()=>copyText(currentWorkspace?.invite_code||'','共有コードをコピーしました。'); els.copyShareUrlBtn.onclick=()=>copyText(shareUrl(),'参加URLをコピーしました。'); els.joinWorkspaceBtn.onclick=async()=>{const w=await joinWorkspace(els.joinCodeInput.value); if(w) alert('共有チームに参加しました。');}; els.createWorkspaceBtn.onclick=async()=>{const w=await createWorkspace(els.newWorkspaceName.value); if(w){els.newWorkspaceName.value=''; alert('新しい共有チームを作成しました。'); await loadObservations();}};
}
async function subscribeRealtime(){ if(!SUPABASE_READY) return; db.channel('observations-realtime').on('postgres_changes',{event:'*',schema:'public',table:'observations'},p=>{ if(p.new?.workspace_id===currentWorkspace?.id||p.old?.workspace_id===currentWorkspace?.id) loadObservations(); }).subscribe(); }
async function bootSupabase(){ const {data}=await db.auth.getSession(); currentUser=data.session?.user||null; if(!currentUser){ setAuthMode('signin'); showAuth(); return; } showApp(); els.signOutBtn.hidden=false; await ensureProfile(); await setupWorkspace(); await loadObservations(); }
async function boot(){ setUserName(getUserName()); initEvents(); switchView('list'); setAuthMode('signin'); if(!SUPABASE_READY){ showApp(); els.signOutBtn.hidden=true; await setupWorkspace(); await loadObservations(); return; } db.auth.onAuthStateChange(async (_e,session)=>{ currentUser=session?.user||null; if(!currentUser){showAuth(); return;} showApp(); els.signOutBtn.hidden=false; await ensureProfile(); await setupWorkspace(); await loadObservations(); }); await bootSupabase(); subscribeRealtime(); }
boot();
