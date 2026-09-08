(()=>{
  let calendarMonth=new Date();
  calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),1,12,0,0,0);
  let incompleteIds=new Set();
  let lastTouchAt=0;

  const baseRenderHours=window.renderHours;
  const baseRenderAll=window.renderAll;

  const style=document.createElement('style');
  style.textContent=`
    .personalCalendar{position:relative;z-index:3;margin:14px 0 16px;background:#fffaf2;border:1px solid #ded2c3;border-radius:18px;padding:12px;box-shadow:0 5px 14px rgba(53,42,29,.05);pointer-events:auto!important}
    .personalCalendarHead{display:grid;grid-template-columns:42px 1fr 42px;align-items:center;gap:8px;margin-bottom:10px}
    .personalCalendarHead button{width:42px;height:38px;border-radius:12px;border:1px solid #d9ccbb;background:#f4ecdf;color:#181512;font-size:22px;font-weight:900}
    .personalCalendarTitle{text-align:center;font-weight:950;font-size:16px;text-transform:capitalize;color:#181512}
    .personalCalendarWeek{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;margin-bottom:5px}
    .personalCalendarWeek span{text-align:center;font-size:9px;font-weight:950;letter-spacing:.08em;color:#877a6c;padding:3px 0}
    .personalCalendarGrid{position:relative;z-index:4;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;pointer-events:auto!important}
    .personalCalendarDay{position:relative;min-height:66px;border:1px solid #e1d6c8;border-radius:12px;background:#fffdf8;color:#181512;padding:7px 5px;text-align:left;overflow:hidden;touch-action:manipulation;pointer-events:auto!important;-webkit-tap-highlight-color:rgba(24,21,18,.08)}
    .personalCalendarDay.blank{visibility:hidden}
    .personalCalendarDay.future{opacity:.38;pointer-events:none!important}
    .personalCalendarDay.today{outline:2px solid #181512;outline-offset:1px}
    .personalCalendarDay.hasWork{background:#eee5d8;border-color:#cdbda9}
    .personalCalendarDay.needsDeparture{background:#f3e4cf;border-color:#b99e79}
    .personalCalendarDay b{display:block;font-size:13px;line-height:1}
    .personalCalendarDay small{display:block;margin-top:8px;font-size:9px;font-weight:900;line-height:1.2;color:#6f6458}
    .personalCalendarDay.needsDeparture small{color:#6f512f;font-weight:950}
    .personalCalendarDay .dot{position:absolute;right:7px;top:7px;width:6px;height:6px;border-radius:50%;background:#181512}
    .personalCalendarHint{font-size:11px;line-height:1.4;color:#73685c;margin-top:10px}
    .personalDayRows{display:grid;gap:8px;margin:12px 0}
    .personalDayRow{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:11px;border-radius:14px;border:1px solid #ded2c3;background:#fffaf2}
    .personalDayRow b{display:block;font-size:13px}.personalDayRow small{display:block;margin-top:4px;color:#776b5f;font-size:11px;line-height:1.35}
    .personalEditNotice{margin:10px 0;padding:10px 11px;border-radius:12px;background:#eee5d8;color:#65594d;font-size:11px;line-height:1.4}
    .personalPauseTools{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
    .selfSaveMsg{display:block;margin:10px 0 4px;padding:10px 12px;border-radius:12px;background:#eee5d8;color:#4e453d;font-size:12px;line-height:1.35;text-align:left!important;min-height:0}
    .selfSaveMsg:empty{display:none}
    @media(max-width:430px){.personalCalendar{padding:10px}.personalCalendarGrid,.personalCalendarWeek{gap:4px}.personalCalendarDay{min-height:60px;padding:6px 4px;border-radius:10px}.personalCalendarDay small{font-size:8px;margin-top:7px}}
  `;
  document.head.appendChild(style);

  async function rpc(name,body={}){
    const s=await ensureSession();
    if(!s)throw new Error('Session expirée. Reconnecte-toi.');
    const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const text=await r.text();
    if(!r.ok)throw new Error(text||`Erreur ${r.status}`);
    return text?JSON.parse(text):null;
  }

  async function refreshIncompleteIds(){
    try{
      const s=await ensureSession(),uid=userId();
      if(!s||!uid){incompleteIds=new Set();return}
      const r=await fetch(`${SUPABASE_URL}/rest/v1/team_pointages?select=id&user_id=eq.${encodeURIComponent(uid)}&manual_incomplete=eq.true`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`}});
      if(!r.ok)return;
      const rows=await r.json();
      incompleteIds=new Set(rows.map(x=>x.id));
    }catch(e){console.warn('manual incomplete flags',e)}
  }

  function franceParts(value){
    const d=value instanceof Date?value:new Date(value);
    const parts=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);
    const out={};parts.forEach(p=>{if(p.type!=='literal')out[p.type]=p.value});return out;
  }
  function franceDateKey(value){const p=franceParts(value);return`${p.year}-${p.month}-${p.day}`}
  function franceTime(value){if(!value)return'';const p=franceParts(value);return`${p.hour}:${p.minute}`}
  function todayFrance(){return franceDateKey(new Date())}
  function rowsForDate(ds){return(state?.sessions||[]).filter(s=>s.employeeId===profileId&&franceDateKey(s.start)===ds).sort((a,b)=>String(a.start).localeCompare(String(b.start)))}
  function monthRows(){const y=calendarMonth.getFullYear(),m=calendarMonth.getMonth();return(state?.sessions||[]).filter(s=>{if(s.employeeId!==profileId)return false;const p=franceParts(s.start);return Number(p.year)===y&&Number(p.month)===m+1}).sort((a,b)=>String(a.start).localeCompare(String(b.start)))}
  function totalRows(rows){return rows.reduce((sum,s)=>sum+totalSessionMs(s,false),0)}
  function pauseSummary(s){
    const pauses=Array.isArray(s.pauses)?s.pauses:[];
    if(!pauses.length)return'Aucune pause';
    const done=pauses.filter(p=>p?.start&&p?.end);
    if(done.length===1)return`Pause ${franceTime(done[0].start)} à ${franceTime(done[0].end)}`;
    return`${pauses.length} pauses enregistrées`;
  }
  function isIncomplete(s){return!!s&&!s.stop&&incompleteIds.has(s.id)}

  function ensureMount(){
    const view=$('view-hours');if(!view)return null;
    let mount=$('personalCalendarMount');
    if(!mount){mount=document.createElement('div');mount.id='personalCalendarMount';const metrics=$('hoursMetrics');view.insertBefore(mount,metrics||view.children[2]||null)}
    return mount;
  }

  function renderMonthSummary(){
    const rows=monthRows(),total=totalRows(rows),days=new Set(rows.filter(s=>s.stop).map(s=>franceDateKey(s.start))).size;
    const metrics=$('hoursMetrics');if(metrics)metrics.innerHTML=`<div class="metric"><b>${fmtMs(total)}</b><span>CE MOIS</span></div><div class="metric"><b>${days}</b><span>JOURS POINTÉS</span></div>`;
    const list=$('hoursList');if(list)list.innerHTML=rows.length?rows.slice().reverse().map(s=>sessionRow(s,false)).join(''):'<div class="empty">Aucune heure pour ce mois.</div>';
    const head=$('view-hours')?.querySelector('.sectionHead h2');if(head)head.textContent=`Détail · ${calendarMonth.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}`;
  }

  function bindDay(button,ds){
    const open=()=>{if(ds<=todayFrance())openDay(ds)};
    button.onclick=e=>{if(Date.now()-lastTouchAt<700)return;e.preventDefault();open()};
    button.ontouchend=e=>{lastTouchAt=Date.now();e.preventDefault();open()};
  }

  function renderCalendar(){
    const mount=ensureMount();if(!mount)return;
    if($('topTitle')&&$('view-hours')?.classList.contains('active'))$('topTitle').textContent='Mon calendrier';
    const y=calendarMonth.getFullYear(),m=calendarMonth.getMonth();
    const first=new Date(y,m,1,12),daysInMonth=new Date(y,m+1,0,12).getDate(),offset=(first.getDay()+6)%7;
    const today=todayFrance();
    const totals=new Map(),incompleteDays=new Set();
    for(const s of monthRows()){
      const ds=franceDateKey(s.start),x=totals.get(ds)||{ms:0,count:0};x.ms+=totalSessionMs(s,false);x.count++;totals.set(ds,x);
      if(isIncomplete(s))incompleteDays.add(ds);
    }
    const cells=[];
    for(let i=0;i<offset;i++)cells.push('<div class="personalCalendarDay blank"></div>');
    for(let day=1;day<=daysInMonth;day++){
      const ds=`${y}-${pad(m+1)}-${pad(day)}`,x=totals.get(ds),future=ds>today,incomplete=incompleteDays.has(ds);
      const detail=incomplete?'Départ à compléter':x?`${fmtMs(x.ms)}${x.count>1?` · ${x.count} plages`:''}`:'—';
      cells.push(`<button type="button" class="personalCalendarDay ${x?'hasWork':''} ${incomplete?'needsDeparture':''} ${ds===today?'today':''} ${future?'future':''}" data-personal-day="${ds}" ${future?'disabled':''}><b>${day}</b>${x?'<span class="dot"></span>':''}<small>${detail}</small></button>`);
    }
    mount.innerHTML=`<div class="personalCalendar"><div class="personalCalendarHead"><button type="button" id="personalCalPrev">‹</button><div class="personalCalendarTitle">${calendarMonth.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</div><button type="button" id="personalCalNext">›</button></div><div class="personalCalendarWeek"><span>LUN</span><span>MAR</span><span>MER</span><span>JEU</span><span>VEN</span><span>SAM</span><span>DIM</span></div><div class="personalCalendarGrid">${cells.join('')}</div><div class="personalCalendarHint">Appuie sur une journée pour corriger tes horaires ou ajouter un pointage oublié. Tu peux enregistrer l’arrivée seule et compléter le départ plus tard.</div></div>`;
    $('personalCalPrev').onclick=()=>{calendarMonth=new Date(y,m-1,1,12);renderCalendar();renderMonthSummary()};
    $('personalCalNext').onclick=()=>{calendarMonth=new Date(y,m+1,1,12);renderCalendar();renderMonthSummary()};
    mount.querySelectorAll('[data-personal-day]').forEach(b=>{if(!b.disabled)bindDay(b,b.dataset.personalDay)});
    renderMonthSummary();
  }

  function dayLabel(ds){return new Date(`${ds}T12:00:00`).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
  function openDay(ds){
    if(!ds||ds>todayFrance())return;
    const rows=rowsForDate(ds);
    if(!rows.length){openEditor(ds,null);return}
    openModal(`<div class="modal light"><div class="modalHead"><b>${escapeHtml(dayLabel(ds))}</b><button class="closeBtn" data-close>✕</button></div><div class="pageSub">Tes heures réelles pour cette journée.</div><div class="personalDayRows">${rows.map(s=>`<div class="personalDayRow"><div><b>${franceTime(s.start)} ${s.stop?`→ ${franceTime(s.stop)}`:isIncomplete(s)?'→ départ à compléter':'→ en cours'}</b><small>${s.stop?`${fmtMs(totalSessionMs(s,false))} · ${escapeHtml(pauseSummary(s))}`:isIncomplete(s)?'Arrivée enregistrée · départ à compléter':'Pointage en cours'}${s.note?` · ${escapeHtml(s.note)}`:''}</small></div><button type="button" class="smallBtn light" data-self-edit="${s.id}">Modifier</button></div>`).join('')}</div><div class="modalActions"><button class="smallBtn" data-close>Fermer</button><button type="button" class="smallBtn light" id="selfAddRange">+ Pointage oublié</button></div></div>`);
    document.querySelectorAll('[data-self-edit]').forEach(b=>b.onclick=()=>openEditor(ds,state.sessions.find(s=>s.id===b.dataset.selfEdit)||null));
    $('selfAddRange').onclick=()=>openEditor(ds,null);
  }

  function mapError(error){
    const raw=String(error?.message||error||'');
    const map=[
      ['pointage_overlap','Ces horaires chevauchent déjà un autre pointage.'],
      ['future_date_forbidden','Impossible de modifier une date future.'],
      ['future_time_forbidden','L’heure d’arrivée ne peut pas être dans le futur.'],
      ['shift_too_long','La journée dépasse 20 heures. Vérifie les horaires.'],
      ['pause_outside_shift','La pause doit être comprise entre l’arrivée et le départ.'],
      ['pause_pair_required','Renseigne le début et la fin de la pause.'],
      ['departure_required_for_pause','Ajoute d’abord une heure de départ avant de renseigner une pause.'],
      ['pointage_not_found','Ce pointage n’existe plus. Recharge l’application.'],
      ['not_authorized','Ton compte n’est pas autorisé à faire cette correction.']
    ];
    return map.find(([k])=>raw.includes(k))?.[1]||'Correction impossible. Vérifie les horaires et réessaie.';
  }

  function openEditor(ds,s){
    const editing=!!s,start=s?franceTime(s.start):'',end=s?.stop?franceTime(s.stop):'',pauses=Array.isArray(s?.pauses)?s.pauses:[],one=pauses.length===1&&pauses[0]?.start&&pauses[0]?.end?pauses[0]:null;
    openModal(`<div class="modal light"><div class="modalHead"><b>${editing?'Corriger ma journée':'Ajouter un pointage oublié'}</b><button class="closeBtn" data-close>✕</button></div><div class="personalEditNotice">L’arrivée est obligatoire. Le départ est facultatif et peut être ajouté plus tard.</div><div class="formGrid"><div class="full"><label>Date</label><input id="selfDate" type="date" value="${ds}" max="${todayFrance()}"></div><div><label>Arrivée</label><input id="selfStart" type="time" value="${start}"></div><div><label>Départ · facultatif</label><input id="selfEnd" type="time" value="${end}"></div><div><label>Début pause</label><input id="selfPauseStart" type="time" value="${editing&&one?franceTime(one.start):''}"></div><div><label>Fin pause</label><input id="selfPauseEnd" type="time" value="${editing&&one?franceTime(one.end):''}"></div><div class="full"><label>Note</label><input id="selfNote" maxlength="500" value="${escapeAttr(s?.note||'')}" placeholder="Ex. oubli de départ, heure corrigée…"></div></div>${editing&&pauses.length>1?`<div class="personalEditNotice">${pauses.length} pauses sont enregistrées. Elles seront conservées si tu ne modifies pas les champs de pause.</div>`:''}<div class="personalPauseTools">${editing&&pauses.length?'<button class="smallBtn" id="selfClearPause" type="button">Effacer les pauses</button>':''}</div><div id="selfMsg" class="selfSaveMsg"></div><div class="modalActions"><button class="smallBtn" data-close>Annuler</button><button type="button" class="smallBtn light" id="selfSave">Enregistrer</button></div></div>`);

    let pauseMode=editing?'preserve':'clear';
    const ps=$('selfPauseStart'),pe=$('selfPauseEnd');
    if(editing){const changed=()=>{pauseMode=(ps.value||pe.value)?'replace':(pauses.length?'preserve':'clear')};ps.addEventListener('input',changed);pe.addEventListener('input',changed)}
    if($('selfClearPause'))$('selfClearPause').onclick=()=>{ps.value='';pe.value='';pauseMode='clear';toast('Pauses retirées de la correction')};

    $('selfSave').onclick=async()=>{
      const date=$('selfDate').value,st=$('selfStart').value,en=$('selfEnd').value,pstart=ps.value,pend=pe.value,note=$('selfNote').value.trim(),msg=$('selfMsg'),btn=$('selfSave');
      if(!date){msg.textContent='Choisis la date.';return}
      if(!st){msg.textContent='Renseigne ton heure d’arrivée.';return}
      if((pstart&&!pend)||(!pstart&&pend)){msg.textContent='Renseigne le début et la fin de la pause.';return}
      if(!en&&(pstart||pend)){msg.textContent='Ajoute ton heure de départ avant de renseigner une pause.';return}
      if(!editing)pauseMode=(pstart&&pend)?'replace':'clear';
      if(editing&&!en)pauseMode='clear';
      btn.disabled=true;msg.textContent=en?'Enregistrement…':'Enregistrement de l’arrivée…';
      try{
        if(editing){
          await rpc('team_self_update_pointage',{pointage_id:s.id,work_date:date,start_time:st,end_time:en||null,pause_mode:pauseMode,pause_start:pstart||null,pause_end:pend||null,note});
        }else{
          await rpc('team_self_add_pointage',{work_date:date,start_time:st,end_time:en||null,pause_start:pstart||null,pause_end:pend||null,note});
        }
        closeModal();
        if(typeof window.loadCloud==='function')await window.loadCloud();
        await refreshIncompleteIds();
        calendarMonth=new Date(Number(date.slice(0,4)),Number(date.slice(5,7))-1,1,12);
        renderCalendar();
        toast(en?(editing?'Journée corrigée':'Pointage ajouté'):'Arrivée enregistrée · départ à compléter');
      }catch(e){console.error(e);msg.textContent=mapError(e)}finally{btn.disabled=false}
    };
  }

  window.openPersonalCalendarDay=openDay;
  window.renderHours=function(){baseRenderHours?.();refreshIncompleteIds().finally(renderCalendar)};
  window.renderAll=function(){baseRenderAll?.();if($('view-hours')?.classList.contains('active'))refreshIncompleteIds().finally(renderCalendar)};

  const hourMenu=document.querySelector('.menuItem[data-view="hours"]');if(hourMenu)hourMenu.innerHTML='<span class="ico">▦</span>Mon calendrier';
  const bottom=document.querySelector('.navBtn[data-view="hours"]');if(bottom)bottom.innerHTML='<span>▦</span>Calendrier';
  const title=$('view-hours')?.querySelector('.pageTitle');if(title)title.textContent='Mon calendrier';
  const sub=$('view-hours')?.querySelector('.pageSub');if(sub)sub.textContent='Tes heures réellement pointées. Appuie sur une journée pour corriger une erreur ou ajouter un oubli.';
  const pointSub=$('view-point')?.querySelector('.pageSub');if(pointSub)pointSub.textContent='Les heures enregistrées sont les heures réelles. Tu peux corriger tes propres journées depuis Mon calendrier.';

  refreshIncompleteIds();
})();