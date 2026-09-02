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

  function randomPin(){
    const a=new Uint32Array(1);crypto.getRandomValues(a);
    return String(a[0]%100000000).padStart(8,'0');
  }

  async function teamFetch(path,options={}){
    const s=await ensureSession();if(!s)throw new Error('Session expirée');
    const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...options,headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json',...(options.headers||{})}});
    if(!r.ok)throw new Error((await r.text())||`Erreur ${r.status}`);
    const t=await r.text();return t?JSON.parse(t):[];
  }

  async function existingAccounts(){
    return teamFetch('team_members?select=username,display_name,role,active&order=display_name.asc');
  }

  async function createAccount(person){
    const s=await ensureSession();if(!s)throw new Error('Session expirée');
    const pin=randomPin();
    const r=await fetch(`${SUPABASE_URL}/functions/v1/team-admin-create-user`,{
      method:'POST',
      headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},
      body:JSON.stringify({username:person.id,displayName:person.name,role:person.role,tempPin:pin})
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||'Création impossible');
    return pin;
  }

  function ensureView(){
    if(document.getElementById('view-accounts'))return;
    const main=document.querySelector('main.shell');
    const section=document.createElement('section');
    section.className='view';section.id='view-accounts';
    section.innerHTML=`<h1 class="pageTitle">Comptes équipe</h1><div class="pageSub">Un compte personnel par personne. Un code temporaire est affiché une seule fois lors de la création.</div><div class="card" id="accountsList"><div class="empty">Chargement…</div></div>`;
    main?.appendChild(section);
  }

  async function renderAccounts(){
    ensureView();
    const box=document.getElementById('accountsList');
    box.innerHTML='<div class="empty">Chargement…</div>';
    try{
      const rows=await existingAccounts();
      const map=new Map(rows.map(x=>[x.username,x]));
      box.innerHTML=TEAM_ACCOUNTS.map(p=>{
        const exists=map.get(p.id);
        const role=p.role==='admin'?'Admin':'Équipe';
        return `<div class="listRow"><div class="listMain"><b>${p.name}</b><small>${role}${exists?' · compte actif':' · compte à créer'}</small></div>${exists?'<span class="statePill">ACTIF</span>':`<button class="smallBtn light" data-create-account="${p.id}">Créer</button>`}</div>`;
      }).join('');
      box.querySelectorAll('[data-create-account]').forEach(btn=>btn.onclick=async()=>{
        const person=TEAM_ACCOUNTS.find(x=>x.id===btn.dataset.createAccount);if(!person)return;
        btn.disabled=true;btn.textContent='Création…';
        try{
          const pin=await createAccount(person);
          openModal(`<div class="modal light"><div class="modalHead"><b>Compte ${person.name} créé</b><button class="closeBtn" data-close>✕</button></div><div class="restNotice">Identifiant : <b>${person.id}</b><br>Code temporaire : <b style="font-size:20px;letter-spacing:.12em">${pin}</b><br><br>Donne ce code uniquement à ${person.name}. Il n’est pas enregistré dans l’application en clair.</div><div class="modalActions"><button class="smallBtn light" data-close>OK</button></div></div>`);
          renderAccounts();
        }catch(e){toast(e.message||'Création impossible');btn.disabled=false;btn.textContent='Créer'}
      });
    }catch(e){box.innerHTML=`<div class="empty">${escapeHtml(e.message||'Impossible de charger les comptes.')}</div>`}
  }

  ensureView();
  const adminGroup=document.getElementById('adminMenuGroup');
  if(adminGroup&&!document.getElementById('accountsMenuBtn')){
    const btn=document.createElement('button');
    btn.className='menuItem locked';btn.id='accountsMenuBtn';
    btn.innerHTML='<span class="ico">●</span>Comptes équipe';
    btn.onclick=()=>requireAdmin(()=>{
      document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-accounts'));
      document.querySelectorAll('.navBtn,.menuItem').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const title=document.getElementById('topTitle');if(title)title.textContent='Comptes équipe';
      closeDrawer();renderAccounts();
    });
    adminGroup.appendChild(btn);
  }
})();
