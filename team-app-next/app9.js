(()=>{
  const TEAM_EMAIL_DOMAIN='team.australia.invalid';
  const ADMIN_IDS=new Set(['jb','coco','ingrid']);
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
    #auth.accountAuth .accountAlt{display:grid;gap:9px;margin-top:12px}
    #auth.accountAuth .accountHint{font-size:11px;line-height:1.45;color:#7b7065!important;text-align:center;margin-top:10px}
  `;
  document.head.appendChild(css);

  function authEmailForIdentifier(identifier){
    const raw=String(identifier||'').trim().toLowerCase();
    if(raw.includes('@'))return raw;
    if(raw==='jb')return 'djnastx@gmail.com';
    return `${raw}@${TEAM_EMAIL_DOMAIN}`;
  }

  function validIdentifier(identifier){
    const raw=String(identifier||'').trim().toLowerCase();
    if(/^[a-z0-9._-]{2,32}$/.test(raw))return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
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
    if(!member?.active||member.must_change_pin)return false;
    const id=String(member.username||'').toLowerCase();
    const known=EMPLOYEES.find(e=>e.id===id);
    if(!known)return false;
    profileId=id;
    localStorage.setItem(PROFILE_KEY,id);
    known.name=member.display_name||known.name;
    known.admin=member.role==='admin'&&ADMIN_IDS.has(id);
    return true;
  }

  function clearAppSession(){
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(PROFILE_KEY);
    profileId='';
  }

  async function finishAuthenticatedLogin(identifier,pin){
    const j=await authRequest('token?grant_type=password',{email:authEmailForIdentifier(identifier),password:pin});
    saveSession({access_token:j.access_token,refresh_token:j.refresh_token,expires_at:Date.now()+((j.expires_in||3600)*1000),user:j.user});
    const member=await teamMemberForSession();
    const identifierIsEmail=String(identifier).includes('@');
    if(!member||(!identifierIsEmail&&member.username!==String(identifier).toLowerCase())||!applyMember(member)){
      const pending=!!member?.must_change_pin;
      clearAppSession();
      throw new Error(pending?'Active d’abord ce compte avec « Première connexion ».':'Ce compte n’est pas autorisé pour l’application équipe.');
    }
    $('auth').classList.add('hidden');
    $('auth').classList.remove('accountAuth');
    $('splash')?.classList.add('hidden');
    if(typeof loadCloud==='function')await loadCloud();
    originalStartApp();
  }

  function buildLogin(){
    const auth=$('auth');
    auth.className='auth accountAuth';
    auth.innerHTML=`<div class="authBox">
      <h2>Connexion équipe</h2>
      <p>Chaque personne utilise uniquement son compte personnel. Aucun changement d’utilisateur n’est possible sans se déconnecter.</p>
      <label>Identifiant</label><input id="teamUsername" name="as-team-user" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Ex. coco" maxlength="80"/>
      <label style="margin-top:12px">Code personnel</label><input id="teamPin" name="as-team-code" autocomplete="current-password" inputmode="numeric" pattern="[0-9]*" type="password" placeholder="••••••••" maxlength="12"/>
      <button class="btn3d light" id="teamLoginBtn">SE CONNECTER</button>
      <div class="accountAlt"><button class="smallBtn light" id="teamActivateBtn">PREMIÈRE CONNEXION</button></div>
      <div class="accountHint">La première connexion nécessite le code d’activation remis par l’administrateur.</div>
      <div class="sync" id="teamLoginMsg" style="margin-top:12px;text-align:center"></div>
    </div>`;
    $('teamLoginBtn').onclick=loginPersonalAccount;
    $('teamActivateBtn').onclick=buildActivation;
    $('teamPin').addEventListener('keydown',e=>{if(e.key==='Enter')loginPersonalAccount()});
  }

  function buildActivation(){
    const auth=$('auth');
    auth.className='auth accountAuth';
    auth.innerHTML=`<div class="authBox">
      <h2>Activer mon compte</h2>
      <p>Cette étape se fait une seule fois. Choisis ensuite ton propre code personnel.</p>
      <label>Identifiant</label><input id="activateUsername" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Ex. coco" maxlength="32"/>
      <label style="margin-top:12px">Code d’activation</label><input id="activateCode" inputmode="numeric" pattern="[0-9]*" type="password" placeholder="8 chiffres" maxlength="8"/>
      <label style="margin-top:12px">Mon code personnel</label><input id="activatePersonalCode" autocomplete="new-password" inputmode="numeric" pattern="[0-9]*" type="password" placeholder="8 à 12 chiffres" maxlength="12"/>
      <label style="margin-top:12px">Confirmer mon code</label><input id="activatePersonalCode2" autocomplete="new-password" inputmode="numeric" pattern="[0-9]*" type="password" placeholder="Répète ton code" maxlength="12"/>
      <button class="btn3d light" id="activateBtn">ACTIVER MON COMPTE</button>
      <div class="accountAlt"><button class="smallBtn light" id="backToLoginBtn">RETOUR CONNEXION</button></div>
      <div class="sync" id="activateMsg" style="margin-top:12px;text-align:center"></div>
    </div>`;
    $('activateBtn').onclick=activateAccount;
    $('backToLoginBtn').onclick=buildLogin;
  }

  async function activateAccount(){
    const username=$('activateUsername')?.value.trim().toLowerCase()||'';
    const activationCode=$('activateCode')?.value||'';
    const personalCode=$('activatePersonalCode')?.value||'';
    const personalCode2=$('activatePersonalCode2')?.value||'';
    const msg=$('activateMsg');
    if(!/^(louella|gillou|cyril|chloe|caro|ingrid|coco)$/.test(username)){msg.textContent='Identifiant équipe incorrect.';return}
    if(!/^\d{8}$/.test(activationCode)){msg.textContent='Le code d’activation contient 8 chiffres.';return}
    if(!/^\d{8,12}$/.test(personalCode)){msg.textContent='Choisis un code personnel de 8 à 12 chiffres.';return}
    if(personalCode!==personalCode2){msg.textContent='Les deux codes personnels ne correspondent pas.';return}
    if(personalCode===activationCode){msg.textContent='Ton code personnel doit être différent du code d’activation.';return}
    const btn=$('activateBtn');btn.disabled=true;msg.textContent='Activation…';
    try{
      const r=await fetch(`${SUPABASE_URL}/functions/v1/team-activate-account`,{
        method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({username,activationCode,personalCode})
      });
      const j=await r.json().catch(()=>({}));
      if(!r.ok){
        const labels={activation_invalid:'Code d’activation incorrect ou déjà utilisé.',activation_blocked:'Trop d’essais. Réessaie dans 15 minutes.',personal_code_must_differ:'Choisis un code personnel différent.',account_update_failed:'Impossible de finaliser ce compte.',account_create_failed:'Impossible de créer ce compte.'};
        throw new Error(labels[j.error]||'Activation impossible.');
      }
      msg.textContent='Compte activé. Connexion…';
      await finishAuthenticatedLogin(username,personalCode);
    }catch(e){msg.textContent=e?.message||'Activation impossible.'}finally{btn.disabled=false}
  }

  async function loginPersonalAccount(){
    const identifier=$('teamUsername')?.value.trim().toLowerCase()||'';
    const pin=$('teamPin')?.value||'';
    const msg=$('teamLoginMsg');
    if(!validIdentifier(identifier)){msg.textContent='Entre ton identifiant, par exemple coco.';return}
    if(pin.length<8){msg.textContent='Le code personnel doit contenir au moins 8 chiffres.';return}
    const btn=$('teamLoginBtn');btn.disabled=true;msg.textContent='Connexion…';
    try{await finishAuthenticatedLogin(identifier,pin)}
    catch(e){const raw=String(e?.message||'');msg.textContent=/invalid login credentials/i.test(raw)?'Identifiant ou code incorrect.':(raw||'Connexion impossible.')}
    finally{btn.disabled=false}
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