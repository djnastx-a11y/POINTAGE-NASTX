(()=>{
  const css=document.createElement('link');
  css.rel='stylesheet';
  css.href='./logo-fix.css?v=230';
  document.head.appendChild(css);

  function fixLogo(img){
    if(!img)return;
    const src=img.getAttribute('src')||'';
    if(!src.includes('logo.svg')&&!src.includes('logo.jpg')&&!src.includes('logo-clean'))return;
    img.dataset.logoFixed='230';
    img.style.background='transparent';
    img.style.objectPosition='center top';
    img.style.mixBlendMode='normal';
    img.style.filter='none';
    img.style.borderRadius='0';
    img.onerror=()=>{img.style.display='none'};
    if(!src.includes('logo.jpg'))img.src='./logo.jpg?v=230';
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