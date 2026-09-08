(()=>{
  window.setInterval(()=>{
    const view=document.getElementById('view-messages');
    if(!view||!view.classList.contains('active'))return;
    const selector=document.getElementById('v15ChatTarget');
    if(selector&&typeof selector.onchange==='function')selector.onchange();
  },12000);
  const fixLabels=()=>{
    document.querySelectorAll('#accountsList .listMain b').forEach(b=>{if(b.textContent.trim()==='Cyril')b.textContent='Cyrille'});
  };
  const box=document.getElementById('accountsList');
  if(box){new MutationObserver(fixLabels).observe(box,{childList:true,subtree:true});fixLabels()}
})();