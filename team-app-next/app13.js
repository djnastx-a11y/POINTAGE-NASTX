(()=>{
const ADM=new Set(['jb','coco','ingrid']);
async function rpc(n,b={}){const s=await ensureSession();if(!s)throw new Error('Session expirée');const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${n}`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(b)});const t=await r.text();if(!r.ok)throw new Error(t||`Erreur ${r.status}`);return t?JSON.parse(t):null}
function allowed(){const p=currentProfile();return !!(p?.admin&&ADM.has(String(profileId||'').toLowerCase()))}
async function okFor(cb){adminUnlockedUntil=Date.now()+9*60*1000;closeModal();try{if(typeof window.refreshAdminData==='function')await window.refreshAdminData()}catch(e){console.error(e)}cb()}
async function recoveryForCurrent(msg,btn){
  const s=getSession?.();let email=s?.user?.email||'';
  if(!email&&s?.access_token){try{const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`}});if(r.ok)email=(await r.json())?.email||''}catch{}}
  if(!email){msg.textContent='Adresse email introuvable. Déconnecte-toi puis utilise « Mot de passe oublié ? » sur l’écran de connexion.';return}
  btn.disabled=true;
  try{
    if(typeof window.requestPasswordRecovery==='function')await window.requestPasswordRecovery(email);
    else{const redirect=encodeURIComponent(`${location.origin}${location.pathname}`);const r=await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${redirect}`,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email})});if(!r.ok)throw new Error(await r.text())}
    msg.textContent=`Email de réinitialisation envoyé à ${email}.`;
  }catch(e){msg.textContent=e.message||'Réinitialisation impossible.'}
  finally{btn.disabled=false}
}
function unlock(cb){
  openModal(`<div class="modal light"><div class="modalHead"><b>Accès administrateur</b><button class="closeBtn" data-close>✕</button></div><div class="pageSub">C’est le même mot de passe que celui de ta connexion. Aucun autre code ni PIN.</div><label>Mot de passe</label><input id="secUnlock" type="password" autocomplete="current-password" maxlength="64" placeholder="Ton mot de passe"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" class="smallBtn" id="secShow">Afficher le mot de passe</button><button type="button" class="smallBtn light" id="secForgot">Mot de passe oublié ?</button></div><div class="modalActions"><button class="smallBtn" data-close>Annuler</button><button class="smallBtn light" id="secUnlockBtn">Continuer</button></div><div id="secMsg" class="sync" style="text-align:center"></div></div>`);
  const input=$('secUnlock'),btn=$('secUnlockBtn'),msg=$('secMsg'),show=$('secShow'),forgot=$('secForgot');
  show.onclick=()=>{const visible=input.type==='text';input.type=visible?'password':'text';show.textContent=visible?'Afficher le mot de passe':'Masquer le mot de passe';input.focus()};
  forgot.onclick=()=>recoveryForCurrent(msg,forgot);
  const submit=async()=>{const code=input.value;if(code.length<8||code.length>64){msg.textContent='Entre ton mot de passe habituel.';return}btn.disabled=true;try{if(await rpc('team_unlock_admin',{code})!==true){msg.textContent='Mot de passe incorrect. Après 5 erreurs, l’accès est bloqué 15 minutes.';return}if(await rpc('team_is_admin',{})!==true)throw new Error('Accès administrateur non confirmé.');await okFor(cb)}catch(e){msg.textContent=e.message||'Accès administrateur impossible.'}finally{btn.disabled=false}};
  btn.onclick=submit;input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();submit()}};setTimeout(()=>input.focus(),80)
}
window.requireAdmin=async function(cb){if(!allowed()){toast('Accès réservé à JB, Coco et Ingrid');return}try{if(await rpc('team_is_admin',{})===true){adminUnlockedUntil=Date.now()+9*60*1000;try{if(typeof window.refreshAdminData==='function')await window.refreshAdminData()}catch(e){console.error(e)}cb();return}unlock(cb)}catch(e){toast(e.message||'Accès administrateur impossible')}};
window.openPinModal=cb=>window.requireAdmin(cb);
})();