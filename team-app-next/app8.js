(()=>{
  document.body.classList.add('designV2');
  const theme=document.createElement('link');
  theme.rel='stylesheet';
  theme.href='./design-v2.css?v=200';
  document.head.appendChild(theme);
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute('content','#f4ecdf');
  const splashTitle=document.querySelector('#splash h1');
  if(splashTitle)splashTitle.textContent='APPLICATION ÉQUIPE';
  const splashSub=document.querySelector('#splash p');
  if(splashSub)splashSub.textContent='Pointage et planning Australia Street';
  const adminTitle=document.querySelector('#view-planningAdmin .pageTitle');
  if(adminTitle)adminTitle.textContent='Planning équipe';
  const adminSub=document.querySelector('#view-planningAdmin .pageSub');
  if(adminSub)adminSub.textContent='Choisis un prénom puis touche un jour, ou fais-le glisser directement dans la journée.';
})();
