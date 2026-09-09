(()=>{
  let month=new Date();
  month=new Date(month.getFullYear(),month.getMonth(),1,12,0,0,0);
  let renderSeq=0,targetMinutes=null;

  const style=document.createElement('style');
  style.textContent=`
    .v22Wrap{margin-top:12px}.v22Toolbar{display:grid;grid-template-columns:54px 1fr 54px;gap:10px;align-items:center;margin:14px 0 18px}.v22Nav{height:54px;border:1px solid #d8cbbb;border-radius:16px;background:#eee4d7;color:#211d19;font-size:28px;font-weight:800}.v22Month{height:54px;border:1px solid #d8cbbb;border-radius:16px;background:#fffaf3;color:#211d19;text-align:center;font-size:16px;font-weight:900;padding:0 12px}.v22SectionTitle{margin:20px 2px 10px;font-size:10px;font-weight:950;letter-spacing:.16em;color:#8b7e70}.v22Weeks{display:grid;gap:9px}.v22Week{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:14px 16px;border:1px solid #ded2c3;border-radius:17px;background:#fffaf3;box-shadow:0 4px 12px rgba(53,42,29,.04)}.v22Week.current{background:#f1e8dc;border-color:#cbbba7}.v22WeekDates{font-size:13px;font-weight:950;color:#27221d}.v22WeekGoal{margin-top:5px;font-size:10px;color:#766b60}.v22WeekHours{font-family:Georgia,serif;font-size:28px;color:#56493e;white-space:nowrap}.v22Weekdays,.v22Grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}.v22Weekdays span{text-align:center;font-size:9px;font-weight:950;color:#85796d;padding:4px 0}.v22Day{position:relative;min-height:70px;border:1px solid #e1d6c8;border-radius:13px;background:#fffdf9;color:#211d19;padding:8px 6px;text-align:left;touch-action:manipulation}.v22Day.blank{visibility:hidden}.v22Day.future{opacity:.38;pointer-events:none}.v22Day.today{outline:2px solid #211d19;outline-offset:1px}.v22Day.hasWork{background:#eee4d7;border-color:#cabaa6}.v22Day.incomplete{background:#f1dfc8;border-color:#b79a76}.v22Day b{display:block;font-size:13px}.v22Day small{display:block;margin-top:10px;font-size:9px;font-weight:950;color:#6c6156;line-height:1.15}.v22Dot{position:absolute;top:9px;right:9px;width:7px;height:7px;border-radius:50%;background:#211d19}.v22Hint{margin:12px 2px 0;font-size:11px;line-height:1.45;color:#74695e}.v22Error{padding:14px;border:1px solid #d8cbbb;border-radius:15px;background:#fffaf3;color:#6a5e52;font-size:12px}.v22Loading{padding:18px;text-align:center;color:#7d7165;font-size:12px}.v22HeadSub{margin-top:4px;color:#7d7165;font-size:13px}.v22MonthTotal{margin:16px 0 4px;display:grid;grid-template-columns:1fr 1fr;gap:9px}.v22Metric{border:1px solid #ded2c3;border-radius:17px;background:#fffaf3;padding:14px}.v22Metric b{display:block;font-size:25px;color:#211d19}.v22Metric span{display:block;margin-top:5px;font-size:9px;font-weight:950;letter-spacing:.09em;color:#887b6e}@media(max-width:430px){.v22Toolbar{grid-template-columns:48px 1fr 48px}.v22Nav,.v22Month{height:50px}.v22Day{min-height:62px;padding:7px 5px}.v22Day small{font-size:8px}.v22Week{padding:13px}.v22WeekHours{font-size:25px}}
  `;
  document.head.appendChild(style);

  const pad2=n=>String(n).padStart(2,'0');
  const ds=d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  const parseDs=s=>new Date(`${s}T12:00:00`);
  const today=()=>ds(new Date());
  const monday=d=>{const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
  const fmtMinutes=m=>{const n=Math.max(0,Math.floor(Number(m)||0));return`${Math.floor(n/60)}h${pad2(n%60)}`};
  const shortDate=d=>d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
  const monthLabel=d=>d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});

  async function rpc(name,body={}){
    const s=await ensureSession();if(!s)throw new Error('Session expirée. Reconnecte-toi.');
    const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const text=await r.text();if(!r.ok)throw new Error(text||`Erreur ${r.status}`);return text?JSON.parse(text):null;
  }
  async function loadTarget(){
    const s=await ensureSession(),uid=userId();if(!s||!uid)return null;
    const r=await fetch(`${SUPABASE_URL}/rest/v1/team_hour_targets?select=weekly_target_minutes&user_id=eq.${encodeURIComponent(uid)}&limit=1`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`}});
    if(!r.ok)return null;const rows=await r.json();return rows[0]?Number(rows[0].weekly_target_minutes||0):null;
  }
  function pauseMs(row,endMs){
    let total=0;for(const p of Array.isArray(row?.pauses)?row.pauses:[]){if(!p?.start)continue;const a=new Date(p.start).getTime(),b=p.end?new Date(p.end).getTime():endMs;if(Number.isFinite(a)&&Number.isFinite(b)&&b>a)total+=b-a}return total;
  }
  function rowMinutes(row){
    if(!row?.started_at||row.manual_incomplete)return 0;
    const start=new Date(row.started_at).getTime();let end=row.ended_at?new Date(row.ended_at).getTime():Date.now();
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return 0;
    return Math.max(0,Math.floor((end-start-pauseMs(row,end))/60000));
  }
  function rowDate(row){
    const p=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(row.started_at)),o={};p.forEach(x=>{if(x.type!=='literal')o[x.type]=x.value});return`${o.year}-${o.month}-${o.day}`;
  }
  function monthOptions(){const now=new Date(),out=[];for(let i=-24;i<=18;i++){const d=new Date(now.getFullYear(),now.getMonth()+i,1,12);out.push(`<option value="${ds(d).slice(0,7)}">${monthLabel(d)}</option>`)}return out.join('')}

  function shell(){
    const view=$('view-hours');if(!view)return null;
    view.innerHTML=`<h1 class="pageTitle">Mes pointages</h1><div class="v22HeadSub">Totaux semaine par semaine et détail par jour.</div><div class="v22Wrap"><div class="v22Toolbar"><button type="button" class="v22Nav" id="v22Prev">‹</button><select class="v22Month" id="v22Month">${monthOptions()}</select><button type="button" class="v22Nav" id="v22Next">›</button></div><div id="v22Body"><div class="v22Loading">Chargement de tes pointages…</div></div></div>`;
    if($('topTitle'))$('topTitle').textContent='Mes pointages';
    const select=$('v22Month');select.value=`${month.getFullYear()}-${pad2(month.getMonth()+1)}`;
    $('v22Prev').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1,12);render()};
    $('v22Next').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1,12);render()};
    select.onchange=()=>{const[y,m]=select.value.split('-').map(Number);month=new Date(y,m-1,1,12);render()};
    return $('v22Body');
  }

  async function render(){
    const body=shell();if(!body)return;const seq=++renderSeq;
    const y=month.getFullYear(),m=month.getMonth(),first=new Date(y,m,1,12),last=new Date(y,m+1,0,12),rangeStart=monday(first),rangeEnd=monday(last);rangeEnd.setDate(rangeEnd.getDate()+6);
    try{
      const [rows,tgt]=await Promise.all([rpc('team_self_pointages_range',{from_date:ds(rangeStart),to_date:ds(rangeEnd)}),targetMinutes===null?loadTarget():Promise.resolve(targetMinutes)]);
      if(seq!==renderSeq)return;if(tgt!==null)targetMinutes=tgt;
      const data=Array.isArray(rows)?rows:[],byDay=new Map();
      for(const r of data){const key=rowDate(r),x=byDay.get(key)||{minutes:0,count:0,incomplete:false,active:false};x.minutes+=rowMinutes(r);x.count++;if(r.manual_incomplete)x.incomplete=true;if(!r.ended_at&&!r.manual_incomplete)x.active=true;byDay.set(key,x)}
      let monthMinutes=0,workedDays=0;for(const [key,x] of byDay){if(key.slice(0,7)===`${y}-${pad2(m+1)}`){monthMinutes+=x.minutes;if(x.minutes>0||x.incomplete||x.active)workedDays++}}
      const weeks=[];let cursor=new Date(rangeStart),currentStart=ds(monday(new Date()));
      while(cursor<=rangeEnd){const start=new Date(cursor),end=new Date(start);end.setDate(end.getDate()+6);let total=0;for(const r of data){const key=rowDate(r);if(key>=ds(start)&&key<=ds(end))total+=rowMinutes(r)}const target=Number(targetMinutes||0),goal=target>0?(total>=target?`Objectif ${fmtMinutes(target)} · avance ${fmtMinutes(total-target)}`:`Objectif ${fmtMinutes(target)} · reste ${fmtMinutes(target-total)}`):'Objectif hebdomadaire non défini';weeks.push(`<div class="v22Week ${ds(start)===currentStart?'current':''}"><div><div class="v22WeekDates">Du ${shortDate(start)} au ${shortDate(end)}</div><div class="v22WeekGoal">${goal}</div></div><div class="v22WeekHours">${fmtMinutes(total)}</div></div>`);cursor.setDate(cursor.getDate()+7)}
      const offset=(first.getDay()+6)%7,cells=[];for(let i=0;i<offset;i++)cells.push('<div class="v22Day blank"></div>');
      const maxDay=last.getDate(),todayKey=today();for(let day=1;day<=maxDay;day++){const key=`${y}-${pad2(m+1)}-${pad2(day)}`,x=byDay.get(key),future=key>todayKey,detail=x?.incomplete?'Départ à compléter':x?.active&&x.minutes===0?'En cours':x?fmtMinutes(x.minutes):'—';cells.push(`<button type="button" class="v22Day ${x?'hasWork':''} ${x?.incomplete?'incomplete':''} ${key===todayKey?'today':''} ${future?'future':''}" data-v22-day="${key}" ${future?'disabled':''}><b>${day}</b>${x?'<span class="v22Dot"></span>':''}<small>${detail}</small></button>`)}
      body.innerHTML=`<div class="v22MonthTotal"><div class="v22Metric"><b>${fmtMinutes(monthMinutes)}</b><span>CE MOIS</span></div><div class="v22Metric"><b>${workedDays}</b><span>JOURS POINTÉS</span></div></div><div class="v22SectionTitle">TOTAL PAR SEMAINE</div><div class="v22Weeks">${weeks.join('')}</div><div class="v22SectionTitle">DÉTAIL JOUR PAR JOUR</div><div class="v22Weekdays"><span>LUN</span><span>MAR</span><span>MER</span><span>JEU</span><span>VEN</span><span>SAM</span><span>DIM</span></div><div class="v22Grid">${cells.join('')}</div><div class="v22Hint">Appuie sur une journée pour corriger une erreur ou ajouter un oubli. Une arrivée seule peut être enregistrée puis complétée plus tard.</div>`;
      body.querySelectorAll('[data-v22-day]').forEach(b=>{if(b.disabled)return;b.onclick=e=>{e.preventDefault();window.openPersonalCalendarDay?.(b.dataset.v22Day)}});
    }catch(e){if(seq!==renderSeq)return;body.innerHTML=`<div class="v22Error">Impossible de charger tes pointages. Vérifie la connexion puis réessaie.</div>`;console.error(e)}
  }

  const baseHours=window.renderHours;
  window.renderHours=function(...args){const out=typeof baseHours==='function'?baseHours.apply(this,args):undefined;setTimeout(render,0);return out};
  const view=$('view-hours');if(view&&view.classList.contains('active'))render();
  window.renderPersonalPointageCalendar=render;
})();