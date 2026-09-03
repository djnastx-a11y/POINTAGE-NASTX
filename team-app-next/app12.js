(()=>{
  const BUCKET='team-payslips';
  const MAX_PDF_SIZE=10*1024*1024;
  let adminDocsMode=false;
  let docsMembers=[];

  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const encPath=p=>String(p).split('/').map(encodeURIComponent).join('/');
  const fmtSize=n=>n>=1048576?`${(n/1048576).toFixed(1)} Mo`:`${Math.max(1,Math.round(n/1024))} Ko`;
  const fmtPeriod=p=>new Date(`${p}T12:00:00`).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});

  const style=document.createElement('style');
  style.textContent=`
    #view-documents .docsIntro{margin-bottom:14px}
    #view-documents .docsAdminGate,#view-documents .docsAdminPanel{margin-bottom:14px}
    #view-documents .docsAdminPanel{padding:16px}
    #view-documents .docsForm{display:grid;gap:10px}
    #view-documents .docsFormRow{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    #view-documents .docsFile{padding:12px;border:1px dashed #cfc1af;border-radius:14px;background:#fbf7f1}
    #view-documents .docsFile input{width:100%}
    #view-documents .docRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:14px 2px;border-bottom:1px solid #e5dacd}
    #view-documents .docRow:last-child{border-bottom:0}
    #view-documents .docTitle{font-weight:850;color:#24211e;text-transform:capitalize}
    #view-documents .docMeta{font-size:11px;color:#81786f;margin-top:4px;line-height:1.45}
    #view-documents .docActions{display:flex;gap:7px;align-items:center}
    #view-documents .docLock{font-size:12px;color:#756b61;line-height:1.5}
    #view-documents .uploadState{font-size:12px;color:#756b61;min-height:18px;margin-top:2px}
    @media(max-width:520px){#view-documents .docsFormRow{grid-template-columns:1fr}.docRow{grid-template-columns:1fr!important}.docActions{justify-content:flex-start}}
  `;
  document.head.appendChild(style);

  function ensureView(){
    if(document.getElementById('view-documents'))return;
    const main=document.querySelector('main.shell');
    if(!main)return;
    const section=document.createElement('section');
    section.className='view';
    section.id='view-documents';
    section.innerHTML=`
      <h1 class="pageTitle">Mes documents</h1>
      <div class="pageSub docsIntro">Tes fiches de paie sont stockées dans un espace privé. Toi et les administrateurs autorisés pouvez y accéder.</div>
      <div class="card docsAdminGate hidden" id="docsAdminGate">
        <div class="docLock"><b>Gestion des dossiers équipe</b><br>Accès protégé par le PIN administrateur pour consulter ou déposer un document dans le dossier d’un autre membre.</div>
        <button class="smallBtn" id="docsAdminUnlock" style="margin-top:12px">GÉRER LES DOSSIERS ÉQUIPE</button>
      </div>
      <div class="card docsAdminPanel hidden" id="docsAdminPanel">
        <div class="sectionHead"><h2>Déposer une fiche de paie</h2><small>PDF privé · 10 Mo max</small></div>
        <div class="docsForm">
          <div class="docsFormRow">
            <div><label>Employé</label><select id="docsEmployee"></select></div>
            <div><label>Mois concerné</label><input id="docsPeriod" type="month"/></div>
          </div>
          <div class="docsFile"><label>Fichier PDF</label><input id="docsFile" type="file" accept="application/pdf,.pdf"/></div>
          <button class="btn3d" id="docsUploadBtn">DÉPOSER LA FICHE DE PAIE</button>
          <div class="uploadState" id="docsUploadState"></div>
        </div>
      </div>
      <div class="section"><div class="sectionHead"><h2 id="docsListTitle">Mes fiches de paie</h2><small id="docsListCount"></small></div><div class="card" id="documentsList"><div class="empty">Chargement…</div></div></div>
    `;
    main.appendChild(section);

    const adminGroup=document.getElementById('adminMenuGroup');
    const drawerScroll=document.querySelector('.drawerScroll');
    if(drawerScroll&&!document.getElementById('documentsMenuBtn')){
      const btn=document.createElement('button');
      btn.className='menuItem';
      btn.id='documentsMenuBtn';
      btn.innerHTML='<span class="ico">▣</span>Mes documents';
      btn.onclick=openDocuments;
      if(adminGroup)drawerScroll.insertBefore(btn,adminGroup); else drawerScroll.appendChild(btn);
    }

    document.getElementById('docsAdminUnlock').onclick=()=>requireAdmin(()=>enableAdminDocs());
    document.getElementById('docsEmployee').onchange=renderDocuments;
    document.getElementById('docsUploadBtn').onclick=uploadPayslip;
  }

  async function api(path,options={}){
    const s=await ensureSession();
    if(!s)throw new Error('Session expirée. Reconnecte-toi.');
    const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
      ...options,
      headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json',...(options.headers||{})}
    });
    const text=await r.text();
    if(!r.ok)throw new Error(text||`Erreur ${r.status}`);
    return text?JSON.parse(text):[];
  }

  async function loadMembers(){
    docsMembers=await api('team_members?select=user_id,username,display_name,role,active&active=eq.true&order=display_name.asc');
    return docsMembers;
  }

  function showDocsView(){
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-documents'));
    document.querySelectorAll('.navBtn,.menuItem').forEach(b=>b.classList.remove('active'));
    document.getElementById('documentsMenuBtn')?.classList.add('active');
    const title=document.getElementById('topTitle');if(title)title.textContent='Mes documents';
    closeDrawer();
  }

  async function openDocuments(){
    ensureView();
    adminDocsMode=false;
    showDocsView();
    const isAdmin=!!currentProfile()?.admin;
    document.getElementById('docsAdminGate').classList.toggle('hidden',!isAdmin);
    document.getElementById('docsAdminPanel').classList.add('hidden');
    try{await loadMembers()}catch(e){console.warn(e)}
    await renderDocuments();
  }

  async function enableAdminDocs(){
    adminDocsMode=true;
    if(!docsMembers.length)await loadMembers();
    const select=document.getElementById('docsEmployee');
    select.innerHTML=docsMembers.map(m=>`<option value="${esc(m.user_id)}">${esc(m.display_name)}</option>`).join('');
    const selfId=getSession()?.user?.id||'';
    if(docsMembers.some(m=>m.user_id===selfId))select.value=selfId;
    document.getElementById('docsPeriod').value=new Date().toISOString().slice(0,7);
    document.getElementById('docsAdminPanel').classList.remove('hidden');
    document.getElementById('docsAdminGate').classList.add('hidden');
    await renderDocuments();
  }

  async function renderDocuments(){
    ensureView();
    const box=document.getElementById('documentsList');
    const count=document.getElementById('docsListCount');
    const title=document.getElementById('docsListTitle');
    box.innerHTML='<div class="empty">Chargement…</div>';
    try{
      const selfId=getSession()?.user?.id;
      if(!selfId)throw new Error('Session expirée.');
      const targetId=adminDocsMode?(document.getElementById('docsEmployee')?.value||selfId):selfId;
      const target=docsMembers.find(m=>m.user_id===targetId);
      title.textContent=adminDocsMode&&target?`Dossier de ${target.display_name}`:'Mes fiches de paie';
      const rows=await api(`team_documents?select=id,user_id,kind,period,storage_path,original_name,mime_type,size_bytes,created_at&user_id=eq.${encodeURIComponent(targetId)}&order=period.desc,created_at.desc`);
      count.textContent=rows.length?`${rows.length} document${rows.length>1?'s':''}`:'';
      if(!rows.length){box.innerHTML='<div class="empty">Aucune fiche de paie déposée pour le moment.</div>';return}
      box.innerHTML=rows.map(d=>`<div class="docRow"><div><div class="docTitle">${esc(fmtPeriod(d.period))}</div><div class="docMeta">Fiche de paie · ${esc(fmtSize(Number(d.size_bytes)||0))}<br>Déposée le ${esc(new Date(d.created_at).toLocaleDateString('fr-FR'))}</div></div><div class="docActions"><button class="smallBtn light" data-open-doc="${esc(d.id)}">OUVRIR PDF</button></div></div>`).join('');
      box.querySelectorAll('[data-open-doc]').forEach(btn=>btn.onclick=()=>{
        const doc=rows.find(x=>x.id===btn.dataset.openDoc);if(doc)openPdf(doc,btn);
      });
    }catch(e){box.innerHTML=`<div class="empty">${esc(e.message||'Impossible de charger les documents.')}</div>`;count.textContent=''}
  }

  async function openPdf(doc,btn){
    const original=btn.textContent;btn.disabled=true;btn.textContent='OUVERTURE…';
    try{
      const s=await ensureSession();if(!s)throw new Error('Session expirée.');
      const r=await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET}/${encPath(doc.storage_path)}`,{
        headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`}
      });
      if(!r.ok)throw new Error('Impossible d’ouvrir ce document.');
      const blob=await r.blob();
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;a.target='_blank';a.rel='noopener';a.download=doc.original_name||'fiche-de-paie.pdf';
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(e){toast(e.message||'Impossible d’ouvrir le PDF.')}finally{btn.disabled=false;btn.textContent=original}
  }

  async function uploadPayslip(){
    if(!adminDocsMode){toast('Accès administrateur requis.');return}
    const employeeId=document.getElementById('docsEmployee').value;
    const month=document.getElementById('docsPeriod').value;
    const file=document.getElementById('docsFile').files?.[0];
    const state=document.getElementById('docsUploadState');
    const btn=document.getElementById('docsUploadBtn');
    if(!employeeId){state.textContent='Choisis un employé.';return}
    if(!/^\d{4}-\d{2}$/.test(month)){state.textContent='Choisis le mois concerné.';return}
    if(!file){state.textContent='Choisis le PDF de la fiche de paie.';return}
    if(file.size<=0||file.size>MAX_PDF_SIZE){state.textContent='Le PDF doit faire moins de 10 Mo.';return}
    if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')){state.textContent='Seuls les fichiers PDF sont acceptés.';return}
    btn.disabled=true;state.textContent='Envoi sécurisé du document…';
    try{
      const s=await ensureSession();if(!s)throw new Error('Session expirée.');
      const form=new FormData();
      form.append('user_id',employeeId);
      form.append('period',`${month}-01`);
      form.append('file',file,file.name);
      const r=await fetch(`${SUPABASE_URL}/functions/v1/team-payslip-upload`,{
        method:'POST',
        headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`},
        body:form
      });
      const j=await r.json().catch(()=>({}));
      if(!r.ok){
        const labels={unauthorized:'Session expirée.',forbidden:'Accès administrateur refusé.',invalid_user:'Employé invalide.',invalid_period:'Mois invalide.',missing_file:'Fichier manquant.',file_too_large:'Le PDF dépasse 10 Mo.',pdf_only:'Seuls les PDF sont acceptés.',upload_failed:'Échec de l’envoi du PDF.',metadata_failed:'Le document n’a pas pu être enregistré.'};
        throw new Error(labels[j.error]||j.detail||'Impossible de déposer le document.');
      }
      document.getElementById('docsFile').value='';
      state.textContent='Fiche de paie déposée avec succès.';
      toast('Fiche de paie déposée');
      await renderDocuments();
    }catch(e){state.textContent=e.message||'Impossible de déposer le document.'}finally{btn.disabled=false}
  }

  ensureView();
})();
