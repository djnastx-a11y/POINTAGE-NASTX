(()=>{
  const style=document.createElement('style');
  style.textContent=`
    #selfMsg.selfSaveMsg{display:block;margin:10px 0 4px;padding:10px 12px;border-radius:12px;background:#eee5d8;color:#4e453d;font-size:12px;line-height:1.35;text-align:left!important;min-height:0}
    #selfMsg.selfSaveMsg:empty{display:none}
    .selfFieldError{border-color:#9d3838!important;box-shadow:0 0 0 2px rgba(157,56,56,.10)!important}
    .selfRequiredHint{font-size:10px;color:#776b5f;margin-top:6px;line-height:1.3}
  `;
  document.head.appendChild(style);

  function prepareEditor(){
    const msg=document.getElementById('selfMsg');
    const save=document.getElementById('selfSave');
    if(!msg||!save||save.dataset.v18Ready==='1')return;
    save.dataset.v18Ready='1';
    msg.classList.add('selfSaveMsg');
    const actions=save.closest('.modalActions');
    if(actions&&msg.parentElement===actions.parentElement)actions.parentElement.insertBefore(msg,actions);
    const start=document.getElementById('selfStart');
    const end=document.getElementById('selfEnd');
    if(start&&end&&!document.getElementById('selfRequiredHint')){
      const hint=document.createElement('div');
      hint.id='selfRequiredHint';hint.className='selfRequiredHint full';
      hint.textContent='Arrivée et départ obligatoires pour enregistrer la journée.';
      const grid=start.closest('.formGrid');if(grid)grid.appendChild(hint);
    }
  }

  new MutationObserver(prepareEditor).observe(document.getElementById('modalRoot')||document.body,{childList:true,subtree:true});
  prepareEditor();

  document.addEventListener('click',e=>{
    const save=e.target.closest?.('#selfSave');
    if(!save)return;
    const date=document.getElementById('selfDate');
    const start=document.getElementById('selfStart');
    const end=document.getElementById('selfEnd');
    const ps=document.getElementById('selfPauseStart');
    const pe=document.getElementById('selfPauseEnd');
    const msg=document.getElementById('selfMsg');
    [date,start,end,ps,pe].forEach(x=>x?.classList.remove('selfFieldError'));

    let text='';let focus=null;
    if(!date?.value){text='Choisis la date.';focus=date}
    else if(!start?.value){text='Renseigne ton heure d’arrivée.';focus=start}
    else if(!end?.value){text='Renseigne ton heure de départ.';focus=end}
    else if((ps?.value&&!pe?.value)||(!ps?.value&&pe?.value)){
      text='Pour une pause, renseigne le début et la fin.';focus=!ps?.value?ps:pe;
    }
    if(!text)return;

    e.preventDefault();
    e.stopImmediatePropagation();
    if(focus){focus.classList.add('selfFieldError');try{focus.focus()}catch{}}
    if(msg){msg.textContent=text;msg.classList.add('selfSaveMsg');msg.scrollIntoView({block:'nearest',behavior:'smooth'})}
    if(typeof toast==='function')toast(text);
  },true);

  new MutationObserver(()=>{
    const msg=document.getElementById('selfMsg');
    if(!msg)return;
    msg.classList.add('selfSaveMsg');
    const text=(msg.textContent||'').trim();
    if(!text||text==='Enregistrement…'||msg.dataset.v18Last===text)return;
    msg.dataset.v18Last=text;
    if(typeof toast==='function')toast(text);
  }).observe(document.getElementById('modalRoot')||document.body,{childList:true,subtree:true,characterData:true});
})();
