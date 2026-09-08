(()=>{
  const style=document.createElement('style');
  style.textContent=`
    #view-hours .personalCalendar{position:relative;z-index:3;pointer-events:auto!important}
    #view-hours .personalCalendarGrid{position:relative;z-index:4;pointer-events:auto!important}
    #view-hours .personalCalendarDay:not(:disabled){pointer-events:auto!important;touch-action:manipulation;cursor:pointer;-webkit-tap-highlight-color:rgba(24,21,18,.08)}
    #view-hours .personalCalendarDay:not(:disabled):active{transform:scale(.98)}
    .selfDayList{display:grid;gap:9px;margin:12px 0}
    .selfDayEntry{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:12px;border:1px solid #ded2c3;border-radius:14px;background:#fffaf2}
    .selfDayEntry b{display:block;font-size:14px}.selfDayEntry small{display:block;margin-top:4px;color:#776b5f;font-size:11px;line-height:1.35}
    .selfEditMessage{margin:10px 0;padding:10px 12px;border-radius:12px;background:#eee5d8;color:#4e453d;font-size:12px;line-height:1.35}
    .selfEditMessage:empty{display:none}
  `;
  document.head.appendChild(style);

  function dateKeyParis(value){
    const parts=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
    const o={};parts.forEach(p=>{if(p.type!=='literal')o[p.type]=p.value});return`${o.year}-${o.month}-${o.day}`;
  }
  function timeParis(value){
    if(!value)return'';
    return new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
  }
  function todayParis(){return dateKeyParis(new Date())}
  function rowsFor(ds){return(state?.sessions||[]).filter(s=>s.employeeId===profileId&&dateKeyParis(s.start)===ds).sort((a,b)=>String(a.start).localeCompare(String(b.start)))}
  function label(ds){return new Date(`${ds}T12:00:00`).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
  function escape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  async function rpc(name,body={}){
    const s=await ensureSession();
    if(!s)throw new Error('Session expirée. Reconnecte-toi.');
    const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const text=await r.text();
    if(!r.ok)throw new Error(text||`Erreur ${r.status}`);
    return text?JSON.parse(text):null;
  }
  function errorText(error){
    const raw=String(error?.message||error||'');
    const map=[
      ['pointage_overlap','Ces horaires chevauchent déjà un autre pointage.'],
      ['future_date_forbidden','Impossible d’enregistrer une date future.'],
      ['future_time_forbidden','L’heure d’arrivée ne peut pas être dans le futur.'],
      ['shift_too_long','La journée dépasse 20 heures. Vérifie les horaires.'],
      ['pause_outside_shift','La pause doit être comprise entre l’arrivée et le départ.'],
      ['pause_pair_required','Renseigne le début et la fin de la pause.'],
      ['departure_required_for_pause','Ajoute d’abord une heure de départ avant de renseigner une pause.'],
      ['pointage_not_found','Ce pointage n’existe plus. Recharge l’application.'],
      ['not_authorized','Ton compte n’est pas autorisé à faire cette correction.']
    ];
    return map.find(([k])=>raw.includes(k))?.[1]||'Enregistrement impossible. Vérifie les horaires et réessaie.';
  }

  function openDay(ds){
    if(!ds||ds>todayParis())return;
    const rows=rowsFor(ds);
    if(!rows.length){openEditor(ds,null);return}
    openModal(`<div class="modal light"><div class="modalHead"><b>${escape(label(ds))}</b><button class="closeBtn" data-close>✕</button></div><div class="pageSub">Tes heures enregistrées pour cette journée.</div><div class="selfDayList">${rows.map(s=>`<div class="selfDayEntry"><div><b>${timeParis(s.start)} → ${s.stop?timeParis(s.stop):(s.manualIncomplete?'départ à compléter':'en cours')}</b><small>${s.note?escape(s.note):s.manualIncomplete?'Arrivée enregistrée, départ à compléter':'Pointage enregistré'}</small></div><button type="button" class="smallBtn light" data-v19-edit="${escape(s.id)}">Modifier</button></div>`).join('')}</div><div class="modalActions"><button class="smallBtn" data-close>Fermer</button><button type="button" class="smallBtn light" id="v19Add">+ Pointage oublié</button></div></div>`);
    document.querySelectorAll('[data-v19-edit]').forEach(b=>b.onclick=()=>{const s=state.sessions.find(x=>x.id===b.dataset.v19Edit);if(s)openEditor(ds,s)});
    const add=$('v19Add');if(add)add.onclick=()=>openEditor(ds,null);
  }

  function openEditor(ds,s){
    const editing=!!s;
    const pauses=Array.isArray(s?.pauses)?s.pauses:[];
    const one=pauses.length===1&&pauses[0]?.start&&pauses[0]?.end?pauses[0]:null;
    openModal(`<div class="modal light"><div class="modalHead"><b>${editing?'Corriger ma journée':'Ajouter un pointage oublié'}</b><button class="closeBtn" data-close>✕</button></div><div class="personalEditNotice">Tu peux enregistrer ton arrivée seule et compléter le départ plus tard.</div><div class="formGrid"><div class="full"><label>Date</label><input id="v19Date" type="date" value="${escape(ds)}" max="${todayParis()}"></div><div><label>Arrivée</label><input id="v19Start" type="time" value="${editing?timeParis(s.start):''}"></div><div><label>Départ · facultatif</label><input id="v19End" type="time" value="${editing&&s.stop?timeParis(s.stop):''}"></div><div><label>Début pause</label><input id="v19PauseStart" type="time" value="${one?timeParis(one.start):''}"></div><div><label>Fin pause</label><input id="v19PauseEnd" type="time" value="${one?timeParis(one.end):''}"></div><div class="full"><label>Note</label><input id="v19Note" maxlength="500" value="${escape(s?.note||'')}" placeholder="Ex. oubli de départ, heure corrigée…"></div></div><div id="v19Msg" class="selfEditMessage"></div><div class="modalActions"><button class="smallBtn" data-close>Annuler</button><button type="button" class="smallBtn light" id="v19Save">Enregistrer</button></div></div>`);
    const save=$('v19Save');
    save.onclick=async()=>{
      const date=$('v19Date').value,st=$('v19Start').value,en=$('v19End').value,pstart=$('v19PauseStart').value,pend=$('v19PauseEnd').value,note=$('v19Note').value.trim(),msg=$('v19Msg');
      if(!date){msg.textContent='Choisis la date.';return}
      if(!st){msg.textContent='Renseigne ton heure d’arrivée.';return}
      if((pstart&&!pend)||(!pstart&&pend)){msg.textContent='Pour une pause, renseigne le début et la fin.';return}
      if(!en&&(pstart||pend)){msg.textContent='Ajoute ton heure de départ avant de renseigner une pause.';return}
      save.disabled=true;msg.textContent=en?'Enregistrement…':'Enregistrement de l’arrivée…';
      try{
        if(editing){
          const hasPauses=pauses.length>0;
          const pauseMode=!en?'clear':(pstart&&pend?'replace':(hasPauses?'preserve':'clear'));
          await rpc('team_self_update_pointage',{pointage_id:s.id,work_date:date,start_time:st,end_time:en||null,pause_mode:pauseMode,pause_start:pstart||null,pause_end:pend||null,note});
        }else{
          await rpc('team_self_add_pointage',{work_date:date,start_time:st,end_time:en||null,pause_start:pstart||null,pause_end:pend||null,note});
        }
        closeModal();
        if(typeof window.loadCloud==='function')await window.loadCloud();
        if(typeof window.renderHours==='function')window.renderHours();
        toast(en?'Journée enregistrée':'Arrivée enregistrée · départ à compléter');
      }catch(error){console.error(error);msg.textContent=errorText(error)}finally{save.disabled=false}
    };
  }

  window.openPersonalCalendarDay=openDay;

  document.addEventListener('click',e=>{
    const day=e.target.closest?.('#view-hours .personalCalendarDay[data-personal-day]');
    if(!day||day.disabled||day.classList.contains('future'))return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    openDay(day.dataset.personalDay);
  },true);

  document.addEventListener('touchend',e=>{
    const day=e.target.closest?.('#view-hours .personalCalendarDay[data-personal-day]');
    if(!day||day.disabled||day.classList.contains('future'))return;
    e.preventDefault();
    e.stopPropagation();
    openDay(day.dataset.personalDay);
  },{capture:true,passive:false});
})();
