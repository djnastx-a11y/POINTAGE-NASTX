(()=>{
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
    #auth.accountAuth .accountAlt{display:grid;gap:9px;margin-top:10px}
    #auth.accountAuth .accountHint{font-size:11px;line-height:1.45;color:#7b7065!important;text-align:center;margin-top:10px}
  `;
  document.head.appendChild(css);

  const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());

  async function teamMemberForSession(){
    const s=await ensureSession();if(!s?.user?.id)return null;
    const r=await fetch(`${SUPABASE_URL}/rest/v1/team_members?select=user_id,username,display_name,role,active,must_change_pin&user_id=eq.${encodeURIComponent(s.user.id)}&limit=1`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`}});
    if(!r.ok)return null;const rows=await r.json().catch(()=>[]);return rows[0]||null;
  }

  async function signupRequestForSession(){
    const s=await ensureSession();if(!s?.user?.id)return null;
    const r=await fetch(`${SUPABASE_URL}/rest/v1/team_signup_requests?select=user_id,email,status,assigned_username,requested_at&user_id=eq.${encodeURIComponent(s.user.id)}&limit=1`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`}});
    if(!r.ok)return null;const rows=await r.json().catch(()=>[]);return rows[0]||null;
  }

  function applyMember(member){
    if(!member?.active||member.must_change_pin)return false;
    const id=String(member.username||'').toLowerCase();const known=EMPLOYEES.find(e=>e.id===id);if(!known)return false;
    profileId=id;localStorage.setItem(PROFILE_KEY,id);known.name=member.display_name||known.name;known.admin=member.role==='admin'&&ADMIN_IDS.has(id);return true;
  }

  function clearAppSession(){localStorage.removeItem(AUTH_KEY);localStorage.removeItem(PROFILE_KEY);profileId=''}
  function storeAuth(j){saveSession({access_token:j.access_token,refresh_token:j.refresh_token,expires_at:Date.now()+((j.expires_in||3600)*1000),user:j.user})}

  async function enterApprovedAccount(member){
    if(!applyMember(member))throw new Error('Ce compte n’est pas autorisé pour l’application équipe.');
    $('auth').classList.add('hidden');$('auth').classList.remove('accountAuth');$('splash')?.classList.add('hidden');
    if(typeof loadCloud==='function')await loadCloud();originalStartApp();
  }

  function buildWaiting(req){
    const auth=$('auth');auth.className='auth accountAuth';
    const rejected=req?.status==='rejected';
    auth.innerHTML=`<div class="authBox"><h2>${rejected?'Accès non validé':'Compte créé'}</h2><p>${rejected?'Cette demande n’a pas été validée par un administrateur.':'Ton compte existe avec ton email et ton mot de passe. Un administrateur doit simplement l’associer une fois à ton prénom dans l’équipe.'}</p><div class="card" style="padding:13px;margin-top:12px"><b>${escapeHtml(req?.email||getSession()?.user?.email||'')}</b><div class="accountHint" style="text-align:left">${rejected?'Aucune donnée de l’équipe n’est accessible.':'En attente de validation. Tu garderas exactement ce mail et ce mot de passe.'}</div></div>${rejected?'':`<button class="btn3d light" id="checkAccessBtn">VÉRIFIER MON ACCÈS</button>`}<div class="accountAlt"><button class="smallBtn light" id="pendingLogoutBtn">SE DÉCONNECTER</button></div><div class="sync" id="pendingMsg" style="margin-top:12px;text-align:center"></div></div>`;
    if(!rejected)$('checkAccessBtn').onclick=refreshPendingAccess;
    $('pendingLogoutBtn').onclick=()=>{clearAppSession();buildLogin()};
  }

  async function refreshPendingAccess(){
    const btn=$('checkAccessBtn'),msg=$('pendingMsg');if(btn)btn.disabled=true;if(msg)msg.textContent='Vérification…';
    try{const member=await teamMemberForSession();if(member){await enterApprovedAccount(member);return}const req=await signupRequestForSession();if(req?.status==='rejected'){buildWaiting(req);return}if(msg)msg.textContent='Toujours en attente de validation par un administrateur.'}
    catch(e){if(msg)msg.textContent=e?.message||'Vérification impossible.'}finally{if(btn)btn.disabled=false}
  }

  async function handleCurrentSession(){
    const member=await teamMemberForSession();if(member){await enterApprovedAccount(member);return 'active'}
    const req=await signupRequestForSession();if(req){buildWaiting(req);return req.status}
    clearAppSession();throw new Error('Ce compte n’est pas autorisé pour l’application équipe.');
  }

  function buildLogin(){
    const auth=$('auth');auth.className='auth accountAuth';
    auth.innerHTML=`<div class="authBox"><h2>Connexion équipe</h2><p>Un compte personnel par personne. Tu utilises uniquement ton email et ton mot de passe.</p><label>Email</label><input id="teamEmail" name="as-team-email" autocomplete="email" autocapitalize="none" spellcheck="false" type="email" placeholder="prenom@email.fr" maxlength="160"/><label style="margin-top:12px">Mot de passe</label><input id="teamPassword" name="as-team-password" autocomplete="current-password" type="password" placeholder="••••••••" maxlength="64"/><button class="btn3d light" id="teamLoginBtn">SE CONNECTER</button><div class="accountAlt"><button class="smallBtn light" id="teamSignupBtn">CRÉER MON COMPTE</button></div><div class="accountHint">Première fois ? Entre ton email, choisis ton mot de passe puis appuie sur « Créer mon compte ». Aucun code d’activation.</div><div class="sync" id="teamLoginMsg" style="margin-top:12px;text-align:center"></div></div>`;
    $('teamLoginBtn').onclick=loginPersonalAccount;$('teamSignupBtn').onclick=signupPersonalAccount;$('teamPassword').addEventListener('keydown',e=>{if(e.key==='Enter')loginPersonalAccount()});
  }

  async function loginPersonalAccount(){
    const email=$('teamEmail')?.value.trim().toLowerCase()||'',password=$('teamPassword')?.value||'',msg=$('teamLoginMsg');
    if(!validEmail(email)){msg.textContent='Entre une adresse email valide.';return}if(password.length<8){msg.textContent='Le mot de passe doit contenir au moins 8 caractères.';return}
    const btn=$('teamLoginBtn');btn.disabled=true;msg.textContent='Connexion…';
    try{const j=await authRequest('token?grant_type=password',{email,password});storeAuth(j);await handleCurrentSession()}
    catch(e){const raw=String(e?.message||'');msg.textContent=/invalid login credentials/i.test(raw)?'Email ou mot de passe incorrect.':(/email not confirmed/i.test(raw)?'Confirme d’abord ton adresse email depuis le message reçu.':(raw||'Connexion impossible.'))}
    finally{btn.disabled=false}
  }

  async function signupPersonalAccount(){
    const email=$('teamEmail')?.value.trim().toLowerCase()||'',password=$('teamPassword')?.value||'',msg=$('teamLoginMsg');
    if(!validEmail(email)){msg.textContent='Entre ton adresse email.';return}if(password.length<8){msg.textContent='Choisis un mot de passe d’au moins 8 caractères.';return}
    const btn=$('teamSignupBtn');btn.disabled=true;msg.textContent='Création du compte…';
    try{
      await authRequest('signup',{email,password});
      try{const j=await authRequest('token?grant_type=password',{email,password});storeAuth(j);const req=await signupRequestForSession();buildWaiting(req||{email,status:'pending'})}
      catch(loginError){const raw=String(loginError?.message||'');msg.textContent=/email not confirmed/i.test(raw)?'Compte créé. Confirme ton email, puis reviens te connecter avec le même email et le même mot de passe.':'Compte créé. Reviens te connecter avec le même email et le même mot de passe.'}
    }catch(e){const raw=String(e?.message||'');msg.textContent=/already|registered|exists/i.test(raw)?'Un compte existe déjà avec cet email. Utilise « Se connecter ».':(raw||'Création impossible.')}
    finally{btn.disabled=false}
  }

  async function resumePersonalAccount(){
    const s=await ensureSession();if(!s)return false;
    const member=await teamMemberForSession();if(member&&applyMember(member))return 'active';
    const req=await signupRequestForSession();if(req){buildWaiting(req);return 'pending'}
    clearAppSession();return false;
  }

  window.showProfileScreen=function(){$('profileScreen')?.classList.add('hidden');buildLogin()};
  const switchBtn=$('switchProfile');if(switchBtn){switchBtn.textContent='Se déconnecter';switchBtn.onclick=()=>{clearAppSession();location.reload()}};
  const enter=$('enterBtn');if(enter)enter.onclick=async()=>{enter.disabled=true;try{const result=await resumePersonalAccount();$('splash')?.classList.add('hidden');if(result==='active'){$('auth')?.classList.add('hidden');if(typeof loadCloud==='function')await loadCloud();originalStartApp()}else if(!result)buildLogin()}finally{enter.disabled=false}};
  window.startApp=function(){if(!profileId){buildLogin();return}return originalStartApp()};
  $('profileScreen')?.classList.add('hidden');
})();