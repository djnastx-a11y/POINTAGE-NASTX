(()=>{
  const TEAM_ACCOUNTS=[
    {id:'jb',name:'JB',role:'admin'},
    {id:'louella',name:'Louella',role:'member'},
    {id:'gillou',name:'Gillou',role:'member'},
    {id:'cyril',name:'Cyril',role:'member'},
    {id:'chloe',name:'Chloé',role:'member'},
    {id:'caro',name:'Caro',role:'member'},
    {id:'ingrid',name:'Ingrid',role:'admin'},
    {id:'coco',name:'Coco',role:'admin'}
  ];

  async function teamFetch(path,options={}){
    const s=await ensureSession();if(!s)throw new Error('Session expirée');
    const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...options,headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json',...(options.headers||{})}});
    const t=await r.text();if(!r.ok)throw new Error(t||`Erreur ${r.status}`);return t?JSON.parse(t):[];
  }
  const rpc=(name,body)=>teamFetch(`rpc/${name}`,{method:'POST',body:JSON.stringify(body||{})});
  const existingAccounts=()=>teamFetch('team_members?select=user_id,username,display_name,role,active,must_change_pin&order=display_name.asc');
  const pendingRequests=()=>teamFetch('team_signup_requests?select=user_id,email,status,requested_at&status=eq.pending&order=requested_at.asc');

  function ensureView(){
    if(document.getElementById('view-accounts'))return;
    const main=document.querySelector('main.shell'),section=document.createElement('section');
    section.className='view';section.id='view-accounts';
    section.innerHTML=`<h1 class="pageTitle">Comptes équipe</h1><div class="pageSub">Chaque personne crée elle-même son compte avec son email et son mot de passe. Ici, un admin valide seulement à quel prénom de l’équipe appartient le compte.</div><div class="section"><div class="sectionHead"><h2>Demandes en attente</h2><small id="pendingCount"></small></div><div class="card" id="pendingAccounts"><div class="empty">Chargement…</div></div></div><div class="section"><div class="sectionHead"><h2>Équipe</h2></div><div class="card" id="accountsList"><div class="empty">Chargement…</div></div></div>`;
    main?.appendChild(section);
  }

  async function approveRequest(userId,username,button){
    if(!username){toast('Choisis le prénom correspondant.');return}
    button.disabled=true;button.textContent='Validation…';
    try{await rpc('team_approve_signup',{request_user_id:userId,requested_username:username});if(typeof refreshAdminData==='function')await refreshAdminData();toast('Compte validé');await renderAccounts()}
    catch(e){const raw=String(e.message||'');toast(raw.includes('team_slot_unavailable')?'Ce prénom possède déjà un compte.':'Validation impossible.')}
    finally{button.disabled=false;button.textContent='VALIDER'}
  }

  async function rejectRequest(userId,button){
    button.disabled=true;
    try{await rpc('team_reject_signup',{request_user_id:userId});toast('Demande refusée');await renderAccounts()}
    catch{toast('Impossible de refuser la demande.')}
    finally{button.disabled=false}
  }

  async function renderAccounts(){
    ensureView();const box=$('accountsList'),pendingBox=$('pendingAccounts'),pendingCount=$('pendingCount');box.innerHTML='<div class="empty">Chargement…</div>';pendingBox.innerHTML='<div class="empty">Chargement…</div>';
    try{
      const [rows,pending]=await Promise.all([existingAccounts(),pendingRequests()]);
      const map=new Map(rows.map(x=>[x.username,x]));
      const free=TEAM_ACCOUNTS.filter(p=>!map.has(p.id));
      box.innerHTML=TEAM_ACCOUNTS.map(p=>{const row=map.get(p.id),role=p.role==='admin'?'Admin':'Équipe';return `<div class="listRow"><div class="listMain"><b>${escapeHtml(p.name)}</b><small>${role} · ${row?.active?'compte actif':'en attente de création'}</small></div><span class="statePill">${row?.active?'ACTIF':'LIBRE'}</span></div>`}).join('');
      pendingCount.textContent=pending.length?`${pending.length} demande${pending.length>1?'s':''}`:'';
      if(!pending.length){pendingBox.innerHTML='<div class="empty">Aucune demande. Les salariés peuvent créer leur compte directement depuis l’écran de connexion.</div>';return}
      pendingBox.innerHTML=pending.map((q,i)=>`<div class="listRow" style="align-items:flex-start"><div class="listMain"><b>${escapeHtml(q.email)}</b><small>Demande du ${new Date(q.requested_at).toLocaleString('fr-FR')}</small><select data-assign="${escapeHtml(q.user_id)}" style="margin-top:8px;max-width:190px"><option value="">Associer à…</option>${free.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}${p.role==='admin'?' · Admin':''}</option>`).join('')}</select></div><div style="display:grid;gap:7px"><button class="smallBtn light" data-approve="${escapeHtml(q.user_id)}">VALIDER</button><button class="smallBtn" data-reject="${escapeHtml(q.user_id)}">REFUSER</button></div></div>`).join('');
      pendingBox.querySelectorAll('[data-approve]').forEach(btn=>btn.onclick=()=>{const id=btn.dataset.approve,sel=pendingBox.querySelector(`[data-assign="${CSS.escape(id)}"]`);approveRequest(id,sel?.value||'',btn)});
      pendingBox.querySelectorAll('[data-reject]').forEach(btn=>btn.onclick=()=>rejectRequest(btn.dataset.reject,btn));
    }catch(e){const msg=escapeHtml(e.message||'Impossible de charger les comptes.');box.innerHTML=`<div class="empty">${msg}</div>`;pendingBox.innerHTML=`<div class="empty">${msg}</div>`}
  }

  ensureView();
  const adminGroup=$('adminMenuGroup');if(adminGroup&&!$('accountsMenuBtn')){const btn=document.createElement('button');btn.className='menuItem locked';btn.id='accountsMenuBtn';btn.innerHTML='<span class="ico">●</span>Comptes équipe';btn.onclick=()=>requireAdmin(()=>{document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-accounts'));document.querySelectorAll('.navBtn,.menuItem').forEach(b=>b.classList.remove('active'));btn.classList.add('active');if($('topTitle'))$('topTitle').textContent='Comptes équipe';closeDrawer();renderAccounts()});adminGroup.appendChild(btn)}
})();