(()=>{
  const currentUrl=()=>`${location.origin}${location.pathname}`;

  async function recoveryRequest(email){
    const clean=String(email||'').trim();
    if(!clean)throw new Error('Entre ton adresse email.');
    const redirect=encodeURIComponent(currentUrl());
    const r=await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${redirect}`,{
      method:'POST',
      headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({email:clean})
    });
    const text=await r.text();
    if(!r.ok)throw new Error(text||'Impossible d’envoyer l’email de réinitialisation.');
    return true;
  }
  window.requestPasswordRecovery=recoveryRequest;

  function toggleButton(input,label='Afficher le mot de passe'){
    const b=document.createElement('button');
    b.type='button';
    b.className='smallBtn';
    b.textContent=label;
    b.onclick=()=>{
      const show=input.type==='password';
      input.type=show?'text':'password';
      b.textContent=show?'Masquer le mot de passe':label;
      input.focus();
    };
    return b;
  }

  function enhanceLogin(){
    const input=$('authPassword'),email=$('authEmail'),msg=$('authMsg');
    if(!input||$('authPasswordTools'))return;
    const tools=document.createElement('div');
    tools.id='authPasswordTools';
    tools.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-top:8px';
    tools.appendChild(toggleButton(input));
    const forgot=document.createElement('button');
    forgot.type='button';forgot.className='smallBtn light';forgot.textContent='Mot de passe oublié ?';
    forgot.onclick=async()=>{
      const value=email?.value?.trim();
      if(!value){if(msg)msg.textContent='Entre d’abord ton adresse email.';email?.focus();return}
      forgot.disabled=true;
      try{await recoveryRequest(value);if(msg)msg.textContent='Email de réinitialisation envoyé. Ouvre le lien reçu pour choisir un nouveau mot de passe.'}
      catch(e){if(msg)msg.textContent=e.message||'Réinitialisation impossible.'}
      finally{forgot.disabled=false}
    };
    tools.appendChild(forgot);
    input.insertAdjacentElement('afterend',tools);
  }

  async function userFromToken(token){
    const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${token}`}});
    if(!r.ok)throw new Error('Lien de réinitialisation invalide ou expiré.');
    return r.json();
  }

  async function handleRecovery(){
    const hash=new URLSearchParams(location.hash.replace(/^#/,''));
    if(hash.get('type')!=='recovery'||!hash.get('access_token'))return;
    const access=hash.get('access_token'),refresh=hash.get('refresh_token')||'',expires=Number(hash.get('expires_in')||3600);
    try{
      const user=await userFromToken(access);
      saveSession({access_token:access,refresh_token:refresh,expires_at:Date.now()+expires*1000,user});
      openModal(`<div class="modal light"><div class="modalHead"><b>Nouveau mot de passe</b><button class="closeBtn" data-close>✕</button></div><div class="pageSub">Choisis le mot de passe que tu utiliseras ensuite partout dans l’application.</div><label>Nouveau mot de passe</label><input id="recoveryPass1" type="password" autocomplete="new-password" maxlength="64"><label style="margin-top:10px">Confirmer</label><input id="recoveryPass2" type="password" autocomplete="new-password" maxlength="64"><div id="recoveryTools" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"></div><div class="modalActions"><button class="smallBtn" data-close>Annuler</button><button class="smallBtn light" id="recoverySave">Enregistrer</button></div><div id="recoveryMsg" class="sync" style="text-align:center"></div></div>`);
      const p1=$('recoveryPass1'),p2=$('recoveryPass2'),tools=$('recoveryTools');
      tools.appendChild(toggleButton(p1));
      const save=$('recoverySave'),msg=$('recoveryMsg');
      save.onclick=async()=>{
        const a=p1.value,b=p2.value;
        if(a.length<8){msg.textContent='Le mot de passe doit contenir au moins 8 caractères.';return}
        if(a!==b){msg.textContent='Les deux mots de passe ne correspondent pas.';return}
        save.disabled=true;
        try{
          const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{method:'PUT',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${access}`,'Content-Type':'application/json'},body:JSON.stringify({password:a})});
          const text=await r.text();if(!r.ok)throw new Error(text||'Impossible de changer le mot de passe.');
          history.replaceState({},document.title,location.pathname+location.search);
          closeModal();toast('Mot de passe modifié');
        }catch(e){msg.textContent=e.message||'Modification impossible.'}
        finally{save.disabled=false}
      };
    }catch(e){const msg=$('authMsg');if(msg)msg.textContent=e.message||'Lien de réinitialisation invalide.'}
  }

  enhanceLogin();
  handleRecovery();
})();