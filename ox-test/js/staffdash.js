(function(){
const {t,tn,num}=I18N;
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
let ME=null;
try{ME=JSON.parse(sessionStorage.getItem('ns_staff_user')||'null');}catch(e){}
if(!ME){location.href='auth.html';return;}
DB.mergeUserReports();
const LGI=DB.LGIS.find(l=>l.id===ME.lgiId)||DB.LGIS[0];
const TYPE_KEY={city:'staff.tagCity',poura:'staff.tagPoura',union:'staff.tagUnion'};
const TYPE_COLOR={city:'#17402F',poura:'#0284C7',union:'#B45309'};
let CATF='all',SEL=null;
const CHIPS=['all','road','water','electricity','gas','sanitation','streetlight'];
function titleOf(c){return I18N.lang==='bn'?c.title_bn:c.title_en;}
function addrOf(c){return I18N.lang==='bn'?c.addr_bn:c.addr_en;}
function queue(){
 let arr=DB.complaints.filter(c=>c.lgi===LGI.name);
 if(CATF!=='all')arr=arr.filter(c=>c.cat===CATF);
 return arr.slice().sort((a,b)=>{
  const rank=s=>s==='open'?0:s==='in_progress'?1:s==='merged'?2:3;
  return rank(a.status)-rank(b.status)||b.priority-a.priority;
 });
}
function slaLeftH(c){return (c.createdAt+c.slaH*3600e3-Date.now())/3600e3;}

function renderHeader(){
 $('#sdTitle').textContent=(I18N.lang==='bn'?LGI.name_bn:LGI.name)+' — '+t('staff.sub');
 const tc=$('#sdType');
 tc.textContent=t(TYPE_KEY[LGI.type]);
 tc.style.background=TYPE_COLOR[LGI.type];
}
function renderChips(){
 $('#sdChips').innerHTML=CHIPS.map(k=>'<button class="chip'+(CATF===k?' on':'')+'" data-cf="'+k+'">'+(k==='all'?'':DB.CATS[k].icon?'':'')+t(k==='all'?'cat.all':'cat.'+k)+'</button>').join('');
 $$('#sdChips [data-cf]').forEach(b=>b.addEventListener('click',()=>{CATF=b.dataset.cf;SEL=null;render();}));
}
function renderStats(){
 const q=DB.complaints.filter(c=>c.lgi===LGI.name);
 const open=q.filter(c=>c.status==='open').length,prog=q.filter(c=>c.status==='in_progress').length,done=q.filter(c=>c.status==='done').length;
 $('#sdStats').innerHTML=[
  ['staff.total',q.length,'#17402F'],['staff.pending',open,'#D9A441'],['staff.prog',prog,'#0284C7'],['staff.done',done,'#1E5240']
 ].map(x=>'<div class="sd-stat"><b style="color:'+x[2]+'">'+num(x[1])+'</b><span>'+t(x[0])+'</span></div>').join('');
 const pol=Object.keys(LGI.sla).slice(0,5).map(k=>t('cat.'+k)+' '+num(LGI.sla[k])+t('common.hours')).join(' · ');
 $('#sdPolicy').innerHTML='⏱ <b>'+t('staff.slaPolicy')+':</b> '+pol;
}
function slaCell(c){
 if(c.status==='done')return '<span class="sla">✓ '+t('st.done')+'</span>';
 const left=slaLeftH(c);
 const s=UI.slaInfo(c);
 return '<span class="sla '+(s.cls||'')+'">'+UI.icon('clock','',13)+' SLA '+(left<=0?'⚠':esc(left.toFixed(0)))+' '+t('common.hours')+'</span>';
}
function esc(s){return UI.esc(s);}
function renderQueue(){
 const arr=queue();
 const el=$('#sdQueue');
 if(!arr.length){el.innerHTML=UI.emptyState();I18N.applyI18n(el);return;}
 el.innerHTML=arr.map(c=>'<div class="sd-card'+(SEL===c.id?' sel':'')+'" data-sid="'+c.id+'">'
  +'<div class="sd-top"><span class="tiny muted" style="font-weight:700">#'+num(c.id.replace(/\D/g,''))+' · '+t('cat.'+c.cat)+'</span>'
  +'<span style="display:flex;gap:7px;align-items:center">'+UI.prio(c.priority,'sm')+UI.badge(c.status)+'</span></div>'
  +'<b class="sd-tt">'+esc(titleOf(c))+'</b>'
  +'<div class="meta">'+slaCell(c)+' · <span class="votes-sm">👍 '+num(c.votes)+' '+t('staff.votes')+'</span> · '+esc(addrOf(c))+'</div>'
  +'</div>').join('');
 $$('#sdQueue [data-sid]').forEach(cd=>cd.addEventListener('click',()=>{SEL=cd.dataset.sid;renderQueue();renderDetail();}));
}
function renderDetail(){
 const el=$('#sdDetail');
 const c=DB.complaints.find(x=>x.id===SEL);
 if(!c){el.innerHTML='<div class="panel"><p class="muted small" style="text-align:center;padding:26px 8px">👆 '+t('staff.select')+'</p></div>'
  +'<div class="panel" style="margin-top:14px"><h4>👤 '+t('staff.assigned')+'</h4><div class="sd-me"><span class="avatar orange">'+UI.esc((ME.name||'K')[0])+'</span><div><b class="small">'+esc(ME.name)+'</b><div class="tiny muted">'+esc(ME.phone)+'</div></div></div></div>';
  return;}
 const cls=UI.slaInfo(c);
 el.innerHTML='<div class="panel">'
 +'<div class="sd-top" style="margin-bottom:6px"><span class="cid tiny">#'+num(c.id.replace(/\D/g,''))+'</span>'+UI.badge(c.status)+'</div>'
 +'<h3 style="font-size:16px;line-height:1.35;margin-bottom:8px">'+esc(titleOf(c))+'</h3>'
 +'<div class="meta" style="margin-bottom:14px">'+slaCell(c)+' · '+UI.prio(c.priority,'sm')+' · 👍 '+num(c.votes)+'</div>'
 +'<div class="pt-label" style="margin:0 0 8px">👤 '+t('staff.assigned')+'</div>'
 +'<div class="sd-me"><span class="avatar orange">'+esc((ME.name||'K')[0])+'</span><div><b class="small">'+esc(ME.name)+'</b><div class="tiny muted">'+esc(ME.phone)+'</div></div></div>'
 +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">'
  +'<button class="sd-btn gold" id="sdStart" '+(c.status!=='open'?'disabled':'')+'>▶ '+t('staff.start')+'</button>'
  +'<button class="sd-btn green" id="sdResolve" '+(c.status==='done'?'disabled':'')+'>✓ '+t('staff.resolve')+'</button>'
 +'</div>'
 +'<label style="display:block;margin-top:13px"><span class="pt-label" style="margin:0 0 6px">'+t('staff.note')+'</span>'
 +'<textarea class="nc-ta" id="sdNote" style="min-height:64px" placeholder="'+esc(t('staff.notePh'))+'">'+esc(I18N.lang==='bn'?(c.resolution_bn||''):(c.resolution_en||''))+'</textarea><span class="ferr" id="e-sdNote"></span></label>'
 +'</div>'
 +'<div class="panel" style="margin-top:14px"><h4>🤖 '+t('staff.ai')+'</h4>'
 +'<div class="sd-ai"><b>'+t('staff.agentCls')+'</b><span>'+t('cat.'+c.cat)+' · '+Math.round((c.ai.classConf||0)*100)+'% '+t('staff.conf')+'</span></div>'
 +'<div class="sd-ai"><b>'+t('staff.agentRtr')+'</b><span>'+esc(LGI.name)+' '+t('staff.sentTo')+'</span></div>'
 +'<div class="sd-ai"><b>👤 Staff</b><span>'+esc(ME.name)+' · '+t(c.status==='done'?'st.done':c.status==='in_progress'?'st.progress':'st.open')+'</span></div>'
 +'</div>'
 +'<div class="panel" style="margin-top:14px"><h4>📋 COMPLAINT_TRAIL</h4>'
 +(c.trail||[]).slice(-5).reverse().map(tr=>'<div class="trail-item '+(tr.by==='ai'?'ai':'staff')+'"><div class="trail-head"><span class="trail-who">'+(tr.by==='ai'?'🤖 '+esc(tr.agent):'👤 '+esc(tr.staff||ME.name))+'</span><span class="trail-ts">'+UI.timeAgo(Math.abs(tr.h||0.01))+'</span></div><p class="trail-note">'+esc(I18N.lang==='bn'?tr.bn:tr.en)+'</p></div>').join('')
 +'</div>';
 $('#sdStart').addEventListener('click',()=>{
  c.status='in_progress';c.assignee=ME.name;
  DB.saveStaffUpdate(c.id,{status:'in_progress',assignee:ME.name},{by:'staff',staff:ME.name,en:'Status updated: In Progress.',bn:'স্ট্যাটাস হালনাগাদঃ চলমান।',h:-0.001});
  UI.toast('▶ '+t('staff.start'));render();
 });
 $('#sdResolve').addEventListener('click',()=>{
  const note=$('#sdNote').value.trim();
  if(!note){fail('#e-sdNote',t('d.dt.needNotes'));return;}
  c.status='done';c.resolvedAtH=c.ageH;c.resolution_en=note;c.resolution_bn=note;
  DB.saveStaffUpdate(c.id,{status:'done',resolvedAtH:c.ageH,resolution_en:note,resolution_bn:note},{by:'staff',staff:ME.name,en:'Resolved. '+note,bn:'সমাধান। '+note,h:-0.001});
  UI.toast('✓ '+t('staff.resolve'));render();
 });
 function fail(id,msg){const e=$(id);if(e){e.textContent=msg;e.classList.add('show');}}
}
function render(){renderHeader();renderChips();renderStats();renderQueue();renderDetail();}
$('#sdLogout').addEventListener('click',()=>{sessionStorage.removeItem('ns_staff_user');location.href='index.html';});
document.querySelectorAll('[data-plang]').forEach(b=>b.addEventListener('click',()=>I18N.setLang(b.dataset.plang)));
document.addEventListener('langchange',()=>{document.querySelectorAll('[data-plang]').forEach(x=>x.classList.toggle('on',x.dataset.plang===I18N.lang));render();});
render();
})();
