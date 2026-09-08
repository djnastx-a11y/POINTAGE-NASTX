(()=>{
  const ACCOUNT_PREFIX='australia_team_secure_v1';
  let plannerRevision=0;
  let membersCache=[];
  let pointageBusy=false;
  let saveBusy=false;

  function accountKey(){return `${ACCOUNT_PREFIX}:${userId()||'signed-out'}`}
  async function api(path,options={}){
    const s=await ensureSession();
    if(!s)throw new Error('Session expirée. Reconnecte-toi.');
    const headers={apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json',Prefer:options.prefer||'return=representation',...(options.headers||{})};
    const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...options,headers});
    const text=await r.text();
    if(!r.ok)throw new Error(text||`Erreur ${r.status}`);
    return text?JSON.parse(text):[];
  }
  async function rpc(name,body={}){return api(`rpc/${name}`,{method:'POST',body:JSON.stringify(body)})}
  async function members(force=false){
    if(membersCache.length&&!force)return membersCache;
    membersCache=await api('team_members?select=user_id,username,display_name,role,active&active=eq.true&order=display_name.asc');
    return membersCache;
  }
  function usernameForUserId(uid){return membersCache.find(m=>m.user_id===uid)?.username||null}
  function userIdForUsername(username){return membersCache.find(m=>m.username===username)?.user_id||null}
  function pointageToSession(r){const employeeId=usernameForUserId(r.user_id);if(!employeeId)return null;return{id:r.id,employeeId,start:r.started_at,stop:r.ended_at||null,pauses:Array.isArray(r.pauses)?r.pauses:[],note:r.note||'',createdAt:r.created_at||r.started_at,source:r.source||'user'}}
  async function loadPointages(){await members();const rows=await api('team_pointages?select=id,user_id,started_at,ended_at,pauses,note,source,created_at&order=started_at.desc&limit=2000');state.sessions=rows.map(pointageToSession).filter(Boolean);return rows}
  async function loadPlanner(){
    const p=await rpc('team_read_planner',{});if(!p||typeof p!=='object')return;
    state.published=p.published&&typeof p.published==='object'?p.published:{};
    plannerRevision=Number(p.revision||0);
    if(currentProfile()?.admin){
      let unlocked=false;try{unlocked=(await rpc('team_is_admin',{}))===true}catch{}
      if(unlocked){state.drafts=p.drafts&&typeof p.drafts==='object'?p.drafts:{};state.weekExtras=p.weekExtras&&typeof p.weekExtras==='object'?p.weekExtras:{};adminUnlockedUntil=Date.now()+9*60*1000}
    }
  }

  window.loadLocal=function(){try{state=normalizeState(JSON.parse(localStorage.getItem(accountKey())||'null'))}catch{state=defaultState()}return state};
  window.saveLocal=function(){if(!state)return;state.updatedAt=new Date().toISOString();localStorage.setItem(accountKey(),JSON.stringify(state))};
  window.loadCloud=async function(){
    if(!userId()){setSync('Connexion requise','err');return false}
    try{window.loadLocal();setSync('Synchronisation…');await members(true);await Promise.all([loadPointages(),loadPlanner()]);window.saveLocal();setSync('Synchronisé','ok');renderAll();return true}
    catch(e){console.error(e);setSync('Synchronisation impossible','err');return false}
  };
  window.saveCloudNow=async function(){
    if(saveBusy||!userId())return false;window.saveLocal();if(!currentProfile()?.admin||Date.now()>adminUnlockedUntil)return true;saveBusy=true;
    try{if(await rpc('team_is_admin',{})!==true)return false;const data={drafts:state.drafts||{},published:state.published||{},weekExtras:state.weekExtras||{}};const next=await rpc('team_save_planner',{data,expected_revision:plannerRevision});plannerRevision=Number(next||plannerRevision);setSync('Synchronisé','ok');return true}
    catch(e){console.error(e);if(String(e.message||'').includes('planning_changed_reload')){toast('Planning modifié ailleurs. Recharge la page.');await loadPlanner();renderPublicPlanning()}else setSync('À synchroniser','err');return false}
    finally{saveBusy=false}
  };

  function setPointageButtons(disabled){['startBtn','pauseBtn','resumeBtn','stopBtn','homeMainAction'].forEach(id=>{const b=$(id);if(b)b.disabled=disabled})}
  window.act=async function(type){
    if(pointageBusy)return;const map={start:'team_clock_in',pause:'team_pause',resume:'team_resume',stop:'team_clock_out'};if(!map[type])return;pointageBusy=true;setPointageButtons(true);
    try{await rpc(map[type],{});await loadPointages();window.saveLocal();renderAll();const labels={start:'Arrivée enregistrée',pause:'Pause enregistrée',resume:'Reprise enregistrée',stop:'Départ enregistré'};toast(labels[type])}
    catch(e){const raw=String(e.message||'');const labels=[['already_clocked_in','Tu es déjà pointé.'],['not_clocked_in','Aucun pointage en cours.'],['already_paused','Tu es déjà en pause.'],['not_paused','Aucune pause en cours.'],['not_authorized','Compte non autorisé.']];toast(labels.find(([k])=>raw.includes(k))?.[1]||'Pointage impossible.')}
    finally{pointageBusy=false;setPointageButtons(false);renderPointing()}
  };

  window.renderCorrections=async function(){
    if(Date.now()>adminUnlockedUntil)return;const box=$('correctionList');if(box)box.innerHTML='<div class="empty">Chargement…</div>';
    try{await members(true);await loadPointages();const sel=$('correctionEmployee');const cur=sel.value;sel.innerHTML=EMPLOYEES.map(e=>`<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');if(cur&&EMPLOYEES.some(e=>e.id===cur))sel.value=cur;const empId=sel.value||'jb';const rows=sessionsForEmployee(empId).slice(0,100);box.innerHTML=rows.length?rows.map(s=>`<div class="listRow"><div class="listMain"><b>${fmtDate(dayKey(new Date(s.start)),{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</b><small>Arrivée ${hm(new Date(s.start))}${s.stop?` · départ ${hm(new Date(s.stop))}`:' · journée en cours'} · ${fmtMs(totalSessionMs(s,false))}</small></div><button class="smallBtn" data-edit-session="${s.id}">Modifier</button></div>`).join(''):'<div class="empty">Aucun pointage pour cette personne.</div>';box.querySelectorAll('[data-edit-session]').forEach(b=>b.onclick=()=>editSessionModal(b.dataset.editSession));window.saveLocal()}
    catch(e){box.innerHTML=`<div class="empty">${escapeHtml(e.message||'Impossible de charger les pointages.')}</div>`}
  };

  window.addManualSession=function(){
    openModal(`<div class="modal light"><div class="modalHead"><b>Ajouter une journée</b><button class="closeBtn" data-close>✕</button></div><div class="formGrid"><div class="full"><label>Personne</label><select id="newEmp">${EMPLOYEES.map(e=>`<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('')}</select></div><div class="full"><label>Date</label><input id="newDate" type="date" value="${dayKey(new Date())}"></div><div><label>Arrivée</label><input id="newStart" type="time"></div><div><label>Départ</label><input id="newStop" type="time"></div><div class="full"><label>Note</label><input id="newNote"></div></div><div class="modalActions"><button class="smallBtn" data-close>Annuler</button><button id="saveNewSession" class="smallBtn light">Ajouter</button></div><div id="manualMsg" class="sync"></div></div>`);
    $('newEmp').value=$('correctionEmployee').value||'jb';$('saveNewSession').onclick=async()=>{const emp=$('newEmp').value,date=$('newDate').value,st=$('newStart').value,sp=$('newStop').value,msg=$('manualMsg');if(!date||!st){msg.textContent='Date et arrivée obligatoires.';return}const uid=userIdForUsername(emp);if(!uid){msg.textContent='Le compte de cette personne n’est pas encore activé.';return}const btn=$('saveNewSession');btn.disabled=true;try{await api('team_pointages',{method:'POST',body:JSON.stringify({user_id:uid,started_at:new Date(`${date}T${st}:00`).toISOString(),ended_at:sp?endIso(date,st,sp):null,pauses:[],note:$('newNote').value.trim(),source:'admin'})});closeModal();await renderCorrections();renderAll();toast('Pointage ajouté')}catch(e){msg.textContent='Impossible d’ajouter ce pointage.'}finally{btn.disabled=false}};
  };

  window.editSessionModal=function(id){
    const s=state.sessions.find(x=>x.id===id);if(!s)return;const start=new Date(s.start),stop=s.stop?new Date(s.stop):null,ds=dayKey(start);
    openModal(`<div class="modal light"><div class="modalHead"><b>Corriger la journée</b><button class="closeBtn" data-close>✕</button></div><div class="formGrid"><div class="full"><label>Personne</label><select id="editEmp">${EMPLOYEES.map(e=>`<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('')}</select></div><div class="full"><label>Date</label><input id="editDate" type="date" value="${ds}"></div><div><label>Arrivée</label><input id="editStart" type="time" value="${hm(start)}"></div><div><label>Départ</label><input id="editStop" type="time" value="${stop?hm(stop):''}"></div><div class="full"><label>Note</label><input id="editNote" value="${escapeAttr(s.note||'')}"></div></div><div class="modalActions"><button id="deleteSession" class="smallBtn danger">Supprimer</button><button id="saveSessionEdit" class="smallBtn light">Enregistrer</button></div><div id="editSessionMsg" class="sync"></div></div>`);
    $('editEmp').value=s.employeeId;
    $('saveSessionEdit').onclick=async()=>{const emp=$('editEmp').value,date=$('editDate').value,st=$('editStart').value,sp=$('editStop').value,msg=$('editSessionMsg');if(!date||!st){msg.textContent='Date et arrivée obligatoires.';return}const uid=userIdForUsername(emp);if(!uid){msg.textContent='Le compte de cette personne n’est pas activé.';return}const btn=$('saveSessionEdit');btn.disabled=true;try{await api(`team_pointages?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({user_id:uid,started_at:new Date(`${date}T${st}:00`).toISOString(),ended_at:sp?endIso(date,st,sp):null,pauses:[],note:$('editNote').value.trim(),source:'admin'})});closeModal();await renderCorrections();renderAll();toast('Pointage corrigé')}catch(e){msg.textContent='Correction impossible.'}finally{btn.disabled=false}};
    $('deleteSession').onclick=async()=>{const btn=$('deleteSession');btn.disabled=true;try{await api(`team_pointages?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',prefer:'return=minimal'});closeModal();await renderCorrections();renderAll();toast('Pointage supprimé')}catch(e){$('editSessionMsg').textContent='Suppression impossible.'}finally{btn.disabled=false}};
  };

  window.renderAudit=async function(){
    if(Date.now()>adminUnlockedUntil)return;const box=$('auditList');box.innerHTML='<div class="empty">Chargement…</div>';
    try{await members();const rows=await api('team_audit?select=id,actor_user_id,action,entity_type,entity_id,detail,created_at&order=created_at.desc&limit=150');box.innerHTML=rows.length?rows.map(a=>{const actor=membersCache.find(m=>m.user_id===a.actor_user_id)?.display_name||'Admin';const detail=a.detail&&typeof a.detail==='object'?Object.entries(a.detail).filter(([,v])=>v!==null&&v!=='').slice(0,3).map(([k,v])=>`${k}: ${String(v)}`).join(' · '):'';return `<div class="listRow"><div class="listMain"><b>${escapeHtml(a.action)}</b><small>${new Date(a.created_at).toLocaleString('fr-FR')} · ${escapeHtml(actor)} · ${escapeHtml(a.entity_type||'')}${detail?` · ${escapeHtml(detail)}`:''}</small></div></div>`}).join(''):'<div class="empty">Aucune modification administrative.</div>'}
    catch(e){box.innerHTML='<div class="empty">Historique indisponible.</div>'}
  };

  window.audit=function(){};
  window.refreshAdminData=async function(){try{await members(true);await Promise.all([loadPointages(),loadPlanner()]);window.saveLocal();return true}catch(e){console.error(e);return false}};
})();