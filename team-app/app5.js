(()=>{
  const css=document.createElement('link');css.rel='stylesheet';css.href='./planning-v2.css?v=3';document.head.appendChild(css);
  const adminView=document.getElementById('view-planningAdmin');
  const palette=adminView?.querySelector('.palette');
  const planningWrap=adminView?.querySelector('.planningWrap');
  if(palette&&planningWrap){
    palette.classList.add('planningTopPalette');
    const title=palette.querySelector('h3');
    if(title)title.textContent='ÉQUIPE · GLISSE OU TOUCHE UN PRÉNOM';
    let hint=palette.querySelector('.planningTapHint');
    if(!hint){hint=document.createElement('div');hint.className='planningTapHint';palette.appendChild(hint)}
    hint.textContent='Glisse directement vers un jour. Sur téléphone, tu peux aussi toucher un prénom puis toucher la journée.';
    planningWrap.before(palette);
  }

  let selected=null;
  const clearDropReady=()=>document.querySelectorAll('#view-planningAdmin .adminDrop.dropReady').forEach(x=>x.classList.remove('dropReady'));
  const setDropReady=()=>document.querySelectorAll('#view-planningAdmin .adminDrop').forEach(x=>x.classList.add('dropReady'));
  function clearSelected(){document.querySelectorAll('#view-planningAdmin .personChip.selectedPerson').forEach(x=>x.classList.remove('selectedPerson'))}
  function restoreSelected(){
    clearSelected();
    if(!selected)return;
    const chip=[...document.querySelectorAll('#view-planningAdmin .personChip')].find(x=>x.dataset.person===selected.id&&((x.dataset.extra==='1')===selected.isExtra));
    if(chip)chip.classList.add('selectedPerson');
  }
  function selectChip(chip){
    selected={id:chip.dataset.person,name:chip.dataset.name,isExtra:chip.dataset.extra==='1'};
    restoreSelected();
    if(typeof toast==='function')toast(`${selected.name} sélectionné · touche une journée`);
  }
  function addSelectedTo(date){
    if(!selected||!date)return;
    const draft=draftFor(weekKey(adminWeek));
    if(!draft.days[date])draft.days[date]=[];
    draft.days[date].push({id:crypto.randomUUID(),employeeId:selected.isExtra?null:selected.id,name:selected.name,isExtra:selected.isExtra,startMode:'time',start:'18:00',endMode:'close',end:'',note:''});
    if(typeof audit==='function')audit('Planning modifié',`${selected.name} ajouté le ${fmtDate(date)}`);
    if(typeof scheduleSave==='function')scheduleSave();
    const keep={...selected};
    renderAdminPlanning();
    selected=keep;
    restoreSelected();
    if(typeof toast==='function')toast(`${selected.name} ajouté`);
  }

  /* Remplace la configuration Sortable d'origine. Le clone est placé sur le body,
     sans délai, ce qui supprime l'écart entre le doigt et la carte sur mobile. */
  initSortables=function(){
    destroySortables();
    if(typeof Sortable==='undefined')return;
    const common={
      animation:180,
      delay:0,
      delayOnTouchOnly:false,
      forceFallback:true,
      fallbackOnBody:true,
      fallbackTolerance:4,
      touchStartThreshold:3,
      scroll:true,
      scrollSensitivity:90,
      scrollSpeed:20,
      bubbleScroll:true,
      ghostClass:'dragGhost',
      chosenClass:'dragChosen',
      fallbackClass:'dragFallback',
      onStart:setDropReady,
      onEnd:clearDropReady
    };
    const paletteOpts={...common,group:{name:'team',pull:'clone',put:false},sort:false};
    sortables.push(new Sortable($('peoplePalette'),paletteOpts));
    sortables.push(new Sortable($('extrasPalette'),paletteOpts));
    document.querySelectorAll('.adminDrop').forEach(el=>sortables.push(new Sortable(el,{
      ...common,
      group:'team',
      onAdd:e=>{clearDropReady();handleDrop(e)},
      onEnd:e=>{clearDropReady();handleMove(e)}
    })));
    document.querySelectorAll('[data-edit-shift]').forEach(b=>b.onclick=e=>{e.stopPropagation();openShiftEditor(b.dataset.editShift)});
  };

  const baseRender=renderAdminPlanning;
  renderAdminPlanning=function(){
    baseRender();
    document.querySelectorAll('#view-planningAdmin .dropHint').forEach(h=>h.textContent='Déposer ou toucher ici');
    restoreSelected();
  };

  document.addEventListener('click',e=>{
    const chip=e.target.closest('#view-planningAdmin .personChip');
    if(chip){selectChip(chip);return}
    const drop=e.target.closest('#view-planningAdmin .adminDrop');
    if(drop&&selected&&!e.target.closest('.shiftCard'))addSelectedTo(drop.dataset.date);
  });
})();
