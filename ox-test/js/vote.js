(function(){
const {t,tn,num}=I18N;
const $=s=>document.querySelector(s);
const params=new URLSearchParams(location.search||'');
const ID=params.get('id');
DB.mergeUserReports();
const C=DB.complaints.find(x=>x.id===ID)||DB.complaints[0];
const CITY=[22.8103,89.5626];
const VOTER_NAMES=['রফিক','সালমা','জাহিদ','নুসরাত','কামাল','মিতু','সজীব','ফারহানা'];
function titleOf(c){return I18N.lang==='bn'?c.title_bn:c.title_en;}
function addrOf(c){return I18N.lang==='bn'?c.addr_bn:c.addr_en;}
function votedIds(){try{return JSON.parse(localStorage.getItem('ns_voted')||'[]');}catch(e){return[]}}
function toggleVoted(id){const v=votedIds();const i=v.indexOf(id);if(i>=0)v.splice(i,1);else v.push(id);localStorage.setItem('ns_voted',JSON.stringify(v));return i<0;}
function distKm(lat,lng){const dLa=(lat-CITY[0])*111.32,dLo=(lng-CITY[1])*111.32*Math.cos(CITY[0]*Math.PI/180);return Math.sqrt(dLa*dLa+dLo*dLo);}
function timeAgoStr(c){return UI.timeAgo((Date.now()-c.createdAt)/3600e3);}
function stageIdx(c){if(c.status==='done')return 5;if(c.status==='in_progress')return 4;if(c.status==='rejected')return 1;return 3;}
const STAGES=['stage.submitted','stage.aiVerified','stage.classified','stage.routed','stage.inProgress','stage.resolved'];

function render(){
 const voted=votedIds().includes(C.id);
 const boostStep=C.votes%10,boostPct=boostStep*10;
 const similar=DB.complaints.filter(x=>x.id!==C.id&&x.cat===C.cat&&distKm(x.lat,x.lng)<=2.5).slice(0,3);
 const em={road:'🛣️',water:'🚰',electricity:'💡',gas:'🔥',sanitation:'🗑️',streetlight:'🔦',other:'🔧'}[C.cat]||'📋';
 const photo=C.photo?'<img src="'+C.photo+'" alt="">':'';
 const sla=UI.slaInfo(C);
 $('#voteMain').innerHTML=
 '<div class="vote-hero">'
 +'<div class="vh-photo">'+photo+'<div class="vh-em">'+em+'</div></div>'
 +'<div class="vh-head"><div class="vh-top"><span class="cid">'+C.id+'</span>'+UI.badge(C.status)+'<span class="chip" style="padding:3px 10px;font-size:11px">'+t('cat.'+C.cat)+'</span></div>'
 +'<h1>'+UI.esc(titleOf(C))+'</h1>'
 +'<p class="muted small" style="display:flex;gap:6px;align-items:flex-start;margin-top:6px">📍 '+UI.esc(addrOf(C))+' · '+tn('c.kmAway',{n:num(distKm(C.lat,C.lng).toFixed(1))})+' · '+timeAgoStr(C)+'</p></div>'
 +'</div>'

 +'<div class="vote-grid">'
 +'<div>'
 +'<div class="vote-card">'
  +'<div class="vc-left"><span class="vc-count">'+num(C.votes)+'</span><span class="tiny muted">'+t('c.votes')+'</span></div>'
  +'<div class="vc-right">'
   +'<button class="vote-big'+(voted?' voted':'')+'" id="vBtn">'+(voted?'✓ '+t('detail.voted'):'👍 '+t('detail.vote'))+'</button>'
   +'<div class="vprog"><i style="width:'+boostPct+'%"></i></div>'
   +'<p class="tiny muted" style="margin-top:6px">'+t('vote.boost')+' · <b style="color:#A87F2E">'+num(10-boostStep)+' '+t('vote.need')+'</b></p>'
  +'</div></div>'
 +'<div class="voters-row">'+VOTER_NAMES.slice(0,5).map((n,i)=>'<span class="vavatar" style="background:'+['#1E5240','#D9A441','#0284C7','#7C3AED','#DC2626'][i]+'">'+n[0]+'</span>').join('')+'<span class="tiny muted"><b>'+num(C.votes+124)+'</b> '+t('vote.voters')+'</span>'
  +'<button class="btn btn-outline btn-sm" id="vShare" style="margin-left:auto">'+UI.icon('share','',14)+' '+t('vote.share')+'</button></div>'

 +'<div class="panel" style="margin-top:16px"><h4>🤖 '+t('detail.aiSum')+'</h4>'
  +'<div class="ai-strip">'
   +'<div><b>'+Math.round((C.ai.classConf||0)*100)+'%</b><span>'+t('detail.confidence')+'</span></div>'
   +'<div>'+UI.prio(C.priority,'lg')+'<span>'+t('detail.priorityScore')+'</span></div>'
   +'<div><b>'+t('cat.'+C.cat)+'</b><span>SLA '+num(C.slaH)+' '+t('common.hours')+'</span></div>'
   +'<div><span class="sla '+sla.cls+'">'+UI.icon('clock','',14)+' '+(C.status==='done'?'✓':sla.txt)+'</span><span>'+t('d.tbl.sla')+'</span></div>'
  +'</div>'
  +'<p class="tiny" style="color:#7C3AED;font-weight:700;margin-top:9px">🤖 '+t('vote.aiNote')+'</p></div>'

 +'<div class="panel" style="margin-top:16px"><h4>'+t('detail.timeline')+'</h4><div class="tl">'
  +STAGES.map((s,i)=>{const si=stageIdx(C);let cl=i<si?'done':i===si?'now':'';if(C.status==='rejected'&&i>0)cl='';return '<div class="tl-item '+cl+'"><b class="small">'+t(s)+'</b></div>';}).join('')
  +'</div></div>'
 +'</div>'

 +'<div>'
 +'<div class="panel"><h4>📍 '+t('vote.similar')+'</h4>'
  +(similar.length?similar.map(s=>'<a class="sim-item" href="vote.html?id='+s.id+'"><span class="cico" style="background:'+DB.CATS[s.cat].color+'">'+em+'</span><span style="flex:1;min-width:0"><b>'+UI.esc(titleOf(s))+'</b><span class="tiny muted">'+s.id+' · '+tn('c.kmAway',{n:num(distKm(s.lat,s.lng).toFixed(1))})+'</span></span><span class="votes-sm">👍 '+num(s.votes)+'</span></a>').join(''):'<p class="small muted">'+t('empty.msg')+'</p>')
  +'</div>'
 +'<div class="panel" style="margin-top:16px"><h4>🏛 '+t('d.dt.lgi')+'</h4><p class="small">'+UI.esc(C.lgi)+'</p><p class="tiny muted">'+UI.esc(addrOf(C))+'</p></div>'
 +'</div>'
 +'</div>';

 $('#vBtn').addEventListener('click',()=>{
  const now=toggleVoted(C.id);C.votes+=now?1:-1;if(C.votes<0)C.votes=0;
  UI.toast(now?'👍 +1':'👍');render();
 });
 $('#vShare').addEventListener('click',async()=>{
  const txt=C.id+' — '+titleOf(C)+' | নাগরিক সেবা';
  try{if(navigator.share){await navigator.share({title:'Nagorik Sheba',text:txt});return;}}catch(e){}
  try{await navigator.clipboard.writeText(txt);UI.toast('🔗 কপি হয়েছে');}catch(e){UI.toast(txt);}
 });
}
render();
document.querySelectorAll('[data-plang]').forEach(b=>b.addEventListener('click',()=>I18N.setLang(b.dataset.plang)));
document.addEventListener('langchange',()=>render());
})();
