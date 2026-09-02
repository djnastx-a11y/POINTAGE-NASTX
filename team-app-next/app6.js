(()=>{
  const theme=document.createElement('link');theme.rel='stylesheet';theme.href='./warm-theme.css';document.head.appendChild(theme);

  window.displayRange=function(x){
    if(x?.isRest)return 'Repos';
    const a=x?.startMode==='open'?'Ouverture':(x?.start||'');
    const b=x?.endMode==='close'?'Fermeture':x?.endMode==='kitchen'?'Fin cuisine':(x?.end||'');
    const main=`${a} → ${b}`;
    return x?.pauseStart&&x?.pauseEnd?`${main} · Pause ${x.pauseStart} → ${x.pauseEnd}`:main;
  };

  function pauseText(x){return !x?.isRest&&x?.pauseStart&&x?.pauseEnd?`Pause ${x.pauseStart} → ${x.pauseEnd}`:''}

  window.publicShiftCard=function(x){
    const meta=x.isRest?'Repos':(x.isExtra?'Extra':'Équipe');
    const p=pauseText(x);
    return`<div class="shiftCard ${x.isRest?'restShift':''}" style="cursor:default"><div><div class="shiftName">${escapeHtml(x.name)}</div><div class="shiftMeta">${escapeHtml(meta)}</div>${p?`<div class="pauseLine">${escapeHtml(p)}</div>`:''}</div><div class="shiftTime">${escapeHtml(x.isRest?'REPOS':displayRange({...x,pauseStart:'',pauseEnd:''}))}</div><div></div></div>`
  };

  window.adminShiftCard=function(x){
    const meta=x.isRest?'Repos':(x.isExtra?'Extra':'Équipe');
    const p=pauseText(x);
    return`<div class="shiftCard ${x.isRest?'restShift':''}" data-assignment="${x.id}"><div><div class="shiftName">${escapeHtml(x.name)}</div><div class="shiftMeta">${escapeHtml(meta)}</div>${p?`<div class="pauseLine">${escapeHtml(p)}</div>`:''}</div><div class="shiftTime">${escapeHtml(x.isRest?'REPOS':displayRange({...x,pauseStart:'',pauseEnd:''}))}</div><button class="shiftEdit" data-edit-shift="${x.id}">⋮</button></div>`
  };

  window.openShiftEditor=function(id){
    const f=findAssignment(id);if(!f)return;const x=f.item;
    openModal(`<div class="modal light lightForm"><div class="modalHead"><div><b>${escapeHtml(x.name)}</b><div style="margin-top:5px"><span class="shiftKindBadge">${x.isRest?'REPOS':'JOURNÉE DE TRAVAIL'}</span></div></div><button class="closeBtn" data-close>✕</button></div><div class="formGrid"><div class="full"><label>Type de journée</label><select id="shiftKind"><option value="work">Travail</option><option value="rest">Repos</option></select></div><div id="restNotice" class="restNotice hidden">Cette personne apparaîtra dans le planning avec la mention REPOS. Aucun horaire n’est nécessaire.</div><div id="workFields" class="full formGrid" style="grid-template-columns:1fr 1fr;gap:10px"><div><label>Début</label><select id="shiftStartMode"><option value="time">Heure</option><option value="open">Ouverture</option></select></div><div><label>Heure début</label><input id="shiftStart" type="time" value="${x.start||''}"></div><div><label>Fin</label><select id="shiftEndMode"><option value="time">Heure</option><option value="close">Fermeture</option><option value="kitchen">Fin cuisine</option></select></div><div><label>Heure fin</label><input id="shiftEnd" type="time" value="${x.end||''}"></div><div class="editorSection"><b style="font-size:13px">Pause</b><div style="font-size:11px;color:#81766b;margin-top:3px">Facultatif</div></div><div><label>Début pause</label><input id="shiftPauseStart" type="time" value="${x.pauseStart||''}"></div><div><label>Fin pause</label><input id="shiftPauseEnd" type="time" value="${x.pauseEnd||''}"></div></div><div class="full"><label>Note</label><input id="shiftNote" value="${escapeAttr(x.note||'')}"></div></div><div class="modalActions"><button id="deleteShift" class="smallBtn danger">Supprimer la case</button><button id="saveShift" class="smallBtn light">Enregistrer</button></div></div>`);
    $("shiftKind").value=x.isRest?'rest':'work';
    $("shiftStartMode").value=x.startMode||'time';
    $("shiftEndMode").value=x.endMode||'close';
    const toggle=()=>{const rest=$("shiftKind").value==='rest';$("workFields").classList.toggle('hidden',rest);$("restNotice").classList.toggle('hidden',!rest)};
    $("shiftKind").onchange=toggle;toggle();
    $("saveShift").onclick=()=>{
      const rest=$("shiftKind").value==='rest';
      x.isRest=rest;
      if(rest){x.startMode='time';x.start='';x.endMode='time';x.end='';x.pauseStart='';x.pauseEnd=''}
      else{
        x.startMode=$("shiftStartMode").value;x.start=$("shiftStart").value;x.endMode=$("shiftEndMode").value;x.end=$("shiftEnd").value;
        x.pauseStart=$("shiftPauseStart").value;x.pauseEnd=$("shiftPauseEnd").value;
        if(x.startMode==='time'&&!x.start){toast('Choisis une heure de début');return}
        if(x.endMode==='time'&&!x.end){toast('Choisis une heure de fin');return}
        if((x.pauseStart&&!x.pauseEnd)||(!x.pauseStart&&x.pauseEnd)){toast('Indique le début et la fin de la pause');return}
      }
      x.note=$("shiftNote").value.trim();
      audit(rest?'Repos planning enregistré':'Horaire planning corrigé',`${x.name} · ${fmtDate(f.date)} · ${displayRange(x)}`);
      scheduleSave();closeModal();renderAdminPlanning();renderPublicPlanning();
    };
    $("deleteShift").onclick=()=>{f.items.splice(f.items.indexOf(x),1);audit('Case planning supprimée',`${x.name} · ${fmtDate(f.date)}`);scheduleSave();closeModal();renderAdminPlanning()};
  };
})();
