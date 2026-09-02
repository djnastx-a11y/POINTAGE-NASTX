(()=>{
  const TEAM_EMAIL_DOMAIN='team.australia.invalid';
  const originalStartApp=window.startApp;

  const css=document.createElement('style');
  css.textContent=`
    #profileScreen{display:none!important}
    #auth.accountAuth{display:flex!important;background:#f4ecdf!important;color:#181512!important}
    #auth.accountAuth .authBox{background:#fffaf2!important;border:1px solid #ddcfbe!important;color:#181512!important;box-shadow:0 24px 70px rgba(55,43,31,.18)!important}
    #auth.accountAuth .authBox p{color:#776b5f!important}
    #auth.accountAuth label{color:#51483f!important}
    #auth.accountAuth input{background:#fff!important;color:#181512!important;border-color:#d8c9b7!important}
    #auth.accountAuth .sync{color:#8a2f2f!important}
  `;
  document.head.appendChild(css);

  function emailForUsername(username){
    const u=String(username||'').trim().toLowerCase();
    if(u==='jb')return 'djnastx@gmail.com';
    return `${u}@${TEAM_EMAIL_DOMAIN}`;
  }

  async function teamMemberForSession(){
    const s=await ensureSession();
    if(!s?.user?.id)return null;
    const r=await fetch(`${SUPABASE_URL}/rest/v1/team_members?select=user_id,username,display_name,role,active,must_change_pin&user_id=eq.${encodeURIComponent(s.user.id)}&limit=1`,{
      headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`}
    });
    if(!r.ok)return null;
    const rows=await r.json().catch(()=>[]);
    return rows[0]||null;
  }

  function applyMember(member){
    if(!member?.active)return false;
    const id=String(member.username||'').toLowerCase();
    const known=EMPLOYEES.find(e=>e.id===id);
    if(!known)return false;
    profileId=id;
    localStorage.setItem(PROFILE_KEY,id);
    known.name=member.display_name||known.name;
    known.admin=member.role==='admin';
    return true;
  }

  function clearAppSession(){
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(PROFILE_KEY);
    profileId='';
  }

  function buildLogin(){
    const auth=$('auth');
    auth.className='auth accountAuth';
    auth.innerHTML=`<div class="authBox">
      <img alt="Australia Street" src="./logo-clean.svg?v=220"/>
      <h2>Connexion équipe</h2>
      <p>Connecte-toi avec ton identifiant personnel. Ton compte restera enregistré sur ce téléphone.</p>
      <label>Identifiant</label><input id="teamUsername" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Ex. louella" maxlength="32"/>
      <label style="margin-top:12px">Code personnel</label><input id="teamPin" autocomplete="current-password" inputmode="numeric" pattern="[0-9]*" type="password" placeholder="••••••••" maxlength="20"/>
      <button class="btn3d light" id="teamLoginBtn">SE CONNECTER</button>
      <div class="sync" id="teamLoginMsg" style="margin-top:12px;text-align:center"></div>
    </div>`;
    $('teamLoginBtn').onclick=loginPersonalAccount;
    $('teamPin').addEventListener('keydown',e=>{if(e.key==='Enter')loginPersonalAccount()});
  }

  async function loginPersonalAccount(){
    const username=$('teamUsername')?.value.trim().toLowerCase()||'';
    const pin=$('teamPin')?.value||'';
    const msg=$('teamLoginMsg');
    if(!/^[a-z0-9._-]{2,32}$/.test(username)){msg.textContent='Identifiant incorrect.';return}
    if(pin.length<8){msg.textContent='Le code personnel doit contenir au moins 8 caractères.';return}
    const btn=$('teamLoginBtn');btn.disabled=true;msg.textContent='Connexion…';
    try{
      const j=await authRequest('token?grant_type=password',{email:emailForUsername(username),password:pin});
      saveSession({access_token:j.access_token,refresh_token:j.refresh_token,expires_at:Date.now()+((j.expires_in||3600)*1000),user:j.user});
      const member=await teamMemberForSession();
      if(!member||member.username!==username||!applyMember(member)){
        clearAppSession();
        throw new Error('Ce compte n’est pas autorisé pour l’application équipe.');
      }
      $('auth').classList.add('hidden');
      $('auth').classList.remove('accountAuth');
      $('splash')?.classList.add('hidden');
      if(typeof loadCloud==='function')await loadCloud();
      originalStartApp();
    }catch(e){
      msg.textContent=e?.message==='Invalid login credentials'?'Identifiant ou code incorrect.':(e?.message||'Connexion impossible.');
    }finally{btn.disabled=false}
  }

  async function resumePersonalAccount(){
    const s=await ensureSession();
    if(!s)return false;
    const member=await teamMemberForSession();
    if(!member||!applyMember(member)){clearAppSession();return false}
    return true;
  }

  window.showProfileScreen=function(){
    $('profileScreen')?.classList.add('hidden');
    buildLogin();
  };

  const switchBtn=$('switchProfile');
  if(switchBtn){
    switchBtn.textContent='Se déconnecter';
    switchBtn.onclick=()=>{clearAppSession();location.reload()};
  }

  const enter=$('enterBtn');
  if(enter)enter.onclick=async()=>{
    enter.disabled=true;
    try{
      if(await resumePersonalAccount()){
        $('splash')?.classList.add('hidden');
        $('auth')?.classList.add('hidden');
        if(typeof loadCloud==='function')await loadCloud();
        originalStartApp();
      }else{
        $('splash')?.classList.add('hidden');
        buildLogin();
      }
    }finally{enter.disabled=false}
  };

  window.startApp=function(){
    if(!profileId){buildLogin();return}
    return originalStartApp();
  };

  $('profileScreen')?.classList.add('hidden');
})();
