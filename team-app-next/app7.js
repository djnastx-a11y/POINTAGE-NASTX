(()=>{
  const SHARED_TEAM_ROW='00000000-0000-4000-8000-000000000826';
  let sharedCloudReady=false;
  let cloudInitPromise=null;

  const style=document.createElement('style');
  style.textContent=`
    img[src$="logo.svg"]{content:url('./logo.jpg')}
    #auth{display:none!important}
  `;
  document.head.appendChild(style);

  function hideTechnicalLogin(){
    const auth=document.getElementById('auth');
    if(auth)auth.classList.add('hidden');
  }

  async function ensureInvisibleSession(){
    const existing=await ensureSession();
    if(existing)return existing;
    if(!navigator.onLine)return null;
    try{
      const j=await authRequest('signup',{data:{app:'australia-street-team'}});
      if(j?.access_token&&j?.refresh_token){
        const s={access_token:j.access_token,refresh_token:j.refresh_token,expires_at:Date.now()+((j.expires_in||3600)*1000),user:j.user};
        saveSession(s);
        return s;
      }
    }catch(e){console.warn('Connexion automatique indisponible',e)}
    return null;
  }

  async function initSharedCloud(){
    if(cloudInitPromise)return cloudInitPromise;
    cloudInitPromise=(async()=>{
      const s=await ensureInvisibleSession();
      if(!s){sharedCloudReady=false;setSync('Sur cet appareil');return false}
      try{
        await appFetch(`?select=payload,updated_at&user_id=eq.${encodeURIComponent(SHARED_TEAM_ROW)}&limit=1`);
        sharedCloudReady=true;
        return true;
      }catch(e){
        console.warn('Cloud partagé non disponible',e);
        sharedCloudReady=false;
        setSync('Sur cet appareil');
        return false;
      }
    })();
    return cloudInitPromise;
  }

  window.loadCloud=async function(){
    if(!navigator.onLine){setSync('Hors connexion','err');return false}
    if(!(await initSharedCloud()))return false;
    try{
      setSync('Synchronisation…');
      const rows=await appFetch(`?select=payload,updated_at&user_id=eq.${encodeURIComponent(SHARED_TEAM_ROW)}&limit=1`);
      if(rows[0]?.payload?.[TEAM_NS]){
        const cloud=normalizeState(rows[0].payload[TEAM_NS]);
        if(new Date(cloud.updatedAt||0)>=new Date(state.updatedAt||0)){state=cloud;saveLocal()}
      }else{
        await window.saveCloudNow();
      }
      setSync('Synchronisé','ok');
      renderAll();
      return true;
    }catch(e){
      console.warn(e);setSync('Sur cet appareil','err');return false;
    }
  };

  window.saveCloudNow=async function(){
    if(cloudBusy||!navigator.onLine)return false;
    if(!(await initSharedCloud()))return false;
    cloudBusy=true;
    try{
      const rows=await appFetch(`?select=payload&user_id=eq.${encodeURIComponent(SHARED_TEAM_ROW)}&limit=1`);
      const payload={...(rows[0]?.payload||{}),[TEAM_NS]:state};
      await appFetch(`?on_conflict=user_id`,{method:'POST',prefer:'resolution=merge-duplicates,return=representation',body:JSON.stringify({user_id:SHARED_TEAM_ROW,payload,updated_at:state.updatedAt})});
      setSync('Synchronisé','ok');
      return true;
    }catch(e){
      console.warn(e);setSync('Sur cet appareil','err');return false;
    }finally{cloudBusy=false}
  };

  hideTechnicalLogin();

  const enter=document.getElementById('enterBtn');
  if(enter){
    enter.onclick=async()=>{
      document.getElementById('splash')?.classList.add('hidden');
      hideTechnicalLogin();
      await initSharedCloud();
      if(sharedCloudReady)await window.loadCloud();
      if(profileId)startApp();else showProfileScreen();
    };
  }

  const oldShowProfile=window.showProfileScreen;
  window.showProfileScreen=function(){hideTechnicalLogin();return oldShowProfile()};

  const authBtn=document.getElementById('authBtn');
  if(authBtn)authBtn.onclick=e=>{e.preventDefault();hideTechnicalLogin();if(profileId)startApp();else showProfileScreen()};

  setTimeout(()=>{
    hideTechnicalLogin();
    document.querySelectorAll('img[src$="logo.svg"]').forEach(img=>{img.src='./logo.jpg'});
  },0);
})();
