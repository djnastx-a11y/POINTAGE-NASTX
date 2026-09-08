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
    if(!r.ok)throw new Error((await r.text())||`Erreur ${r.status}`);
    const t=await r.text();return t?JSON.parse(t):[];
  }

  async function existingAccounts(){return teamFetch('team_members?select=username,display_name,role,active,must_change_pin&order=display_name.asc')}

  function ensureView(){
    if(document.getElementById('view-accounts'))return;
    const main=document.querySelector('main.shell');
    const section=document.createElement('section');
    section.className='view';section.id='view-accounts';
    section.innerHTML=`<h1 class="pageTitle">Comptes équipe</h1><div class="pageSub">Chaque personne active elle-même son compte avec son code d’activation, puis choisit un code personnel que les administrateurs ne voient pas.</div><div class="card" id="accountsList"><div class="empty">Chargement…</div></div>`;
    main?.appendChild(section);
  }

  async function renderAccounts(){
    ensureView();
    const box=document.getElementById('accountsList');box.innerHTML='<div class="empty">Chargement…</div>';
    try{
      const rows=await existingAccounts();const map=new Map(rows.map(x=>[x.username,x]));
      box.innerHTML=TEAM_ACCOUNTS.map(p=>{
        const row=map.get(p.id);const role=p.role==='admin'?'Admin':'Équipe';const ready=!!(row?.active&&!row?.must_change_pin);
        const detail=ready?'compte activé':'première connexion à faire';
        return `<div class="listRow"><div class="listMain"><b>${p.name}</b><small>${role} · ${detail}</small></div><span class="statePill">${ready?'ACTIF':'À ACTIVER'}</span></div>`;
      }).join('');
    }catch(e){box.innerHTML=`<div class="empty">${escapeHtml(e.message||'Impossible de charger les comptes.')}</div>`}
  }

  ensureView();
  const adminGroup=document.getElementById('adminMenuGroup');
  if(adminGroup&&!document.getElementById('accountsMenuBtn')){
    const btn=document.createElement('button');btn.className='menuItem locked';btn.id='accountsMenuBtn';btn.innerHTML='<span class="ico">●</span>Comptes équipe';
    btn.onclick=()=>requireAdmin(()=>{document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-accounts'));document.querySelectorAll('.navBtn,.menuItem').forEach(b=>b.classList.remove('active'));btn.classList.add('active');const title=document.getElementById('topTitle');if(title)title.textContent='Comptes équipe';closeDrawer();renderAccounts()});
    adminGroup.appendChild(btn);
  }
})();
