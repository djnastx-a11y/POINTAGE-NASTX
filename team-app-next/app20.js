(()=>{
  let touchAt=0,bindTimer=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const parisParts=value=>{const p=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)),o={};p.forEach(x=>{if(x.type!=='literal')o[x.type]=x.value});return o};
  const dateKey=value=>{const p=parisParts(value);return`${p.year}-${p.month}-${p.day}`};
  const timeKey=value=>{const p=parisParts(value);return`${p.hour}:${p.minute}`};
  const today=()=>dateKey(new Date());
  const label=ds=>new Date(`${ds}T12:00:00`).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  async function rpc(name,body={}){
    const s=await ensureSession();
    if(!s)throw new Error('session_expired');
    const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const text=await r.text();
    if(!r.ok)throw new Error(text||`Erreur ${r.status}`);
    return text?JSON.parse(text):null;
  }
  async function dayRows(ds){
    const rows=await rpc('team_self_pointages_range',{from_date:ds,to_date:ds});
    return(Array.isArray(rows)?rows:[]).sort((a,b)=>String(a.started_at).localeCompare(String(b.started_at)));
  }
  function errText(error){
    const raw=String(error?.message||error||'');
    const map=[
      ['pointage_overlap','Un pointage existe déjà sur cette plage. Ouvre le pointage déjà présent ce jour et modifie-le.'],
      ['future_date_forbidden','Impossible d’enregistrer une date future.'],
      ['future_time_forbidden','L’heure d’arrivée ne peut pas être dans le futur.'],
      ['shift_too_long','La journée dépasse 20 heures. Vérifie les horaires.'],
      ['pause_outside_shift','La pause doit être comprise entre l’arrivée et le départ.'],
      ['pause_pair_required','Renseigne le début et la fin de la pause.'],
      ['departure_required_for_pause','Ajoute d’abord une heure de départ avant de renseigner une pause.'],
      ['pointage_not_found','Ce pointage n’existe plus. Recharge l’application.'],
      ['date_start_required','La date et l’arrivée sont obligatoires.'],
      ['not_authorized','Ton compte n’est pas autorisé à faire cette correction.'],
      ['session_expired','Ta session a expiré. Reconnecte-toi.']
    ];
    return map.find(([k])=>raw.includes(k))?.[1]||'Enregistrement impossible. Réessaie ou recharge l’application.';
  }
  function rowStop(r){return r.manual_incomplete?null:(r.ended_at||null)}
  function pauseSummary(r){const p=Array.isArray(r.pauses)?r.pauses:[];if(!p.length)return'Aucune pause';if(p.length===1&&p[0]?.start&&p[0]?.end)return`Pause ${timeKey(p[0].start)} à ${timeKey(p[0].end)}`;return`${p.length} pauses enregistrées`}

  async function openDay(ds){
    if(!ds||ds>today())return;
    openModal(`<div class="modal light"><div class="modalHead"><b>${esc(label(ds))}</b><button class="closeBtn" data-close>✕</button></div><div class="pageSub">Chargement de tes heures…</div></div>`);
    try{
      const rows=await dayRows(ds);
      if(!rows.length){openEditor(ds,null);return}
      openModal(`<div class="modal light"><div class="modalHead"><b>${esc(label(ds))}</b><button class="closeBtn" data-close>✕</button></div><div class="pageSub">Tes heures enregistrées pour cette journée.</div><div class="selfDayList">${rows.map(r=>{const stop=rowStop(r);return`<div class="selfDayEntry"><div><b>${timeKey(r.started_at)} → ${stop?timeKey(stop):r.manual_incomplete?'départ à compléter':'en cours'}</b><small>${r.manual_incomplete?'Arrivée enregistrée · départ à compléter':stop?pauseSummary(r):'Pointage en cours'}${r.note?` · ${esc(r.note)}`:''}</small></div><button type="button" class="smallBtn light" data-v20-edit="${esc(r.id)}">Modifier</button></div>`}).join('')}</div><div class="modalActions"><button class="smallBtn" data-close>Fermer</button><button type="button" class="smallBtn light" id="v20Add">+ Pointage oublié</button></div></div>`);
      document.querySelectorAll('[data-v20-edit]').forEach(b=>b.onclick=()=>{const r=rows.find(x=>x.id===b.dataset.v20Edit);if(r)openEditor(ds,r)});
      const add=$('v20Add');if(add)add.onclick=()=>openEditor(ds,null);
    }catch(e){openModal(`<div class="modal light"><div class="modalHead"><b>${esc(label(ds))}</b><button class="closeBtn" data-close>✕</button></div><div class="selfEditMessage">${esc(errText(e))}</div><div class="modalActions"><button class="smallBtn" data-close>Fermer</button></div></div>`)}
  }

  function openEditor(ds,row){
    const editing=!!row,stop=editing?rowStop(row):null,pauses=Array.isArray(row?.pauses)?row.pauses:[],one=pauses.length===1&&pauses[0]?.start&&pauses[0]?.end?pauses[0]:null;
    openModal(`<div class="modal light"><div class="modalHead"><b>${editing?'Corriger ma journée':'Ajouter un pointage oublié'}</b><button class="closeBtn" data-close>✕</button></div><div class="personalEditNotice">L’arrivée est obligatoire. Le départ est facultatif et peut être ajouté plus tard.</div><div class="formGrid"><div class="full"><label>Date</label><input id="v20Date" type="date" value="${esc(ds)}" max="${today()}"></div><div><label>Arrivée</label><input id="v20Start" type="time" value="${editing?timeKey(row.started_at):''}"></div><div><label>Départ · facultatif</label><input id="v20End" type="time" value="${stop?timeKey(stop):''}"></div><div><label>Début pause</label><input id="v20PauseStart" type="time" value="${one?timeKey(one.start):''}"></div><div><label>Fin pause</label><input id="v20PauseEnd" type="time" value="${one?timeKey(one.end):''}"></div><div class="full"><label>Note · facultative</label><input id="v20Note" maxlength="500" value="${esc(row?.note||'')}" placeholder="Ex. oubli de départ, heure corrigée…"></div></div><div id="v20Msg" class="selfEditMessage"></div><div class="modalActions"><button class="smallBtn" data-close>Annuler</button><button type="button" class="smallBtn light" id="v20Save">Enregistrer</button></div></div>`);
    const save=$('v20Save');
    save.onclick=async()=>{
      const date=$('v20Date').value,st=$('v20Start').value,en=$('v20End').value,pstart=$('v20PauseStart').value,pend=$('v20PauseEnd').value,note=$('v20Note').value.trim(),msg=$('v20Msg');
      if(!date){msg.textContent='Choisis la date.';return}
      if(!st){msg.textContent='Renseigne ton heure d’arrivée.';return}
      if((pstart&&!pend)||(!pstart&&pend)){msg.textContent='Pour une pause, renseigne le début et la fin.';return}
      if(!en&&(pstart||pend)){msg.textContent='Ajoute ton heure de départ avant de renseigner une pause.';return}
      save.disabled=true;msg.textContent=en?'Enregistrement…':'Enregistrement de l’arrivée…';
      try{
        let target=row,autoCorrect=false;
        if(!target){
          const existing=await dayRows(date);
          target=existing.find(r=>timeKey(r.started_at)===st)||null;
          autoCorrect=!!target;
        }
        if(target){
          const currentPauses=Array.isArray(target.pauses)?target.pauses:[];
          const pauseMode=!en?'clear':(pstart&&pend?'replace':(currentPauses.length?'preserve':'clear'));
          await rpc('team_self_update_pointage',{pointage_id:target.id,work_date:date,start_time:st,end_time:en||null,pause_mode:pauseMode,pause_start:pstart||null,pause_end:pend||null,note});
        }else{
          await rpc('team_self_add_pointage',{work_date:date,start_time:st,end_time:en||null,pause_start:pstart||null,pause_end:pend||null,note});
        }
        closeModal();
        if(typeof window.loadCloud==='function')await window.loadCloud();
        if(typeof window.renderHours==='function')window.renderHours();
        toast(en?(autoCorrect||editing?'Journée corrigée':'Pointage ajouté'):'Arrivée enregistrée · départ à compléter');
      }catch(e){console.error(e);msg.textContent=errText(e)}finally{save.disabled=false}
    };
  }

  async function paintIncomplete(){
    const buttons=[...document.querySelectorAll('#view-hours .personalCalendarDay[data-personal-day]')];
    if(!buttons.length)return;
    const dates=buttons.map(b=>b.dataset.personalDay).filter(Boolean).sort();
    if(!dates.length)return;
    try{
      const rows=await rpc('team_self_pointages_range',{from_date:dates[0],to_date:dates[dates.length-1]});
      const incomplete=new Set((Array.isArray(rows)?rows:[]).filter(r=>r.manual_incomplete).map(r=>dateKey(r.started_at)));
      buttons.forEach(b=>{if(!incomplete.has(b.dataset.personalDay))return;b.classList.add('needsDeparture','hasWork');const s=b.querySelector('small');if(s)s.textContent='Départ à compléter'});
    }catch{}
  }
  function bindButtons(){
    document.querySelectorAll('#view-hours .personalCalendarDay[data-personal-day]').forEach(b=>{
      if(b.disabled||b.classList.contains('future'))return;
      b.onclick=e=>{if(Date.now()-touchAt<650)return;e.preventDefault();e.stopPropagation();openDay(b.dataset.personalDay)};
      b.ontouchend=e=>{touchAt=Date.now();e.preventDefault();e.stopPropagation();openDay(b.dataset.personalDay)};
    });
    paintIncomplete();
  }
  function scheduleBind(){clearTimeout(bindTimer);bindTimer=setTimeout(bindButtons,30)}
  const baseHours=window.renderHours;if(typeof baseHours==='function')window.renderHours=function(...a){const out=baseHours.apply(this,a);scheduleBind();return out};
  const baseAll=window.renderAll;if(typeof baseAll==='function')window.renderAll=function(...a){const out=baseAll.apply(this,a);scheduleBind();return out};
  const view=$('view-hours');if(view)new MutationObserver(scheduleBind).observe(view,{childList:true,subtree:true});
  window.openPersonalCalendarDay=openDay;
  scheduleBind();
})();