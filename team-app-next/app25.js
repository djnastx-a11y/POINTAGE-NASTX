(()=>{
  let undoStack=[],redoStack=[],lastSnapshot='',restoring=false;
  const SNAP_LIMIT=20;

  function ensureState(){
    if(!state||typeof state!=='object')return;
    if(!Array.isArray(state.availabilityRequests))state.availabilityRequests=[];
    if(!Array.isArray(state.replacementRequests))state.replacementRequests=[];
    if(!state.planningTemplates||typeof state.planningTemplates!=='object')state.planningTemplates={};
  }
  const safeClone=x=>JSON.parse(JSON.stringify(x));
  const snapshot=()=>{try{return JSON.stringify(state)}catch{return''}};
  const nowIso=()=>new Date().toISOString();
  const todayKey=()=>dayKey(new Date());
  const profile=()=>currentProfile?.()||null;

  function installHistory(){
    const baseSave=window.scheduleSave;
    if(typeof baseSave!=='function'||baseSave.__v25)return;
    lastSnapshot=snapshot();
    const wrapped=function(...args){
      ensureState();
      const current=snapshot();
      if(!restoring&&lastSnapshot&&current!==lastSnapshot){
        undoStack.push(lastSnapshot);if(undoStack.length>SNAP_LIMIT)undoStack.shift();redoStack=[];
      }
      lastSnapshot=current;
      return baseSave.apply(this,args);
    };
    wrapped.__v25=true;window.scheduleSave=wrapped;
  }
  function restoreSerialized(serialized){
    if(!serialized)return;
    try{restoring=true;const next=JSON.parse(serialized);Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,next);ensureState();lastSnapshot=snapshot();saveLocal();saveCloudNow?.();renderAll?.();renderAdminPlanning?.();renderAvailability();renderReplacements();renderTemplates();renderStatus();}
    finally{restoring=false}
  }
  function undo(){if(!undoStack.length){toast('Rien à annuler');return}const cur=snapshot(),prev=undoStack.pop();redoStack.push(cur);restoreSerialized(prev);toast('Modification annulée')}
  function redo(){if(!redoStack.length){toast('Rien à rétablir');return}const cur=snapshot(),next=redoStack.pop();undoStack.push(cur);restoreSerialized(next);toast('Modification rétablie')}

  function addView(id,title,sub,body){
    if(document.getElementById(id))return;
    const main=document.querySelector('main.shell');if(!main)return;
    const sec=document.createElement('section');sec.className='view';sec.id=id;sec.innerHTML=`<h1 class="pageTitle">${title}</h1><div class="pageSub">${sub}</div>${body}`;main.appendChild(sec);
  }
  function activate(id,title){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));const t=document.getElementById('topTitle');if(t)t.textContent=title;closeDrawer?.()}
  function addMenu(id,label,onClick,admin=false){
    if(document.getElementById(id))return;
    const host=admin?document.getElementById('adminMenuGroup'):document.querySelector('.drawerScroll');if(!host)return;
    const b=document.createElement('button');b.className='menuItem';b.id=id;b.innerHTML=`<span class="ico">${admin?'✣':'○'}</span>${label}`;b.onclick=onClick;
    if(admin)host.appendChild(b);else{const profileBox=host.querySelector('.drawerProfile');host.insertBefore(b,profileBox)}
  }

  function myAvailability(){const p=profile();return state.availabilityRequests.filter(r=>r.employeeId===p?.id).sort((a,b)=>b.date.localeCompare(a.date))}
  function renderAvailability(){
    const box=document.getElementById('v25AvailabilityList');if(!box||!state)return;ensureState();
    const rows=myAvailability();box.innerHTML=rows.length?rows.map(r=>`<div class="listRow"><div class="listMain"><b>${fmtDate(r.date,{weekday:'long',day:'numeric',month:'long'})}</b><small>${r.type==='unavailable'?'Indisponible':'Disponible'}${r.note?' · '+escapeHtml(r.note):''}</small></div><button class="smallBtn danger" data-v25-del-av="${r.id}">Supprimer</button></div>`).join(''):'<div class="empty">Aucune disponibilité renseignée.</div>';
    box.querySelectorAll('[data-v25-del-av]').forEach(b=>b.onclick=()=>{state.availabilityRequests=state.availabilityRequests.filter(x=>x.id!==b.dataset.v25DelAv);scheduleSave();renderAvailability();renderAdminPlanning?.()});
  }
  function saveAvailability(){const p=profile(),date=document.getElementById('v25AvDate')?.value,type=document.getElementById('v25AvType')?.value,note=document.getElementById('v25AvNote')?.value.trim()||'';if(!p||!date){toast('Choisis une date');return}state.availabilityRequests=state.availabilityRequests.filter(r=>!(r.employeeId===p.id&&r.date===date));state.availabilityRequests.push({id:crypto.randomUUID(),employeeId:p.id,date,type,note,createdAt:nowIso()});audit?.('Disponibilité modifiée',`${p.name} · ${fmtDate(date)} · ${type==='unavailable'?'indisponible':'disponible'}`);scheduleSave();renderAvailability();renderAdminPlanning?.();toast('Disponibilité enregistrée')}
  function unavailable(empId,date){return state.availabilityRequests.some(r=>r.employeeId===empId&&r.date===date&&r.type==='unavailable')}

  function allPublishedMine(){const p=profile();if(!p)return[];const out=[];Object.entries(state.published||{}).forEach(([wk,pub])=>Object.entries(pub?.days||{}).forEach(([date,items])=>(items||[]).forEach(x=>{if(x.employeeId===p.id&&date>=todayKey())out.push({wk,date,item:x})})));return out.sort((a,b)=>a.date.localeCompare(b.date))}
  function shiftLabel(s){return`${fmtDate(s.date,{weekday:'short',day:'numeric',month:'short'})} · ${displayRange(s.item)}`}
  function replacementStatus(r){return r.status==='approved'?'VALIDÉ':r.status==='accepted'?'À VALIDER':r.status==='declined'?'REFUSÉ':r.status==='rejected'?'REFUSÉ ADMIN':'EN ATTENTE'}
  function renderReplacements(){
    const shiftSel=document.getElementById('v25ReplacementShift'),targetSel=document.getElementById('v25ReplacementTarget'),box=document.getElementById('v25ReplacementList');if(!box||!state)return;ensureState();const p=profile();
    if(shiftSel){const shifts=allPublishedMine();shiftSel.innerHTML=shifts.length?shifts.map(s=>`<option value="${s.wk}|${s.date}|${s.item.id}">${escapeHtml(shiftLabel(s))}</option>`).join(''):'<option value="">Aucun service publié à venir</option>'}
    if(targetSel)targetSel.innerHTML=EMPLOYEES.filter(e=>e.id!==p?.id).map(e=>`<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');
    const rows=state.replacementRequests.filter(r=>r.requesterId===p?.id||r.targetId===p?.id||p?.admin).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    box.innerHTML=rows.length?rows.map(r=>{const requester=employee(r.requesterId)?.name||r.requesterId,target=employee(r.targetId)?.name||r.targetId;let actions='';if(r.targetId===p?.id&&r.status==='pending')actions=`<button class="smallBtn light" data-v25-accept="${r.id}">Accepter</button><button class="smallBtn danger" data-v25-decline="${r.id}">Refuser</button>`;if(p?.admin&&r.status==='accepted')actions=`<button class="smallBtn light" data-v25-approve="${r.id}">Valider</button><button class="smallBtn danger" data-v25-reject="${r.id}">Refuser</button>`;return`<div class="v25Request"><div><b>${escapeHtml(requester)} → ${escapeHtml(target)}</b><small>${fmtDate(r.date,{weekday:'long',day:'numeric',month:'long'})} · ${escapeHtml(r.range||'')}</small><span class="statePill">${replacementStatus(r)}</span></div><div class="v25ReqActions">${actions}</div></div>`}).join(''):'<div class="empty">Aucune demande de remplacement.</div>';
    box.querySelectorAll('[data-v25-accept]').forEach(b=>b.onclick=()=>setReplacement(b.dataset.v25Accept,'accepted'));
    box.querySelectorAll('[data-v25-decline]').forEach(b=>b.onclick=()=>setReplacement(b.dataset.v25Decline,'declined'));
    box.querySelectorAll('[data-v25-approve]').forEach(b=>b.onclick=()=>approveReplacement(b.dataset.v25Approve));
    box.querySelectorAll('[data-v25-reject]').forEach(b=>b.onclick=()=>setReplacement(b.dataset.v25Reject,'rejected'));
  }
  function createReplacement(){const key=document.getElementById('v25ReplacementShift')?.value,targetId=document.getElementById('v25ReplacementTarget')?.value,p=profile();if(!key||!targetId||!p){toast('Choisis le service et la personne');return}const [wk,date,id]=key.split('|'),item=state.published?.[wk]?.days?.[date]?.find(x=>x.id===id);if(!item){toast('Service introuvable');return}state.replacementRequests.push({id:crypto.randomUUID(),wk,date,assignmentId:id,requesterId:p.id,targetId,range:displayRange(item),status:'pending',createdAt:nowIso()});audit?.('Remplacement demandé',`${p.name} → ${employee(targetId)?.name||targetId} · ${fmtDate(date)}`);scheduleSave();renderReplacements();toast('Demande envoyée')}
  function setReplacement(id,status){const r=state.replacementRequests.find(x=>x.id===id);if(!r)return;r.status=status;r.updatedAt=nowIso();audit?.('Remplacement mis à jour',`${r.id} · ${status}`);scheduleSave();renderReplacements();toast(status==='accepted'?'Demande acceptée':'Demande mise à jour')}
  function approveReplacement(id){const r=state.replacementRequests.find(x=>x.id===id);if(!r||r.status!=='accepted')return;const pub=state.published?.[r.wk],item=pub?.days?.[r.date]?.find(x=>x.id===r.assignmentId);if(!item){toast('Service publié introuvable');return}item.employeeId=r.targetId;item.name=employee(r.targetId)?.name||r.targetId;const draft=state.drafts?.[r.wk],draftItem=draft?.days?.[r.date]?.find(x=>x.id===r.assignmentId);if(draftItem){draftItem.employeeId=r.targetId;draftItem.name=item.name}r.status='approved';r.updatedAt=nowIso();audit?.('Remplacement validé',`${fmtDate(r.date)} · ${item.name}`);scheduleSave();renderReplacements();renderPublicPlanning?.();renderAdminPlanning?.();toast('Remplacement validé')}

  function templateEntries(){return Object.entries(state.planningTemplates||{}).sort((a,b)=>(a[1].name||'').localeCompare(b[1].name||''))}
  function renderTemplates(){const box=document.getElementById('v25TemplateList');if(!box||!state)return;ensureState();const list=templateEntries();box.innerHTML=list.length?list.map(([id,t])=>`<div class="listRow"><div class="listMain"><b>${escapeHtml(t.name)}</b><small>Modèle de semaine</small></div><div class="v25ReqActions"><button class="smallBtn light" data-v25-apply-template="${id}">Appliquer</button><button class="smallBtn danger" data-v25-del-template="${id}">Supprimer</button></div></div>`).join(''):'<div class="empty">Aucun modèle enregistré.</div>';box.querySelectorAll('[data-v25-apply-template]').forEach(b=>b.onclick=()=>applyTemplate(b.dataset.v25ApplyTemplate));box.querySelectorAll('[data-v25-del-template]').forEach(b=>b.onclick=()=>{delete state.planningTemplates[b.dataset.v25DelTemplate];scheduleSave();renderTemplates()})}
  function saveTemplate(){const name=document.getElementById('v25TemplateName')?.value.trim(),wk=weekKey(adminWeek),draft=draftFor(wk);if(!name){toast('Donne un nom au modèle');return}const days=[];for(let i=0;i<7;i++){const d=new Date(adminWeek);d.setDate(d.getDate()+i);const ds=dayKey(d);days.push((draft.days?.[ds]||[]).map(x=>safeClone(x)))}const staffing=[];for(let i=0;i<7;i++){const d=new Date(adminWeek);d.setDate(d.getDate()+i);staffing.push(safeClone(draft.staffing?.[dayKey(d)]||{kitchen:'OFF',security:'OFF'}))}const id=crypto.randomUUID();state.planningTemplates[id]={name,days,staffing,createdAt:nowIso()};audit?.('Modèle planning créé',name);scheduleSave();document.getElementById('v25TemplateName').value='';renderTemplates();toast('Modèle enregistré')}
  function applyTemplate(id){const t=state.planningTemplates[id];if(!t)return;const wk=weekKey(adminWeek),dest={days:{},staffing:{},updatedAt:nowIso()};for(let i=0;i<7;i++){const d=new Date(adminWeek);d.setDate(d.getDate()+i);const ds=dayKey(d);dest.days[ds]=(t.days?.[i]||[]).map(x=>({...safeClone(x),id:crypto.randomUUID()}));dest.staffing[ds]=safeClone(t.staffing?.[i]||{kitchen:'OFF',security:'OFF'})}state.drafts[wk]=dest;audit?.('Modèle planning appliqué',`${t.name} · ${weekLabelText(adminWeek)}`);scheduleSave();renderAdminPlanning?.();renderStatus();toast('Modèle appliqué')}

  function publicationStatus(){const wk=weekKey(adminWeek),draft=state.drafts?.[wk],pub=state.published?.[wk];if(!pub)return draft?'BROUILLON':'AUCUN PLANNING';const d=JSON.stringify({days:draft?.days||{},staffing:draft?.staffing||{}}),p=JSON.stringify({days:pub?.days||{},staffing:pub?.staffing||{}});return d===p?'PUBLIÉ':'MODIFIÉ DEPUIS PUBLICATION'}
  function renderStatus(){const e=document.getElementById('v25PublishStatus');if(!e||!state)return;const s=publicationStatus();e.textContent=s;e.dataset.state=s}

  function decoratePlanning(){
    if(!state)return;ensureState();const palette=document.getElementById('peoplePalette');if(palette&&!palette.querySelector('[data-person="__unassigned__"]')){const b=document.createElement('button');b.className='personChip v25Unassigned';b.dataset.person='__unassigned__';b.dataset.name='À POURVOIR';b.textContent='À POURVOIR';palette.appendChild(b)}
    document.querySelectorAll('#adminPlanning .shiftCard[data-assignment]').forEach(card=>{const f=findAssignment?.(card.dataset.assignment);if(!f||!f.item?.employeeId)return;if(unavailable(f.item.employeeId,f.date)){card.classList.add('v25Conflict');if(!card.querySelector('.v25ConflictTag')){const tag=document.createElement('span');tag.className='v25ConflictTag';tag.textContent='INDISPONIBLE';card.querySelector('.shiftMeta')?.append(' ',tag)}}});
    renderStatus();
  }

  function installAdminToolbar(){const toolbar=document.querySelector('#view-planningAdmin .toolbar');if(!toolbar||document.getElementById('v25PublishStatus'))return;const status=document.createElement('span');status.id='v25PublishStatus';status.className='v25Status';toolbar.appendChild(status);const undoBtn=document.createElement('button');undoBtn.className='smallBtn';undoBtn.textContent='Annuler';undoBtn.onclick=undo;toolbar.appendChild(undoBtn);const redoBtn=document.createElement('button');redoBtn.className='smallBtn';redoBtn.textContent='Rétablir';redoBtn.onclick=redo;toolbar.appendChild(redoBtn);const tplBtn=document.createElement('button');tplBtn.className='smallBtn light';tplBtn.textContent='Modèles';tplBtn.onclick=()=>{requireAdmin?.(()=>{activate('view-v25-templates','Modèles de planning');renderTemplates()})};toolbar.appendChild(tplBtn);renderStatus()}

  function installUI(){
    const style=document.createElement('style');style.textContent=`
      .v25Status{display:inline-flex;align-items:center;min-height:34px;padding:0 10px;border-radius:999px;background:#eee5d8;border:1px solid #d7c9b8;font-size:9px;font-weight:900;letter-spacing:.06em;color:#4c4339}.v25Status[data-state="PUBLIÉ"]{background:#e8f3e9;color:#246238}.v25Status[data-state="MODIFIÉ DEPUIS PUBLICATION"]{background:#fff0d9;color:#82551b}.v25Unassigned{border-style:dashed!important}.v25Conflict{border-color:#c64d4d!important;background:#fff2ef!important}.v25ConflictTag{color:#a33131;font-size:8px;font-weight:900}.v25Request{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid #ded2c3}.v25Request:last-child{border-bottom:0}.v25Request small{display:block;margin:4px 0 7px;color:#7c7064}.v25ReqActions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.v25Form{display:grid;gap:10px}.v25FormRow{display:grid;grid-template-columns:1fr 1fr;gap:9px}@media(max-width:520px){.v25Request{grid-template-columns:1fr}.v25ReqActions{justify-content:flex-start}.v25FormRow{grid-template-columns:1fr}}
    `;document.head.appendChild(style);
    addView('view-v25-availability','Mes disponibilités','Indique les jours où tu es disponible ou indisponible. Les admins le voient pendant la préparation du planning.',`<div class="card v25Form"><div class="v25FormRow"><div><label>Date</label><input id="v25AvDate" type="date"></div><div><label>Statut</label><select id="v25AvType"><option value="unavailable">Indisponible</option><option value="available">Disponible</option></select></div></div><div><label>Note facultative</label><input id="v25AvNote" maxlength="120" placeholder="Ex. cours jusqu’à 20h"></div><button class="smallBtn light" id="v25SaveAvailability">ENREGISTRER</button></div><div class="card" id="v25AvailabilityList"></div>`);
    addView('view-v25-replacements','Remplacements','Demande à un collègue de reprendre un service. Le collègue accepte, puis un admin valide.',`<div class="card v25Form"><div><label>Mon service</label><select id="v25ReplacementShift"></select></div><div><label>Demander à</label><select id="v25ReplacementTarget"></select></div><button class="smallBtn light" id="v25CreateReplacement">ENVOYER LA DEMANDE</button></div><div class="card" id="v25ReplacementList"></div>`);
    addView('view-v25-templates','Modèles de planning','Enregistre une semaine type puis applique-la en un clic à une autre semaine.',`<div class="card v25Form"><div><label>Nom du modèle</label><input id="v25TemplateName" maxlength="50" placeholder="Ex. Semaine normale"></div><button class="smallBtn light" id="v25SaveTemplate">ENREGISTRER LA SEMAINE ACTUELLE</button></div><div class="card" id="v25TemplateList"></div>`);
    addMenu('v25AvailabilityMenu','Mes disponibilités',()=>{activate('view-v25-availability','Mes disponibilités');renderAvailability()});
    addMenu('v25ReplacementMenu','Remplacements',()=>{activate('view-v25-replacements','Remplacements');renderReplacements()});
    document.getElementById('v25SaveAvailability').onclick=saveAvailability;document.getElementById('v25CreateReplacement').onclick=createReplacement;document.getElementById('v25SaveTemplate').onclick=saveTemplate;
    installAdminToolbar();
  }

  function wrapPlanning(){const baseRender=window.renderAdminPlanning;if(typeof baseRender==='function'&&!baseRender.__v25){const w=function(...args){const out=baseRender.apply(this,args);setTimeout(()=>{installAdminToolbar();decoratePlanning()},0);return out};w.__v25=true;window.renderAdminPlanning=w}const basePublish=window.publishWeek;if(typeof basePublish==='function'&&!basePublish.__v25){const w=function(...args){const out=basePublish.apply(this,args);setTimeout(renderStatus,0);return out};w.__v25=true;window.publishWeek=w}}

  function boot(){if(!window.state){setTimeout(boot,100);return}ensureState();installHistory();installUI();wrapPlanning();decoratePlanning();renderAvailability();renderReplacements();renderTemplates()}
  setTimeout(boot,250);
})();