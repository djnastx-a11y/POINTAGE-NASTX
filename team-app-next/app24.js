(()=>{
  let staffSortables=[];
  let selectedPerson=null;
  let suppressStaffClickUntil=0;

  const style=document.createElement('style');
  style.textContent=`
    #view-planningAdmin .v15StaffBtn.v24StaffDrop{position:relative;min-height:78px;touch-action:manipulation;transition:border-color .15s ease,box-shadow .15s ease,transform .15s ease}
    #view-planningAdmin .v15StaffBtn.v24StaffDrop:after{content:'GLISSER ICI';display:block;margin-top:7px;font-size:8px;font-weight:900;letter-spacing:.10em;color:#9a8c7c}
    #view-planningAdmin .v15StaffBtn.v24StaffDrop.v24Over{border-color:#211d19;box-shadow:0 0 0 2px rgba(33,29,25,.10);transform:scale(.99)}
    #peoplePalette .personChip.v24Selected,#extrasPalette .personChip.v24Selected{outline:2px solid #211d19;outline-offset:2px}
    #view-planningAdmin .v24PlanningHint{margin-top:7px;font-size:10px;line-height:1.4;color:#7c7064}
  `;
  document.head.appendChild(style);

  function destroyStaffSortables(){
    staffSortables.forEach(s=>{try{s.destroy()}catch{}});
    staffSortables=[];
  }

  function removeCaroFromPalette(){
    document.querySelectorAll('#peoplePalette [data-person="caro"],#peoplePalette [data-name="Caro"],#peoplePalette [data-name="Caroline"]').forEach(el=>el.remove());
  }

  function staffingRow(date){
    const wk=weekKey(adminWeek);
    const draft=draftFor(wk);
    if(!draft.staffing||typeof draft.staffing!=='object')draft.staffing={};
    if(!draft.staffing[date])draft.staffing[date]={kitchen:'OFF',security:'OFF'};
    return draft.staffing[date];
  }

  function assignStaff(date,key,name){
    if(!date||!['kitchen','security'].includes(key)||!name)return;
    const row=staffingRow(date);
    row[key]=String(name).trim().slice(0,50)||'OFF';
    const label=key==='kitchen'?'CUISINE':'SÉCU';
    try{audit(`${label} planning modifié`,`${fmtDate(date)} · ${row[key]}`)}catch{}
    try{scheduleSave()}catch{}
    suppressStaffClickUntil=Date.now()+900;
    selectedPerson=null;
    document.querySelectorAll('#peoplePalette .v24Selected,#extrasPalette .v24Selected').forEach(x=>x.classList.remove('v24Selected'));
    renderAdminPlanning();
    try{toast(`${name} ajouté en ${key==='kitchen'?'cuisine':'sécu'}`)}catch{}
  }

  function personFromElement(el){
    const chip=el?.closest?.('#peoplePalette .personChip,#extrasPalette .personChip');
    if(!chip)return null;
    const name=chip.dataset.name||chip.textContent?.trim()||'';
    if(!name)return null;
    return{id:chip.dataset.person||'',name,chip};
  }

  function bindTapSelection(){
    document.querySelectorAll('#peoplePalette .personChip,#extrasPalette .personChip').forEach(chip=>{
      if(chip.dataset.v24TapBound==='1')return;
      chip.dataset.v24TapBound='1';
      chip.addEventListener('click',()=>{
        const p=personFromElement(chip);if(!p)return;
        selectedPerson={id:p.id,name:p.name};
        document.querySelectorAll('#peoplePalette .v24Selected,#extrasPalette .v24Selected').forEach(x=>x.classList.remove('v24Selected'));
        chip.classList.add('v24Selected');
      },true);
    });
  }

  function bindStaffDrops(){
    destroyStaffSortables();
    const boxes=[...document.querySelectorAll('#adminPlanning .v15StaffBtn[data-v15-staff][data-v15-date]')];
    boxes.forEach(box=>{
      box.classList.add('v24StaffDrop');
      box.setAttribute('title','Glisse un prénom ici');
      if(typeof Sortable!=='undefined'){
        const sortable=new Sortable(box,{
          group:{name:'team',pull:false,put:true},
          sort:false,
          animation:120,
          onChoose:()=>box.classList.add('v24Over'),
          onUnchoose:()=>box.classList.remove('v24Over'),
          onAdd:e=>{
            box.classList.remove('v24Over');
            const item=e.item;
            const name=item?.dataset?.name||item?.querySelector?.('.shiftName')?.textContent?.trim()||'';
            const personId=item?.dataset?.person||'';
            try{item?.remove()}catch{}
            if(!name||(!personId&&e.from?.id!=='extrasPalette')){renderAdminPlanning();return}
            assignStaff(box.dataset.v15Date,box.dataset.v15Staff,name);
          }
        });
        staffSortables.push(sortable);
      }
    });
  }

  function updateCopy(){
    const title=document.querySelector('#view-planningAdmin .palette h3');
    if(title)title.textContent='ÉQUIPE · GLISSE LE PRÉNOM SUR LE JOUR, LA CUISINE OU LA SÉCU';
    const palette=document.querySelector('#view-planningAdmin .palette');
    if(palette&&!palette.querySelector('.v24PlanningHint')){
      const hint=document.createElement('div');
      hint.className='v24PlanningHint';
      hint.textContent='Tu peux aussi toucher un prénom puis toucher Cuisine ou Sécu.';
      palette.appendChild(hint);
    }
  }

  function postRender(){
    removeCaroFromPalette();
    updateCopy();
    bindTapSelection();
    bindStaffDrops();
  }

  const previousRender=window.renderAdminPlanning;
  window.renderAdminPlanning=function(...args){
    const out=typeof previousRender==='function'?previousRender.apply(this,args):undefined;
    setTimeout(postRender,0);
    return out;
  };

  document.addEventListener('click',e=>{
    const staff=e.target.closest?.('#adminPlanning .v15StaffBtn[data-v15-staff][data-v15-date]');
    if(!staff)return;
    if(Date.now()<suppressStaffClickUntil){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();return}
    if(selectedPerson){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      assignStaff(staff.dataset.v15Date,staff.dataset.v15Staff,selectedPerson.name);
    }
  },true);

  const admin=document.getElementById('adminPlanning');
  if(admin)new MutationObserver(()=>setTimeout(postRender,0)).observe(admin,{childList:true,subtree:true});
  setTimeout(postRender,50);
})();
