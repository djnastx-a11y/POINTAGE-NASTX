(()=>{
  document.body.classList.add('noBrandLogo');
  const style=document.createElement('style');
  style.textContent=`
    body.noBrandLogo .splashLogo,
    body.noBrandLogo .drawerBrand img,
    body.noBrandLogo .heroLogo,
    body.noBrandLogo #auth .authBox img{display:none!important}
    body.noBrandLogo .drawerBrand{min-height:72px;align-items:center!important}
    body.noBrandLogo .drawerBrand>div{padding-left:2px}
    body.noBrandLogo .heroCopy{max-width:62%!important}
    body.noBrandLogo #auth .authBox{padding-top:30px!important}
    body.noBrandLogo .splashInner{padding-top:10px}
    body.noBrandLogo .splashKoala{margin-top:0!important}
  `;
  document.head.appendChild(style);
})();
