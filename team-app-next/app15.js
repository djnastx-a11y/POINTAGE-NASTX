(()=>{
  const TEAM=[
    {id:'jb',name:'JB',role:'creator_admin'},
    {id:'coco',name:'Coco',role:'admin'},
    {id:'ingrid',name:'Ingrid',role:'admin'},
    {id:'cyril',name:'Cyrille',role:'member'},
    {id:'louella',name:'Louella',role:'member'},
    {id:'caro',name:'Caro',role:'member'},
    {id:'gillou',name:'Gillou',role:'member'},
    {id:'chloe',name:'Chloé',role:'member'}
  ];
  const ADMIN_IDS=new Set(['jb','coco','ingrid']);
  const CREATOR_ID='jb';
  const base={
    currentProfile:window.currentProfile,
    renderAdminPlanning:window.renderAdminPlanning,
    renderPublicPlanning:window.renderPublicPlanning,
    publicShiftCard:window.publicShiftCard,
    adminShiftCard:window.adminShiftCard,
    openShiftEditor:window.openShiftEditor,
    copyPreviousWeek:window.copyPreviousWeek,
    publishWeek:window.publishWeek,
    renderAll:window.renderAll
  };

  const cyril=EMPLOYEES.find(e=>e.id==='cyril');if(cyril)cyril.name='Cyrille';
  window.currentProfile=function(){
    const p=base.currentProfile?.();
    if(!p)return p;
    p.admin=ADMIN_IDS.has(p.id);
    p.creator=p.id===CREATOR_ID;
    if(p.id==='cyril')p.name='Cyrille';
    return p;
  };

  const style=document.createElement('style');
  style.textContent=`
    .v15Staffing{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:9px 10px 4px}
    .v15StaffBtn,.v15StaffStatic{border:1px solid #ded2c3;border-radius:12px;background:#fffaf2;padding:9px 10px;text-align:left;min-width:0}
    .v15StaffBtn{cursor:pointer;color:#181512}
    .v15StaffBtn span,.v15StaffStatic span{display:block;font-size:9px;font-weight:900;letter-spacing:.12em;color:#877a6c;margin-bottom:3px}
    .v15StaffBtn b,.v15StaffStatic b{font-size:12px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .v15PlanHours{display:block;font-size:9px;margin-top:3px;color:#817568;font-weight:800}
    .v15MenuBadge{margin-left:auto;min-width:20px;height:20px;border-radius:10px;padding:0 6px;display:inline-grid;place-items:center;background:#181512;color:#fff;font-size:10px;font-weight:900}
    .v15MenuBadge:empty{display:none}
    .v15Metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:12px 0}
    .v15Metric{background:#fffaf2;border:1px solid #ded2c3;border-radius:15px;padding:13px;min-width:0}
    .v15Metric b{display:block;font-size:21px;line-height:1.1;color:#181512;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .v15Metric span{display:block;margin-top:5px;font-size:9px;font-weight:900;letter-spacing:.08em;color:#877a6c}
    .v15Metric.good b{color:#22683b}.v15Metric.bad b{color:#9d3838}
    .v15StatsActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
    .v15ChatTop{display:grid;gap:9px;margin-bottom:10px}.v15ChatBox{height:min(54vh,520px);overflow:auto;padding:12px;background:#eee5d8;border:1px solid #d9ccbb;border-radius:18px;display:flex;flex-direction:column;gap:8px}
    .v15Bubble{max-width:82%;align-self:flex-start;background:#fffaf2;border:1px solid #ddd0c0;border-radius:15px 15px 15px 5px;padding:9px 11px;box-shadow:0 2px 5px rgba(60,45,30,.05)}
    .v15Bubble.mine{align-self:flex-end;background:#1d1b19;color:#fff;border-color:#1d1b19;border-radius:15px 15px 5px 15px}
    .v15BubbleHead{font-size:9px;font-weight:900;opacity:.68;margin-bottom:4px}.v15BubbleBody{white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.35}.v15BubbleMeta{font-size:8px;opacity:.62;text-align:right;margin-top:5px}
    .v15Composer{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:9px}.v15Composer textarea{min-height:46px;max-height:110px;resize:vertical}
    .v15NotifItem{width:100%;text-align:left;border:0;background:transparent;padding:0;color:inherit}.v15NotifUnread{position:relative}.v15NotifUnread:before{content:'';position:absolute;left:-11px;top:6px;width:6px;height:6px;border-radius:50%;background:#181512}
    .v15RoleCreator{font-weight:900;color:#6b512a}
    @media(min-width:720px){.v15Metrics{grid-template-columns:repeat(3,minmax(0,1fr))}}
  `;
  document.head.appendChild(style);

  async function api(path,options={}){
    const s=await ensureSession();if(!s)throw new Error('Session expirée. Reconnecte-toi.');
    const headers={apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json',Prefer:options.prefer||'return=representation',...(options.headers||{})};
    const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...options,headers});
    const text=await r.text();if(!r.ok)throw new Error(text||`Erreur ${r.status}`);return text?JSON.parse(text):[];
  }
  const rpc=(name,body={})=>api(`rpc/${name}`,{method:'POST',body:JSON.stringify(body)});
  let membersCache=[],targetsCache=[];
  async function members(force=false){
    if(membersCache.length&&!force)return membersCache;
    membersCache=await api('team_members?select=user_id,username,display_name,role,active&active=eq.true&order=display_name.asc');return membersCache;
  }
  async function targets(force=false){
    if(targetsCache.length&&!force)return targetsCache;
    targetsCache=await api('team_hour_targets?select=user_id,weekly_target_minutes,updated_at');return targetsCache;
  }
  const memberByUsername=u=>membersCache.find(m=>m.username===u)||null;
  const nameForUid=uid=>membersCache.find(m=>m.user_id===uid)?.display_name||'Membre';

  function minutesLabel(mins,signed=false){
    const n=Math.round(Number(mins)||0),sign=signed?(n>0?'+':n<0?'-':''):'';const a=Math.abs(n);return`${sign}${Math.floor(a/60)}h${pad(a%60)}`;
  }
  function plannedMinutes(x){
    const stored=Number(x?.plannedMinutes);if(Number.isFinite(stored)&&stored>=0)return Math.round(stored);
    if(x?.startMode==='time'&&x?.endMode==='time'&&/^\d{2}:\d{2}$/.test(x.start||'')&&/^\d{2}:\d{2}$/.test(x.end||'')){
      const [sh,sm]=x.start.split(':').map(Number),[eh,em]=x.end.split(':').map(Number);let a=sh*60+sm,b=eh*60+em;if(b<=a)b+=1440;return Math.max(0,b-a);
    }
    return 0;
  }
  function plannedForWeek(username,date=new Date()){
    const wk=weekKey(date),pub=state?.published?.[wk],days=pub?.days||{};let total=0;
    Object.values(days).forEach(items=>(items||[]).forEach(x=>{if(x.employeeId===username)total+=plannedMinutes(x)}));return total;
  }
  function actualForWeek(username,date=new Date()){
    const s=startOfWeek(date),e=new Date(s);e.setDate(e.getDate()+7);return Math.round((state?.sessions||[]).filter(x=>x.employeeId===username&&new Date(x.start)>=s&&new Date(x.start)<e).reduce((a,x)=>a+totalSessionMs(x,false),0)/60000);
  }
  function actualForMonth(username,date=new Date()){
    return Math.round((state?.sessions||[]).filter(x=>{const d=new Date(x.start);return x.employeeId===username&&d.getFullYear()===date.getFullYear()&&d.getMonth()===date.getMonth()}).reduce((a,x)=>a+totalSessionMs(x,false),0)/60000);
  }
  function plannedForMonth(username,date=new Date()){
    let total=0;for(const pub of Object.values(state?.published||{})){for(const [ds,items] of Object.entries(pub?.days||{})){const d=new Date(`${ds}T12:00:00`);if(d.getFullYear()!==date.getFullYear()||d.getMonth()!==date.getMonth())continue;(items||[]).forEach(x=>{if(x.employeeId===username)total+=plannedMinutes(x)})}}return total;
  }
  function targetForMember(m){return Number(targetsCache.find(t=>t.user_id===m?.user_id)?.weekly_target_minutes||0)}
  function statsFor(username,date=new Date()){
    const m=memberByUsername(username),target=targetForMember(m),planned=plannedForWeek(username,date),actual=actualForWeek(username,date),diff=actual-planned,remain=target-actual;
    return{m,target,planned,actual,diff,remain,monthActual:actualForMonth(username,date),monthPlanned:plannedForMonth(username,date)};
  }
  function metric(label,value,cls=''){return`<div class="v15Metric ${cls}"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`}
  function statsMetrics(s){return`${metric('OBJECTIF SEMAINE',minutesLabel(s.target))}${metric('HEURES PRÉVUES',minutesLabel(s.planned))}${metric('HEURES RÉELLES',minutesLabel(s.actual))}${metric('ÉCART RÉEL / PRÉVU',minutesLabel(s.diff,true),s.diff>=0?'good':'bad')}${metric('RESTE SUR OBJECTIF',minutesLabel(Math.max(0,s.remain)),s.remain<=0?'good':'')}${metric('RÉEL CE MOIS',minutesLabel(s.monthActual))}`}

  function staffingForDraft(wk,date){
    const draft=draftFor(wk);if(!draft.staffing||typeof draft.staffing!=='object')draft.staffing={};if(!draft.staffing[date])draft.staffing[date]={kitchen:'OFF',security:'OFF'};return draft.staffing[date];
  }
  const staffingValue=v=>String(v||'OFF').trim()||'OFF';
  function staffingHtml(date,row,editable){
    const one=(key,label)=>editable?`<button class="v15StaffBtn" data-v15-staff="${key}" data-v15-date="${date}"><span>${label}</span><b>${escapeHtml(staffingValue(row?.[key]))}</b></button>`:`<div class="v15StaffStatic"><span>${label}</span><b>${escapeHtml(staffingValue(row?.[key]))}</b></div>`;
    return`<div class="v15Staffing">${one('kitchen','CUISINE')}${one('security','SÉCU')}</div>`;
  }
  function editStaffing(date,key){
    const wk=weekKey(adminWeek),row=staffingForDraft(wk,date),label=key==='kitchen'?'CUISINE':'SÉCU';
    openModal(`<div class="modal light"><div class="modalHead"><b>${label} · ${escapeHtml(fmtDate(date,{weekday:'long',day:'numeric',month:'long'}))}</b><button class="closeBtn" data-close>✕</button></div><div class="pageSub">Entre le nom de la personne, ou choisis OFF.</div><label>Nom</label><input id="v15StaffName" maxlength="50" value="${escapeAttr(staffingValue(row[key])==='OFF'?'':staffingValue(row[key]))}" placeholder="Ex. Anthony"><div class="modalActions"><button class="smallBtn" id="v15StaffOff">OFF</button><button class="smallBtn light" id="v15StaffSave">Enregistrer</button></div></div>`);
    const save=value=>{row[key]=value==='OFF'?'OFF':String(value||'').trim().slice(0,50)||'OFF';audit(`${label} planning modifié`,`${fmtDate(date)} · ${row[key]}`);scheduleSave();closeModal();renderAdminPlanning()};
    $('v15StaffOff').onclick=()=>save('OFF');$('v15StaffSave').onclick=()=>save($('v15StaffName').value);
  }

  window.publicShiftCard=function(x){const p=plannedMinutes(x);return`<div class="shiftCard" style="cursor:default"><div><div class="shiftName">${escapeHtml(x.name)}</div><div class="shiftMeta">${x.isExtra?'Extra':'Équipe'}</div></div><div class="shiftTime">${escapeHtml(displayRange(x))}${p?`<span class="v15PlanHours">${minutesLabel(p)} prévues</span>`:''}</div><div></div></div>`};
  window.adminShiftCard=function(x){const p=plannedMinutes(x);return`<div class="shiftCard" data-assignment="${x.id}"><div><div class="shiftName">${escapeHtml(x.name)}</div><div class="shiftMeta">${x.isExtra?'Extra':'Équipe'}</div></div><div class="shiftTime">${escapeHtml(displayRange(x))}${p?`<span class="v15PlanHours">${minutesLabel(p)} prévues</span>`:''}</div><button class="shiftEdit" data-edit-shift="${x.id}">⋮</button></div>`};

  window.renderAdminPlanning=function(){
    base.renderAdminPlanning?.();const wk=weekKey(adminWeek),draft=draftFor(wk);
    document.querySelectorAll('#adminPlanning .adminDrop[data-date]').forEach(drop=>{const date=drop.dataset.date,block=drop.closest('.dayBlock');if(!block||block.querySelector('.v15Staffing'))return;const wrap=document.createElement('div');wrap.innerHTML=staffingHtml(date,staffingForDraft(wk,date),true);block.insertBefore(wrap.firstElementChild,drop)});
    document.querySelectorAll('#adminPlanning [data-v15-staff]').forEach(b=>b.onclick=()=>editStaffing(b.dataset.v15Date,b.dataset.v15Staff));
  };
  window.renderPublicPlanning=function(){
    base.renderPublicPlanning?.();const wk=weekKey(publicWeek),pub=state?.published?.[wk],staff=pub?.staffing||{};
    document.querySelectorAll('#publicPlanning .dayBlock').forEach((block,i)=>{if(block.querySelector('.v15Staffing'))return;const d=new Date(publicWeek);d.setDate(d.getDate()+i);const ds=dayKey(d),list=block.querySelector('.dayList'),wrap=document.createElement('div');wrap.innerHTML=staffingHtml(ds,staff[ds]||{kitchen:'OFF',security:'OFF'},false);block.insertBefore(wrap.firstElementChild,list)});
  };
  window.openShiftEditor=function(id){
    const f=findAssignment(id);if(!f)return;const x=f.item,p=plannedMinutes(x),hours=p?(p/60).toFixed(p%60?2:0):'';
    openModal(`<div class="modal light lightForm"><div class="modalHead"><b>${escapeHtml(x.name)}</b><button class="closeBtn" data-close>✕</button></div><div class="formGrid"><div><label>Début</label><select id="shiftStartMode"><option value="time">Heure</option><option value="open">Ouverture</option></select></div><div><label>Heure début</label><input id="shiftStart" type="time" value="${x.start||''}"></div><div><label>Fin</label><select id="shiftEndMode"><option value="time">Heure</option><option value="close">Fermeture</option><option value="kitchen">Fin cuisine</option></select></div><div><label>Heure fin</label><input id="shiftEnd" type="time" value="${x.end||''}"></div><div class="full"><label>Nombre d’heures prévues</label><input id="shiftPlannedHours" type="number" inputmode="decimal" min="0" max="24" step="0.25" value="${hours}" placeholder="Ex. 7.5"></div><div class="full"><label>Note</label><input id="shiftNote" value="${escapeAttr(x.note||'')}"></div></div><div class="modalActions"><button id="deleteShift" class="smallBtn danger">Supprimer la case</button><button id="saveShift" class="smallBtn light">Enregistrer</button></div><div id="v15ShiftMsg" class="sync"></div></div>`);
    $('shiftStartMode').value=x.startMode||'time';$('shiftEndMode').value=x.endMode||'close';
    $('saveShift').onclick=()=>{const h=$('shiftPlannedHours').value.trim();if(h!==''&&(Number(h)<0||Number(h)>24||!Number.isFinite(Number(h)))){$('v15ShiftMsg').textContent='Nombre d’heures invalide.';return}x.startMode=$('shiftStartMode').value;x.start=$('shiftStart').value;x.endMode=$('shiftEndMode').value;x.end=$('shiftEnd').value;x.note=$('shiftNote').value.trim();x.plannedMinutes=h===''?plannedMinutes({...x,plannedMinutes:undefined}):Math.round(Number(h)*60);audit('Horaire planning corrigé',`${x.name} · ${fmtDate(f.date)} · ${displayRange(x)} · ${minutesLabel(x.plannedMinutes)} prévues`);scheduleSave();closeModal();renderAdminPlanning()};
    $('deleteShift').onclick=()=>{f.items.splice(f.items.indexOf(x),1);audit('Case planning supprimée',`${x.name} · ${fmtDate(f.date)}`);scheduleSave();closeModal();renderAdminPlanning()};
  };
  window.copyPreviousWeek=function(){
    const wk=weekKey(adminWeek),prev=new Date(adminWeek);prev.setDate(prev.getDate()-7);const pwk=weekKey(prev),src=state.drafts[pwk]||state.published[pwk];if(!src){toast('Aucun planning la semaine précédente');return}
    const dest={days:{},staffing:{},updatedAt:new Date().toISOString()};
    for(const [oldDate,items] of Object.entries(src.days||{})){const d=new Date(oldDate+'T12:00:00');d.setDate(d.getDate()+7);dest.days[dayKey(d)]=(items||[]).map(x=>({...clone(x),id:crypto.randomUUID()}))}
    for(const [oldDate,row] of Object.entries(src.staffing||{})){const d=new Date(oldDate+'T12:00:00');d.setDate(d.getDate()+7);dest.staffing[dayKey(d)]=clone(row)}
    state.drafts[wk]=dest;audit('Semaine copiée',weekLabelText(adminWeek));scheduleSave();renderAdminPlanning();toast('Semaine précédente copiée');
  };
  window.publishWeek=function(){
    const wk=weekKey(adminWeek),draft=draftFor(wk);state.published[wk]={days:clone(draft.days),staffing:clone(draft.staffing||{}),publishedAt:new Date().toISOString(),publishedBy:currentProfile()?.name||'Admin'};audit('Planning publié',weekLabelText(adminWeek));scheduleSave();renderAdminPlanning();renderPublicPlanning();toast('Planning publié pour l’équipe');
  };
  if($('copyWeekBtn'))$('copyWeekBtn').onclick=window.copyPreviousWeek;if($('publishBtn'))$('publishBtn').onclick=window.publishWeek;

  function addView(id,html){if($(id))return $(id);const section=document.createElement('section');section.className='view';section.id=id;section.innerHTML=html;document.querySelector('main.shell')?.appendChild(section);return section}
  function activateView(id,title){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));document.querySelectorAll('.navBtn,.menuItem').forEach(b=>b.classList.remove('active'));if($('topTitle'))$('topTitle').textContent=title;closeDrawer()}
  function teamMenuButton(id,label,onClick,badge=false){if($(id))return;const adminGroup=$('adminMenuGroup'),btn=document.createElement('button');btn.className='menuItem';btn.id=id;btn.innerHTML=`<span class="ico">●</span>${label}${badge?'<span class="v15MenuBadge" id="v15NotifBadge"></span>':''}`;btn.onclick=onClick;adminGroup?.parentNode?.insertBefore(btn,adminGroup)}
  function adminMenuButton(id,label,onClick){if($(id))return;const g=$('adminMenuGroup');if(!g)return;const btn=document.createElement('button');btn.className='menuItem locked';btn.id=id;btn.innerHTML=`<span class="ico">●</span>${label}`;btn.onclick=onClick;g.appendChild(btn)}

  addView('view-my-stats','<h1 class="pageTitle">Mes statistiques</h1><div class="pageSub">Comparaison entre objectif, planning publié et heures réellement pointées.</div><div class="weekControl"><button class="smallBtn" id="v15StatsPrev">‹</button><div class="weekLabel" id="v15StatsWeek"></div><button class="smallBtn" id="v15StatsNext">›</button></div><div class="v15Metrics" id="v15MyMetrics"></div><div class="card" id="v15MyStatsDetail"></div>');
  addView('view-team-stats','<h1 class="pageTitle">Statistiques équipe</h1><div class="pageSub">Objectifs hebdomadaires, heures prévues et heures réelles. Réservé à JB, Coco et Ingrid.</div><div class="card" id="v15TeamStats"><div class="empty">Chargement…</div></div>');
  let statsWeek=startOfWeek(new Date());
  async function renderMyStats(){
    try{await members(true);targetsCache=[];await targets(true);const s=statsFor(profileId,statsWeek);$('v15StatsWeek').textContent=weekLabelText(statsWeek);$('v15MyMetrics').innerHTML=statsMetrics(s);$('v15MyStatsDetail').innerHTML=`<div class="listRow"><div class="listMain"><b>Prévu ce mois</b><small>Somme des durées prévues dans les plannings publiés.</small></div><div class="listValue">${minutesLabel(s.monthPlanned)}</div></div><div class="listRow"><div class="listMain"><b>Réel ce mois</b><small>Somme des pointages réels.</small></div><div class="listValue">${minutesLabel(s.monthActual)}</div></div>`}
    catch(e){$('v15MyMetrics').innerHTML='';$('v15MyStatsDetail').innerHTML=`<div class="empty">${escapeHtml(e.message||'Statistiques indisponibles.')}</div>`}
  }
  $('v15StatsPrev').onclick=()=>{statsWeek.setDate(statsWeek.getDate()-7);renderMyStats()};$('v15StatsNext').onclick=()=>{statsWeek.setDate(statsWeek.getDate()+7);renderMyStats()};
  teamMenuButton('v15MyStatsMenu','Mes statistiques',()=>{activateView('view-my-stats','Mes statistiques');renderMyStats()});

  async function editTarget(m,current){
    openModal(`<div class="modal light"><div class="modalHead"><b>Objectif · ${escapeHtml(m.display_name)}</b><button class="closeBtn" data-close>✕</button></div><div class="pageSub">Nombre d’heures à réaliser par semaine.</div><label>Objectif hebdomadaire</label><input id="v15TargetHours" type="number" min="0" max="168" step="0.25" inputmode="decimal" value="${(current/60).toFixed(current%60?2:0)}"><div class="modalActions"><button class="smallBtn" data-close>Annuler</button><button class="smallBtn light" id="v15TargetSave">Enregistrer</button></div><div id="v15TargetMsg" class="sync"></div></div>`);
    $('v15TargetSave').onclick=async()=>{const h=Number($('v15TargetHours').value);if(!Number.isFinite(h)||h<0||h>168){$('v15TargetMsg').textContent='Objectif invalide.';return}const b=$('v15TargetSave');b.disabled=true;try{await rpc('team_set_hour_target',{target_user_id:m.user_id,weekly_target_minutes:Math.round(h*60)});targetsCache=[];closeModal();await renderTeamStats();toast('Objectif enregistré')}catch(e){$('v15TargetMsg').textContent='Enregistrement impossible.'}finally{b.disabled=false}};
  }
  function employeeStatsModal(username){const s=statsFor(username,new Date()),name=s.m?.display_name||TEAM.find(x=>x.id===username)?.name||username;openModal(`<div class="modal light"><div class="modalHead"><b>Statistiques · ${escapeHtml(name)}</b><button class="closeBtn" data-close>✕</button></div><div class="v15Metrics">${statsMetrics(s)}</div><div class="listRow"><div class="listMain"><b>Prévu ce mois</b></div><div class="listValue">${minutesLabel(s.monthPlanned)}</div></div><div class="listRow"><div class="listMain"><b>Réel ce mois</b></div><div class="listValue">${minutesLabel(s.monthActual)}</div></div></div>`)}
  async function renderTeamStats(){
    const box=$('v15TeamStats');box.innerHTML='<div class="empty">Chargement…</div>';
    try{if(typeof refreshAdminData==='function')await refreshAdminData();await members(true);targetsCache=[];await targets(true);const map=new Map(membersCache.map(m=>[m.username,m]));box.innerHTML=TEAM.map(p=>{const m=map.get(p.id);if(!m)return`<div class="listRow"><div class="listMain"><b>${escapeHtml(p.name)}</b><small>Compte non activé</small></div><span class="statePill">EN ATTENTE</span></div>`;const s=statsFor(p.id,new Date()),role=p.role==='creator_admin'?'CREATOR ADMIN':p.role==='admin'?'ADMIN':'ÉQUIPE';return`<div class="listRow"><div class="listMain"><b>${escapeHtml(p.name)}</b><small>${role} · objectif ${minutesLabel(s.target)} · prévu ${minutesLabel(s.planned)} · réel ${minutesLabel(s.actual)}</small><div class="v15StatsActions"><button class="smallBtn" data-v15-person-stats="${p.id}">STATISTIQUES</button><button class="smallBtn light" data-v15-target="${m.user_id}">OBJECTIF</button></div></div><div class="listValue">${minutesLabel(s.diff,true)}</div></div>`}).join('');box.querySelectorAll('[data-v15-person-stats]').forEach(b=>b.onclick=()=>employeeStatsModal(b.dataset.v15PersonStats));box.querySelectorAll('[data-v15-target]').forEach(b=>{const m=membersCache.find(x=>x.user_id===b.dataset.v15Target);b.onclick=()=>editTarget(m,targetForMember(m))})}
    catch(e){box.innerHTML=`<div class="empty">${escapeHtml(e.message||'Statistiques équipe indisponibles.')}</div>`}
  }
  adminMenuButton('v15TeamStatsMenu','Statistiques équipe',()=>requireAdmin(()=>{activateView('view-team-stats','Statistiques équipe');renderTeamStats()}));

  addView('view-messages','<h1 class="pageTitle">Messages</h1><div class="pageSub">Discussion équipe et messages privés. Chaque message est lié au compte réellement connecté.</div><div class="v15ChatTop"><label>Conversation</label><select id="v15ChatTarget"><option value="group">Équipe Australia Street</option></select></div><div class="v15ChatBox" id="v15ChatBox"><div class="empty">Chargement…</div></div><div class="v15Composer"><textarea id="v15MessageBody" maxlength="2000" placeholder="Écrire un message…"></textarea><button class="smallBtn light" id="v15SendMessage">ENVOYER</button></div><div id="v15ChatMsg" class="sync" style="margin-top:7px"></div>');
  let chatLoadedOnce=false;
  async function renderChatSelector(){await members();const sel=$('v15ChatTarget'),cur=sel.value||'group',me=userId();sel.innerHTML='<option value="group">Équipe Australia Street</option>'+membersCache.filter(m=>m.user_id!==me).map(m=>`<option value="${m.user_id}">Privé · ${escapeHtml(m.display_name)}</option>`).join('');if([...sel.options].some(o=>o.value===cur))sel.value=cur}
  async function markMessagesRead(rows){const me=userId(),incoming=rows.filter(m=>m.sender_user_id!==me).map(m=>({message_id:m.id,user_id:me,read_at:new Date().toISOString()}));if(!incoming.length)return;try{await api('team_message_reads?on_conflict=message_id,user_id',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',body:JSON.stringify(incoming)})}catch{}
  }
  async function loadMessages(){
    const box=$('v15ChatBox');if(!box)return;try{await renderChatSelector();const me=userId(),target=$('v15ChatTarget').value||'group';const [rows,reads]=await Promise.all([api('team_messages?select=id,sender_user_id,recipient_user_id,body,created_at&order=created_at.asc&limit=300'),api('team_message_reads?select=message_id,user_id,read_at')]);const visible=rows.filter(m=>target==='group'?m.recipient_user_id===null:((m.sender_user_id===me&&m.recipient_user_id===target)||(m.sender_user_id===target&&m.recipient_user_id===me)));box.innerHTML=visible.length?visible.map(m=>{const mine=m.sender_user_id===me,read=target!=='group'&&mine&&reads.some(r=>r.message_id===m.id&&r.user_id===target);return`<div class="v15Bubble ${mine?'mine':''}"><div class="v15BubbleHead">${escapeHtml(mine?'Moi':nameForUid(m.sender_user_id))}</div><div class="v15BubbleBody">${escapeHtml(m.body)}</div><div class="v15BubbleMeta">${new Date(m.created_at).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}${read?' · Lu':''}</div></div>`}).join(''):'<div class="empty">Aucun message dans cette conversation.</div>';await markMessagesRead(visible);if(!chatLoadedOnce||box.scrollHeight-box.scrollTop-box.clientHeight<180)box.scrollTop=box.scrollHeight;chatLoadedOnce=true;loadNotifications(false)}catch(e){box.innerHTML=`<div class="empty">${escapeHtml(e.message||'Messages indisponibles.')}</div>`}
  }
  async function sendMessage(){const body=$('v15MessageBody').value.trim(),target=$('v15ChatTarget').value||'group',msg=$('v15ChatMsg');if(!body)return;const b=$('v15SendMessage');b.disabled=true;msg.textContent='Envoi…';try{await api('team_messages',{method:'POST',body:JSON.stringify({sender_user_id:userId(),recipient_user_id:target==='group'?null:target,body})});$('v15MessageBody').value='';msg.textContent='';await loadMessages()}catch(e){msg.textContent='Message non envoyé.'}finally{b.disabled=false}}
  $('v15ChatTarget').onchange=()=>{chatLoadedOnce=false;loadMessages()};$('v15SendMessage').onclick=sendMessage;$('v15MessageBody').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}});
  teamMenuButton('v15MessagesMenu','Messages',()=>{activateView('view-messages','Messages');loadMessages()});

  addView('view-notifications','<h1 class="pageTitle">Notifications</h1><div class="pageSub">Planning, changements qui te concernent et nouveaux messages.</div><div class="toolbar"><button class="smallBtn light" id="v15EnableNotif">ACTIVER LES NOTIFICATIONS</button><button class="smallBtn" id="v15ReadAll">TOUT MARQUER LU</button></div><div class="card" id="v15NotifList" style="margin-top:12px"><div class="empty">Chargement…</div></div>');
  let notificationsCache=[];
  const markerKey=()=>`australia_team_notif_marker_v15:${userId()||'none'}`;
  async function systemNotify(n){if(!('Notification'in window)||Notification.permission!=='granted')return;try{const reg=await navigator.serviceWorker?.ready;if(reg)await reg.showNotification(n.title,{body:n.body||'',tag:`team-${n.id}`,data:{type:n.type,entity_id:n.entity_id},icon:'../icon-192.png'});else new Notification(n.title,{body:n.body||''})}catch{}}
  async function loadNotifications(showNative=true){
    if(!userId())return;try{const rows=await api('team_notifications?select=id,type,title,body,entity_id,created_at,read_at&order=created_at.desc&limit=120');notificationsCache=rows;const unread=rows.filter(n=>!n.read_at).length;if($('v15NotifBadge'))$('v15NotifBadge').textContent=unread?String(unread):'';const list=$('v15NotifList');if(list)list.innerHTML=rows.length?rows.map(n=>`<button class="v15NotifItem ${n.read_at?'':'v15NotifUnread'}" data-v15-notif="${n.id}"><div class="listRow"><div class="listMain"><b>${escapeHtml(n.title)}</b><small>${escapeHtml(n.body||'')} · ${new Date(n.created_at).toLocaleString('fr-FR')}</small></div></div></button>`).join(''):'<div class="empty">Aucune notification.</div>';
      const latest=rows[0]?.created_at||new Date().toISOString(),old=localStorage.getItem(markerKey());if(showNative&&old){const fresh=rows.filter(n=>!n.read_at&&new Date(n.created_at)>new Date(old)).reverse();for(const n of fresh)await systemNotify(n)}localStorage.setItem(markerKey(),latest);if(list)list.querySelectorAll('[data-v15-notif]').forEach(b=>b.onclick=()=>openNotification(b.dataset.v15Notif));
    }catch(e){console.warn('notifications',e)}
  }
  async function markNotification(id){try{await api(`team_notifications?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({read_at:new Date().toISOString()}),prefer:'return=minimal'})}catch{}}
  async function openNotification(id){const n=notificationsCache.find(x=>x.id===id);if(!n)return;await markNotification(id);await loadNotifications(false);if(n.type==='message'){activateView('view-messages','Messages');loadMessages()}else{showView('planning')}}
  $('v15EnableNotif').onclick=async()=>{if(!('Notification'in window)){toast('Notifications système non disponibles sur cet appareil');return}const p=await Notification.requestPermission();toast(p==='granted'?'Notifications activées':'Notifications non autorisées')};
  $('v15ReadAll').onclick=async()=>{try{await api(`team_notifications?user_id=eq.${encodeURIComponent(userId())}&read_at=is.null`,{method:'PATCH',body:JSON.stringify({read_at:new Date().toISOString()}),prefer:'return=minimal'});await loadNotifications(false)}catch{toast('Impossible de modifier les notifications')}};
  teamMenuButton('v15NotifMenu','Notifications',()=>{activateView('view-notifications','Notifications');loadNotifications(false)},true);

  window.renderAll=function(){base.renderAll?.();const p=currentProfile();if($('drawerRole')&&p)$('drawerRole').textContent=p.creator?'Creator Admin · contrôle total':p.admin?'Administrateur · accès PIN':'Membre de l’équipe';loadNotifications(false).catch(()=>{})};

  const accountObserver=new MutationObserver(()=>{const box=$('accountsList');if(!box)return;box.querySelectorAll('.listRow').forEach(row=>{const b=row.querySelector('.listMain b');if(b?.textContent.trim()==='JB'){const small=row.querySelector('.listMain small');if(small&&!/Creator/i.test(small.textContent))small.innerHTML=small.innerHTML.replace(/^Admin/i,'Creator Admin')}})});if($('accountsList'))accountObserver.observe($('accountsList'),{childList:true,subtree:true});

  setInterval(()=>{if(userId())loadNotifications(true);if($('#view-messages')?.classList.contains('active'))loadMessages()},12000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&userId())loadNotifications(true)});
})();