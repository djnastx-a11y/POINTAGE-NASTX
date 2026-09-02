(()=>{
  function fixLogo(img){
    if(!img||img.dataset.logoFixed==='1')return;
    const src=img.getAttribute('src')||'';
    if(!src.includes('logo.svg'))return;
    img.dataset.logoFixed='1';
    img.style.opacity='0';
    img.style.background='#000';
    img.style.objectFit='contain';
    img.style.objectPosition='center';
    img.style.mixBlendMode='normal';
    img.style.filter='none';
    img.style.borderRadius='0';
    img.onload=()=>{img.style.opacity='1'};
    img.onerror=()=>{img.style.display='none'};
    img.src='./logo.jpg?v=140';
  }
  document.querySelectorAll('img').forEach(fixLogo);
  new MutationObserver(muts=>{
    for(const m of muts)for(const n of m.addedNodes){
      if(n.nodeType!==1)continue;
      if(n.matches?.('img'))fixLogo(n);
      n.querySelectorAll?.('img').forEach(fixLogo);
    }
  }).observe(document.documentElement,{childList:true,subtree:true});
})();
