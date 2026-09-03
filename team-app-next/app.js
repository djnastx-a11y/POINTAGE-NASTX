(()=>{
  const VERSION='251';
  const CORE=['./app1.js','./app2.js','./app3.js','./app4.js','./app5.js','./app6.js','./app7.js','./app8.js','./app9.js','./app10.js'];
  const OPTIONAL=['./app12.js'];

  const loadScript=src=>new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=`${src}?v=${VERSION}`;
    s.onload=resolve;
    s.onerror=()=>reject(new Error(`Impossible de charger ${src}`));
    document.body.appendChild(s);
  });

  (async()=>{
    for(const src of CORE) await loadScript(src);
    for(const src of OPTIONAL){
      try{await loadScript(src)}catch(error){console.error('Module optionnel indisponible',src,error)}
    }
  })().catch(error=>{
    console.error(error);
    const message=document.getElementById('authMsg');
    if(message) message.textContent='Impossible de charger l’application. Recharge la page.';
  });
})();
