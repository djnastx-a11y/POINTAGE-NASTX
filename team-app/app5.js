(()=>{
  const css=document.createElement('link');css.rel='stylesheet';css.href='./planning-v2.css';document.head.appendChild(css);
  const adminView=document.getElementById('view-planningAdmin');
  const palette=adminView?.querySelector('.palette');
  const planningWrap=adminView?.querySelector('.planningWrap');
  if(palette&&planningWrap){
    palette.classList.add('planningTopPalette');
    const title=palette.querySelector('h3');
    if(title)title.textContent='ÉQUIPE · GLISSE UN PRÉNOM OU TOUCHE-LE PUIS TOUCHE UN JOUR';
    const hint=document.createElement('div');hint.className='planningTapHint';hint.textContent='Les prénoms restent en haut pendant que tu parcours la semaine.';palette.appendChild(hint);
    planningWrap.before(palette);
  }

  let selected=null;
  function clearSelected(){document.querySelectorAll('#view-planningAdmin .personChip.selectedPerson').forEach(x=>x.classList.remove('selectedPerson'))}
  function selectChip(chip){
    clearSelected();
    selected={id:chip.dataset.person,name:chip.dataset.name,isExtra:chip.dataset.extra==='1'};
    chip.classList.add('selectedPerson');
    if(typeof toast==='function')toast(`${selected.name} sélectionné · touche un jour`);
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
    const chip=[...document.querySelectorAll('#view-planningAdmin .personChip')].find(x=>x.dataset.person===selected.id&&x.dataset.extra===(selected.isExtra?'1':undefined));
    if(chip)chip.classList.add('selectedPerson');
    if(typeof toast==='function')toast(`${selected.name} ajouté`);
  }

  document.addEventListener('click',e=>{
    const chip=e.target.closest('#view-planningAdmin .personChip');
    if(chip){selectChip(chip);return}
    const drop=e.target.closest('#view-planningAdmin .adminDrop');
    if(drop&&selected&&!e.target.closest('.shiftCard')){addSelectedTo(drop.dataset.date)}
  });
})();
