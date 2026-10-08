(()=>{
  const mapError=raw=>{
    const s=String(raw||'');
    let seconds='';
    try{const j=JSON.parse(s);const m=String(j.msg||j.message||'');const x=m.match(/after\s+(\d+)\s+seconds?/i);if(x)seconds=x[1];if(j.error_code==='over_email_send_rate_limit')return seconds?`Trop de demandes. Réessaie dans ${seconds} secondes.`:'Trop de demandes. Réessaie dans une minute.'}catch{}
    const x=s.match(/after\s+(\d+)\s+seconds?/i);if(x)return `Trop de demandes. Réessaie dans ${x[1]} secondes.`;
    if(/over_email_send_rate_limit|email rate limit exceeded/i.test(s))return 'Trop de demandes. Réessaie dans une minute.';
    if(/invalid login credentials/i.test(s))return 'Email ou mot de passe incorrect.';
    if(/already|registered|exists/i.test(s))return 'Un compte existe déjà avec cet email.';
    return 'Une erreur est survenue. Réessaie dans quelques instants.';
  };

  const baseRecovery=window.requestPasswordRecovery;
  window.requestPasswordRecovery=async function(email){
    try{return await baseRecovery(email)}catch(e){throw new Error(mapError(e?.message||e))}
  };

  async function rpc(name,body={}){
    const s=await ensureSession();if(!s)throw new Error('Session expirée');
    const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const t=await r.text();if(!r.ok)throw new Error(t||'Erreur');return t?JSON.parse(t):null;
  }

  function inviteUrl(token){return `${location.origin}${location.pathname}?invite=${encodeURIComponent(token)}`}

  async function createInvite(username){
    try{
      const token=await rpc('team_create_invite',{requested_username:username});
      const url=inviteUrl(token);
      openModal(`<div class="modal light"><div class="modalHead"><b>Lien d’invitation</b><button class="closeBtn" data-close>✕</button></div><div class="pageSub">Lien personnel valable 24 h et utilisable une seule fois.</div><input id="teamInviteLink" readonly value="${escapeAttr(url)}"><div class="modalActions"><button class="smallBtn" data-close>Fermer</button><button class="smallBtn light" id="copyInviteLink">COPIER LE LIEN</button></div></div>`);
      $('copyInviteLink').onclick=async()=>{try{await navigator.clipboard.writeText(url);toast('Lien copié')}catch{const i=$('teamInviteLink');i.select();document.execCommand('copy');toast('Lien copié')}};
    }catch(e){
      if(String(e.message||'').includes('admin_code_required')){requireAdmin(()=>createInvite(username));return}
      toast('Impossible de créer le lien d’invitation');
    }
  }

  function enhanceAccounts(){
    const box=document.getElementById('accountsList');if(!box)return;
    box.querySelectorAll('.listRow').forEach(row=>{
      const name=row.querySelector('.listMain b')?.textContent.trim();const pill=row.querySelector('.statePill')?.textContent.trim();
      if(!name||pill!=='LIBRE'||row.querySelector('[data-invite-user]'))return;
      const id=({JB:'jb',Louella:'louella',Gillou:'gillou',Cyril:'cyril','Chloé':'chloe',Ingrid:'ingrid',Coco:'coco',Nico:'nico'})[name];
      if(!id||id==='jb')return;
      const b=document.createElement('button');b.className='smallBtn light';b.dataset.inviteUser=id;b.textContent='INVITER';b.style.marginLeft='8px';b.onclick=()=>createInvite(id);row.appendChild(b);
    });
  }
  const accountBox=document.getElementById('accountsList');if(accountBox)new MutationObserver(enhanceAccounts).observe(accountBox,{childList:true,subtree:true});
  setInterval(enhanceAccounts,1500);

  async function showInvite(){
    const token=new URLSearchParams(location.search).get('invite');if(!token)return;
    const auth=document.getElementById('auth');if(!auth)return;
    auth.className='auth accountAuth';
    auth.innerHTML=`<div class="authBox"><h2>Créer mon compte équipe</h2><p>Invitation Australia Street.</p><label>Email</label><input id="inviteEmail" type="email" autocomplete="email" placeholder="adresse@email.fr"><label style="margin-top:12px">Mot de passe</label><input id="invitePass" type="password" autocomplete="new-password" placeholder="8 caractères minimum"><button class="btn3d light" id="inviteCreate">CRÉER MON COMPTE</button><div class="sync" id="inviteMsg" style="margin-top:12px;text-align:center"></div></div>`;
    const btn=$('inviteCreate'),msg=$('inviteMsg');
    btn.onclick=async()=>{
      const email=$('inviteEmail').value.trim().toLowerCase(),password=$('invitePass').value;
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){msg.textContent='Entre une adresse email valide.';return}
      if(password.length<8){msg.textContent='Le mot de passe doit contenir au moins 8 caractères.';return}
      btn.disabled=true;msg.textContent='Création du compte…';
      try{
        const r=await fetch(`${SUPABASE_URL}/functions/v1/team-invite-signup`,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({token,email,password})});
        const j=await r.json().catch(()=>({}));
        if(!r.ok){const labels={invite_invalid:'Ce lien d’invitation est invalide ou expiré.',email_already_exists:'Un compte existe déjà avec cet email.',invalid_email:'Adresse email invalide.',invalid_password:'Mot de passe invalide.'};throw new Error(labels[j.error]||'Création impossible.')}
        history.replaceState({},document.title,location.pathname);
        msg.textContent='Compte créé. Tu peux maintenant te connecter.';
        btn.textContent='REVENIR À LA CONNEXION';btn.disabled=false;btn.onclick=()=>location.reload();
      }catch(e){msg.textContent=e.message||'Création impossible.';btn.disabled=false}
    };
  }
  setTimeout(showInvite,300);
})();