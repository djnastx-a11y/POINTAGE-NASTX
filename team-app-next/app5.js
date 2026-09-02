(()=>{
  const css=document.createElement('link');
  css.rel='stylesheet';
  css.href='./planning-v2.css';
  document.head.appendChild(css);

  const adminView=document.getElementById('view-planningAdmin');
  const palette=adminView?.querySelector('.palette');
  const planningWrap=adminView?.querySelector('.planningWrap');
  if(palette&&planningWrap){
    palette.classList.add('planningTopPalette');
    const title=palette.querySelector('h3');
    if(title)title.textContent='ÉQUIPE · GLISSE LE PRÉNOM DIRECTEMENT SUR LE JOUR';
    let hint=palette.querySelector('.planningTapHint');
    if(!hint){hint=document.createElement('div');hint.className='planningTapHint';palette.appendChild(hint)}
    hint.textContent='Le prénom reste sous ton doigt. Tu peux aussi toucher un prénom puis toucher un jour.';
    planningWrap.before(palette);
  }

  let selected=null;
  let drag=null;
  let suppressClickUntil=0;

  function clearSelected(){
    document.querySelectorAll('#view-planningAdmin .personChip.selectedPerson').forEach(x=>x.classList.remove('selectedPerson'));
  }

  function selectChip(chip){
    clearSelected();
    selected={id:chip.dataset.person,name:chip.dataset.name,isExtra:chip.dataset.extra==='1'};
    chip.classList.add('selectedPerson');
    if(typeof toast==='function')toast(`${selected.name} sélectionné · touche un jour`);
  }

  function addPersonToDate(person,date){
    if(!person||!date)return;
    const draft=draftFor(weekKey(adminWeek));
    if(!draft.days[date])draft.days[date]=[];
    draft.days[date].push({
      id:crypto.randomUUID(),employeeId:person.isExtra?null:person.id,name:person.name,isExtra:person.isExtra,
      startMode:'time',start:'18:00',endMode:'close',end:'',note:''
    });
    if(typeof audit==='function')audit('Planning modifié',`${person.name} ajouté le ${fmtDate(date)}`);
    if(typeof scheduleSave==='function')scheduleSave();
    const keep=selected?{...selected}:null;
    renderAdminPlanning();
    selected=keep;
    if(selected){
      const chip=[...document.querySelectorAll('#view-planningAdmin .personChip')].find(x=>x.dataset.person===selected.id);
      if(chip)chip.classList.add('selectedPerson');
    }
    if(typeof toast==='function')toast(`${person.name} ajouté`);
  }

  function dayFromPoint(x,y){
    const el=document.elementFromPoint(x,y);
    const day=el?.closest?.('#view-planningAdmin #adminPlanning .dayBlock');
    return day?.querySelector('.adminDrop')||null;
  }

  function clearTarget(){
    document.querySelectorAll('#view-planningAdmin .dayBlock.dragTarget').forEach(x=>x.classList.remove('dragTarget'));
  }

  function setTarget(drop){
    clearTarget();
    drop?.closest('.dayBlock')?.classList.add('dragTarget');
  }

  function startFloatingDrag(e){
    if(!drag||drag.started)return;
    drag.started=true;
    suppressClickUntil=Date.now()+500;
    drag.source.classList.add('dragSourceHidden');
    const ghost=document.createElement('div');
    ghost.className='planningFingerDrag';
    ghost.textContent=drag.person.name;
    document.body.appendChild(ghost);
    drag.ghost=ghost;
    document.body.classList.add('planningDragging');
    moveGhost(e.clientX,e.clientY);
  }

  function moveGhost(x,y){
    if(!drag?.ghost)return;
    drag.ghost.style.left=`${x}px`;
    drag.ghost.style.top=`${y}px`;
  }

  function autoScroll(y){
    const edge=115;
    if(y>window.innerHeight-edge)window.scrollBy({top:18,left:0,behavior:'auto'});
    else if(y<edge+70)window.scrollBy({top:-18,left:0,behavior:'auto'});
  }

  function endDrag(e,cancel=false){
    if(!drag)return;
    const wasStarted=drag.started;
    const person=drag.person;
    const source=drag.source;
    let date=null;
    if(wasStarted&&!cancel){
      const drop=dayFromPoint(e.clientX,e.clientY);
      date=drop?.dataset.date||null;
    }
    drag.ghost?.remove();
    source?.classList.remove('dragSourceHidden');
    clearTarget();
    document.body.classList.remove('planningDragging');
    drag=null;
    if(wasStarted&&date)addPersonToDate(person,date);
    else if(wasStarted&&typeof toast==='function')toast('Déplacement annulé');
  }

  function bindPaletteDrag(){
    document.querySelectorAll('#view-planningAdmin .personChip').forEach(chip=>{
      chip.onpointerdown=e=>{
        if(e.button!==undefined&&e.button!==0)return;
        drag={
          source:chip,
          pointerId:e.pointerId,
          startX:e.clientX,
          startY:e.clientY,
          started:false,
          ghost:null,
          person:{id:chip.dataset.person,name:chip.dataset.name,isExtra:chip.dataset.extra==='1'}
        };
        try{chip.setPointerCapture(e.pointerId)}catch{}
      };
    });
  }

  window.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;
    const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
    if(!drag.started&&Math.hypot(dx,dy)>5)startFloatingDrag(e);
    if(!drag.started)return;
    e.preventDefault();
    moveGhost(e.clientX,e.clientY);
    autoScroll(e.clientY);
    setTarget(dayFromPoint(e.clientX,e.clientY));
  },{passive:false});

  window.addEventListener('pointerup',e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;
    endDrag(e,false);
  });
  window.addEventListener('pointercancel',e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;
    endDrag(e,true);
  });

  window.initSortables=function(){
    if(typeof destroySortables==='function')destroySortables();
    if(typeof Sortable!=='undefined'){
      document.querySelectorAll('#view-planningAdmin .adminDrop').forEach(el=>{
        sortables.push(new Sortable(el,{
          group:'existing-shifts',
          animation:120,
          delay:0,
          forceFallback:true,
          fallbackOnBody:true,
          fallbackTolerance:3,
          scroll:true,
          scrollSensitivity:80,
          scrollSpeed:14,
          onEnd:e=>handleMove(e)
        }));
      });
    }
    document.querySelectorAll('#view-planningAdmin [data-edit-shift]').forEach(b=>b.onclick=e=>{
      e.stopPropagation();
      openShiftEditor(b.dataset.editShift);
    });
    bindPaletteDrag();
  };

  document.addEventListener('click',e=>{
    if(Date.now()<suppressClickUntil)return;
    const chip=e.target.closest('#view-planningAdmin .personChip');
    if(chip){selectChip(chip);return}
    const day=e.target.closest('#view-planningAdmin #adminPlanning .dayBlock');
    const drop=day?.querySelector('.adminDrop');
    if(drop&&selected&&!e.target.closest('.shiftCard'))addPersonToDate(selected,drop.dataset.date);
  });

  if(adminView?.classList.contains('active'))setTimeout(()=>window.initSortables(),0);
})();
