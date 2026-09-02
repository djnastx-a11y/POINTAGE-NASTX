(()=>{
  const style=document.createElement('style');
  style.textContent=`
    #auth{display:none!important}
  `;
  document.head.appendChild(style);

  function hideTechnicalLogin(){
    const auth=document.getElementById('auth');
    if(auth)auth.classList.add('hidden');
  }

  window.loadCloud=async function(){
    setSync('Préproduction locale');
    return false;
  };

  window.saveCloudNow=async function(){
    setSync('Préproduction locale');
    return false;
  };

  hideTechnicalLogin();

  const enter=document.getElementById('enterBtn');
  if(enter){
    enter.onclick=()=>{
      document.getElementById('splash')?.classList.add('hidden');
      hideTechnicalLogin();
      if(profileId)startApp();else showProfileScreen();
    };
  }

  const oldShowProfile=window.showProfileScreen;
  window.showProfileScreen=function(){hideTechnicalLogin();return oldShowProfile()};

  const authBtn=document.getElementById('authBtn');
  if(authBtn)authBtn.onclick=e=>{e.preventDefault();hideTechnicalLogin();if(profileId)startApp();else showProfileScreen()};

  setTimeout(()=>{
    hideTechnicalLogin();
    setSync('Préproduction locale');
  },0);
})();
