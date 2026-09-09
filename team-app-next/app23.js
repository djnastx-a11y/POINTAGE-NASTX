(()=>{
  const STYLE_ID='v23-password-style';
  const TOOLS_ID='authPasswordToolsV23';
  let observer=null,scheduled=false;

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');
    s.id=STYLE_ID;
    s.textContent=`
      .v23PasswordTools{display:flex!important;gap:8px;flex-wrap:wrap;align-items:center;margin:9px 0 4px}
      .v23PasswordTools button{display:inline-flex!important;align-items:center;justify-content:center;min-height:38px;padding:8px 12px;border:1px solid #d9ccbb;border-radius:12px;background:#fffaf2;color:#211d19;font:800 11px/1.1 inherit;cursor:pointer;box-shadow:none}
      .v23PasswordTools button.v23Forgot{background:#eee5d8}
      .v23PasswordTools button:active{transform:translateY(1px)}
      @media(max-width:430px){.v23PasswordTools{display:grid!important;grid-template-columns:1fr 1fr}.v23PasswordTools button{width:100%;padding:8px 7px;font-size:10px}}
    `;
    document.head.appendChild(s);
  }

  async function recover(email){
    if(typeof window.requestPasswordRecovery==='function')return window.requestPasswordRecovery(email);
    const clean=String(email||'').trim();
    if(!clean)throw new Error('Entre d’abord ton adresse email.');
    const redirect=encodeURIComponent(`${location.origin}${location.pathname}`);
    const r=await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${redirect}`,{
      method:'POST',
      headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({email:clean})
    });
    const text=await r.text();
    if(!r.ok)throw new Error(text||'Impossible d’envoyer l’email de réinitialisation.');
    return true;
  }

  function loginFields(){
    return {
      input:document.getElementById('teamPassword')||document.getElementById('authPassword'),
      email:document.getElementById('teamEmail')||document.getElementById('authEmail'),
      msg:document.getElementById('teamLoginMsg')||document.getElementById('authMsg')
    };
  }

  function mount(){
    scheduled=false;
    ensureStyle();
    const auth=document.getElementById('auth');
    const {input,email,msg}=loginFields();
    if(!auth||!input)return;

    const old=document.getElementById('authPasswordTools');
    if(old)old.remove();

    let tools=document.getElementById(TOOLS_ID);
    if(tools&&tools.previousElementSibling!==input){tools.remove();tools=null}
    if(!tools){
      tools=document.createElement('div');
      tools.id=TOOLS_ID;
      tools.className='v23PasswordTools';

      const toggle=document.createElement('button');
      toggle.type='button';
      toggle.dataset.passwordToggle='1';
      toggle.textContent='AFFICHER LE MOT DE PASSE';
      toggle.addEventListener('click',()=>{
        const show=input.type==='password';
        input.type=show?'text':'password';
        toggle.textContent=show?'MASQUER LE MOT DE PASSE':'AFFICHER LE MOT DE PASSE';
        input.focus();
      });

      const forgot=document.createElement('button');
      forgot.type='button';
      forgot.className='v23Forgot';
      forgot.textContent='MOT DE PASSE OUBLIÉ ?';
      forgot.addEventListener('click',async()=>{
        const value=email?.value?.trim()||'';
        if(!value){if(msg)msg.textContent='Entre d’abord ton adresse email.';email?.focus();return}
        forgot.disabled=true;
        try{await recover(value);if(msg)msg.textContent='Email de réinitialisation envoyé. Ouvre le lien reçu pour choisir un nouveau mot de passe.'}
        catch(e){if(msg)msg.textContent=e?.message||'Réinitialisation impossible.'}
        finally{forgot.disabled=false}
      });

      tools.append(toggle,forgot);
      input.insertAdjacentElement('afterend',tools);
    }
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    setTimeout(mount,0);
  }

  mount();
  const auth=document.getElementById('auth');
  if(auth){observer=new MutationObserver(schedule);observer.observe(auth,{childList:true,subtree:true})}
  window.addEventListener('pageshow',schedule);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
  setTimeout(schedule,250);
  setTimeout(schedule,1000);
})();