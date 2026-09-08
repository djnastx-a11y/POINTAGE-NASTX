(()=>{
  let selfEditId=null;
  const incompleteIds=new Set();

  const style=document.createElement('style');
  style.textContent=`
    #selfMsg.selfSaveMsg{display:block;margin:10px 0 4px;padding:10px 12px;border-radius:12px;background:#eee5d8;color:#4e453d;font-size:12px;line-height:1.35;text-align:left!important;min-height:0}
    #selfMsg.selfSaveMsg:empty{display:none}
    .selfFieldError{border-color:#9d3838!important;box-shadow:0 0 0 2px rgba(157,56,56,.10)!important}
    .selfRequiredHint{font-size:10px;color:#776b5f;margin-top:6px;line-height:1.3}
    .personalCalendarDay.needsDeparture{background:#f3e4cf;border-color:#b99e79}.personalCalendarDay.needsDeparture small{color:#6f512f;font-weight:950}
  `;
  document.head.appendChild(style);

  function authRpc(name,body={}){
    return ensureSession().then(s=>{
      if(!s)throw new Error('Session expirée. Reconnecte-toi.');
      return fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{
        method:'POST',
        headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},
        body:JSON.stringify(body)
      });
    }).then(async r=>{
      const text=await r.text();
      if(!r.ok)throw new Error(text||`Erreur ${r.status}`);
      return text?JSON.parse(text):null;
    });
  }

  async function refreshIncompleteFlags(){
    try{
      const s=await ensureSession(),uid=userId();
      if(!s||!uid)return;
      const r=await fetch(`${SUPABASE_URL}/rest/v1/team_pointages?select=id,manual_incomplete&user_id=eq.${encodeURIComponent(uid)}&manual_incomplete=eq.true`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`}});
      if(!r.ok)return;
      const rows=await r.json();
      incompleteIds.clear();rows.forEach(x=>incompleteIds.add(x.id));
      (state?.sessions||[]).forEach(x=>x.manualIncomplete=incompleteIds.has(x.id));
      paintIncompleteCalendar();
    }catch(e){console.warn('incomplete flags',e)}
  }

  function dateKeyParis(value){
    const p=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
    const o={};p.forEach(x=>{if(x.type!=='literal')o[x.type]=x.value});return`${o.year}-${o.month}-${o.day}`;
  }
  function timeParis(value){return new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value))}

  function paintIncompleteCalendar(){
    const days=new Set((state?.sessions||[]).filter(s=>s.employeeId===profileId&&s.manualIncomplete).map(s=>dateKeyParis(s.start)));
    document.querySelectorAll('[data-personal-day]').forEach(b=>{
      if(!days.has(b.dataset.personalDay))return;
      b.classList.add('needsDeparture');const small=b.querySelector('small');if(small)small.textContent='Départ à compléter';
    });
  }

  function prepareEditor(){
    const msg=$('selfMsg'),save=$('selfSave'),end=$('selfEnd');
    if(!msg||!save)return;
    msg.classList.add('selfSaveMsg');
    const actions=save.closest('.modalActions');if(actions&&msg.parentElement===actions.parentElement)actions.parentElement.insertBefore(msg,actions);
    if(end){
      const label=end.closest('div')?.querySelector('label');if(label)label.textContent='Départ · facultatif';
      const editing=selfEditId&&state?.sessions?.find(s=>s.id===selfEditId);
      if(editing?.manualIncomplete)end.value='';
    }
    const start=$('selfStart');
    if(start&&end&&!$('selfRequiredHint')){
      const hint=document.createElement('div');hint.id='selfRequiredHint';hint.className='selfRequiredHint full';
      hint.textContent='Tu peux enregistrer uniquement ton arrivée et compléter le départ plus tard.';
      start.closest('.formGrid')?.appendChild(hint);
    }
  }

  function patchOpenDay(){
    document.querySelectorAll('.personalDayRow').forEach(row=>{
      const edit=row.querySelector('[data-self-edit]'),s=edit?state?.sessions?.find(x=>x.id===edit.dataset.selfEdit):null;
      if(!s?.manualIncomplete)return;
      const b=row.querySelector('b');if(b)b.textContent=`${timeParis(s.start)} → départ à compléter`;
      const small=row.querySelector('small');if(small)small.textContent='Arrivée enregistrée · ajoute ton heure de départ quand tu la connais';
    });
  }

  function mapSaveError(error){
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

  new MutationObserver(prepareEditor).observe($('modalRoot')||document.body,{childList:true,subtree:true});

  document.addEventListener('click',e=>{
    const edit=e.target.closest?.('[data-self-edit]');
    if(edit){selfEditId=edit.dataset.selfEdit;setTimeout(prepareEditor,0);return}
    if(e.target.closest?.('#selfAddRange')){selfEditId=null;setTimeout(prepareEditor,0);return}
    if(e.target.closest?.('[data-personal-day]'))setTimeout(patchOpenDay,0);
  },true);

  document.addEventListener('click',async e=>{
    const btn=e.target.closest?.('#selfSave');if(!btn)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    const date=$('selfDate')?.value||'',st=$('selfStart')?.value||'',en=$('selfEnd')?.value||'';
    const pstart=$('selfPauseStart')?.value||'',pend=$('selfPauseEnd')?.value||'',note=$('selfNote')?.value.trim()||'',msg=$('selfMsg');
    [$('selfDate'),$('selfStart'),$('selfEnd'),$('selfPauseStart'),$('selfPauseEnd')].forEach(x=>x?.classList.remove('selfFieldError'));
    if(!date){$('selfDate')?.classList.add('selfFieldError');if(msg)msg.textContent='Choisis la date.';return}
    if(!st){$('selfStart')?.classList.add('selfFieldError');if(msg)msg.textContent='Renseigne ton heure d’arrivée.';return}
    if((pstart&&!pend)||(!pstart&&pend)){if(msg)msg.textContent='Pour une pause, renseigne le début et la fin.';return}
    if(!en&&(pstart||pend)){if(msg)msg.textContent='Ajoute ton heure de départ avant de renseigner une pause.';return}
    btn.disabled=true;if(msg)msg.textContent=en?'Enregistrement…':'Enregistrement de l’arrivée…';
    try{
      if(selfEditId){
        const existing=state?.sessions?.find(s=>s.id===selfEditId),hasPauses=Array.isArray(existing?.pauses)&&existing.pauses.length>0;
        const pauseMode=!en?'clear':(pstart&&pend?'replace':(hasPauses?'preserve':'clear'));
        await authRpc('team_self_update_pointage',{pointage_id:selfEditId,work_date:date,start_time:st,end_time:en||null,pause_mode:pauseMode,pause_start:pstart||null,pause_end:pend||null,note});
      }else{
        await authRpc('team_self_add_pointage',{work_date:date,start_time:st,end_time:en||null,pause_start:pstart||null,pause_end:pend||null,note});
      }
      closeModal();selfEditId=null;
      if(typeof window.loadCloud==='function')await window.loadCloud();
      await refreshIncompleteFlags();
      if(typeof window.renderHours==='function')window.renderHours();
      toast(en?'Journée enregistrée':'Arrivée enregistrée · départ à compléter');
    }catch(error){console.error(error);if(msg)msg.textContent=mapSaveError(error)}finally{btn.disabled=false}
  },true);

  const baseLoadCloud=window.loadCloud;
  if(typeof baseLoadCloud==='function')window.loadCloud=async function(...args){const out=await baseLoadCloud.apply(this,args);await refreshIncompleteFlags();return out};
  const baseRenderHours=window.renderHours;
  if(typeof baseRenderHours==='function')window.renderHours=function(...args){const out=baseRenderHours.apply(this,args);setTimeout(paintIncompleteCalendar,0);return out};

  prepareEditor();setTimeout(refreshIncompleteFlags,500);
})();
