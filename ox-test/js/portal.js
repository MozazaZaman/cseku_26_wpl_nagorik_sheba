(function(){
const {t,tn,num}=I18N;
const $=s=>document.querySelector(s);
let ME=null;
try{ME=JSON.parse(sessionStorage.getItem('ns_portal_user')||'null');}catch(e){}
if(!ME){location.href='auth.html';return;}
DB.mergeUserReports();
let VIEW='home',Q='',NEAR=null;
const PORTAL_CATS=[
 {k:'road',em:'🛣️',cat:'road'},
 {k:'water',em:'🚰',cat:'water'},
 {k:'elec',em:'💡',cat:'electricity'},
 {k:'gas',em:'🔥',cat:'gas'},
 {k:'waste',em:'🗑️',cat:'sanitation'},
 {k:'toilet',em:'🚽',cat:null,svc:'toilet'},
 {k:'light',em:'🔦',cat:'streetlight'},
 {k:'other',em:'🔧',cat:'other'}
];
const CAT_EM={road:'🛣️',water:'🚰',electricity:'💡',gas:'🔥',sanitation:'🗑️',streetlight:'🔦',other:'🔧'};
function titleOf(c){return I18N.lang==='bn'?c.title_bn:c.title_en;}
function firstName(){return ME.name.split(' ')[0];}
function distKm(lat,lng){const dLa=(lat-22.8103)*111.32,dLo=(lng-89.5626)*111.32*Math.cos(22.8103*Math.PI/180);return Math.sqrt(dLa*dLa+dLo*dLo);}
function tileHref(p){
 if(p.svc)return 'service.html?type='+p.svc;
 return 'new-complaint.html?cat='+p.cat;
}

function pcard(c){
 const em=CAT_EM[c.cat]||'📋';
 return '<div class="pcard" data-open="'+c.id+'">'
 +'<span class="top">#'+num(c.id.replace(/\D/g,''))+' · '+t('cat.'+c.cat)+(NEAR?' · <span class="dist">'+tn('c.kmAway',{n:num(distKm(c.lat,c.lng).toFixed(1))})+'</span>':'')+'</span>'
 +'<span class="mid"><span class="cico" style="background:'+DB.CATS[c.cat].color+'">'+em+'</span><b>'+UI.esc(titleOf(c))+'</b></span>'
 +'<span class="bot">'+UI.badge(c.status)+'<span class="votes-sm">'+num(c.votes)+' '+t('c.votes')+'</span></span>'
 +'<span class="pacts"><a class="pbtn vote" href="vote.html?id='+c.id+'">👍 '+t('portal.btnVote')+'</a><a class="pbtn det" href="vote.html?id='+c.id+'">📄 '+t('portal.btnDetail')+'</a></span></div>';
}

function vHome(){
 const mine=DB.complaints.filter(c=>c.mine);
 const recent=(mine.length?mine:DB.complaints).slice(0,4);
 return '<h1>'+t('portal.welcome')+', '+UI.esc(firstName())+'</h1>'
 +'<p class="pt-sub">'+t('portal.subT')+'</p>'
 +'<a class="cta-banner" href="new-complaint.html"><span class="cta-plus">+</span><span style="flex:1"><b>'+t('portal.ctaT')+'</b><span>'+t('portal.ctaS')+'</span></span></a>'
 +'<div class="pt-label">'+t('portal.pick')+'</div>'
 +'<div class="cat-grid">'+PORTAL_CATS.map(p=>'<a class="cat-tile" href="'+tileHref(p)+'"><span class="em">'+p.em+'</span><span>'+t('pcat.'+p.k)+'</span></a>').join('')+'</div>'
 +'<div class="pt-label">'+t('portal.recent')+'</div>'
 +'<div class="recent-grid">'+recent.map(pcard).join('')+'</div>';
}
function vMine(){
 const mine=DB.complaints.filter(c=>c.mine);
 if(!mine.length)return '<h1>'+t('portal.mMine')+'</h1><p class="pt-sub">'+t('portal.subT')+'</p><div style="margin-top:22px">'+UI.emptyState()+'</div>';
 return '<h1>'+t('portal.mMine')+'</h1><p class="pt-sub">'+t('portal.subT')+'</p>'
 +'<div class="pt-label">'+num(mine.length)+' '+t('svc.results')+'</div>'
 +'<div class="recent-grid">'+mine.map(pcard).join('')+'</div>';
}
function vSearch(){
 const q=Q.toLowerCase();
 let arr=DB.complaints.slice();
 if(NEAR){
  arr=arr.filter(c=>distKm(c.lat,c.lng)<=2.5);
  arr.sort((a,b)=>distKm(a.lat,a.lng)-distKm(b.lat,b.lng));
 }
 if(q)arr=arr.filter(c=>(c.id+' '+titleOf(c)+' '+c.addr_en+' '+c.area).toLowerCase().includes(q));
 return '<h1>'+t('portal.mSearch')+'</h1><p class="pt-sub">'+t('portal.subT')+'</p>'
 +'<div class="locsearch pt-search" style="max-width:520px;margin:18px auto 0">'
  +'<span class="lsic">🔍</span>'
  +'<input id="ptQ" placeholder="'+UI.esc(t('portal.searchPh'))+'" value="'+UI.esc(Q)+'" autocomplete="off">'
  +'<div class="ac-list hidden" id="acDrop"></div>'
 +'</div>'
 +(NEAR?'<div style="text-align:center"><span class="near-chip">📍 '+t('portal.nearLbl')+': <b>'+UI.esc(I18N.lang==='bn'?NEAR.name_bn:NEAR.name_en)+'</b> ('+t('portal.within')+')<button id="nearClear" title="✕">✕</button></span></div>':'')
 +'<div class="recent-grid" style="margin-top:16px">'+(arr.length?arr.slice(0,10).map(pcard).join(''):UI.emptyState())+'</div>';
}
function bindSearch(){
 const q=$('#ptQ');if(!q)return;
 const drop=$('#acDrop');
 function renderDrop(){
  const v=Q.trim().toLowerCase();
  const cms=!v?DB.complaints.slice(0,5):DB.complaints.filter(c=>(c.id+' '+titleOf(c)+' '+c.area).toLowerCase().includes(v)).slice(0,5);
  const ars=!v?[]:DB.AREAS.filter(a=>(a.name_en+' '+a.name_bn).toLowerCase().includes(v)).slice(0,4);
  if(!cms.length&&!ars.length){drop.classList.add('hidden');return;}
  drop.innerHTML=(cms.length?'<div class="ac-sec">📄 '+UI.esc(t('portal.recent'))+'</div>':'')
  +cms.map(c=>'<div class="ac-item" data-cid="'+c.id+'"><span class="pinem">'+(CAT_EM[c.cat]||'📋')+'</span><span style="flex:1;min-width:0"><b class="small">'+UI.esc(c.id)+' · '+UI.esc(titleOf(c))+'</b><span class="tiny muted" style="display:block">'+UI.esc(I18N.lang==='bn'?c.addr_bn:c.addr_en)+'</span></span>'+UI.badge(c.status)+'</div>').join('')
  +(ars.length?'<div class="ac-sec">📍 '+UI.esc(t('svc.allAreas'))+'</div>':'')
  +ars.map(a=>'<div class="ac-item" data-lat="'+a.lat+'" data-lng="'+a.lng+'" data-en="'+UI.esc(a.name_en)+'"><span class="pinem">📍</span>'+UI.esc(I18N.lang==='bn'?a.name_bn:a.name_en)+'<small>'+num(distKm(a.lat,a.lng).toFixed(1))+' km</small></div>').join('');
  drop.classList.remove('hidden');
  drop.querySelectorAll('[data-cid]').forEach(x=>x.addEventListener('mousedown',e=>{
   e.preventDefault();location.href='vote.html?id='+x.dataset.cid;
  }));
  drop.querySelectorAll('[data-lat]').forEach(x=>x.addEventListener('mousedown',e=>{
   e.preventDefault();
   NEAR=DB.AREAS.find(a=>a.name_en===x.dataset.en)||{name_en:x.dataset.en,name_bn:x.dataset.en,lat:+x.dataset.lat,lng:+x.dataset.lng};
   Q='';render();
  }));
 }
 q.addEventListener('input',()=>{
  Q=q.value;const pos=q.selectionStart;
  render();
  const nq=$('#ptQ');if(nq){nq.focus();nq.setSelectionRange(pos,pos);}
  renderDrop();
 });
 q.addEventListener('focus',renderDrop);
 q.addEventListener('blur',()=>setTimeout(()=>drop.classList.add('hidden'),150));
}
function vEmer(){
 return '<h1>'+t('portal.mEmer')+'</h1><p class="pt-sub">'+t('portal.subT')+'</p>'
 +'<div class="emer-grid" style="margin-top:20px">'+Object.keys(DB.FAC_TYPES).map(k=>{
   const m=DB.FAC_TYPES[k];
   return '<a class="emer-tile" href="service.html?type='+k+'"><span class="em">'+m.emoji+'</span><b>'+t('fac.'+k)+(m.hotline?' · ☎'+m.hotline:'')+'</b></a>';
 }).join('')+'</div>';
}
function render(){
 const el=$('#ptBody');
 el.innerHTML=({home:vHome,mine:vMine,search:vSearch,emer:vEmer})[VIEW]();
 I18N.applyI18n(el);
 if(VIEW==='search'){bindSearch();
  const nc=$('#nearClear');if(nc)nc.addEventListener('click',()=>{NEAR=null;render();});
 }
 el.querySelectorAll('[data-open]').forEach(cd=>cd.addEventListener('click',e=>{
  if(e.target.closest('.pbtn'))return;
  location.href='vote.html?id='+cd.dataset.open;
 }));
}
document.querySelectorAll('#ptNav a').forEach(a=>a.addEventListener('click',e=>{
 e.preventDefault();
 const v=a.dataset.view;
 document.querySelectorAll('#ptNav a').forEach(x=>x.classList.toggle('on',x===a));
 if(v==='new'){location.href='new-complaint.html';return;}
 VIEW=v;render();
}));
$('#ptUser').textContent=ME.name;
$('#ptLogout').addEventListener('click',()=>{sessionStorage.removeItem('ns_portal_user');sessionStorage.removeItem('ns_user');location.href='index.html';});
document.querySelectorAll('[data-plang]').forEach(b=>b.addEventListener('click',()=>I18N.setLang(b.dataset.plang)));
document.addEventListener('langchange',()=>{
 document.querySelectorAll('[data-plang]').forEach(x=>x.classList.toggle('on',x.dataset.plang===I18N.lang));
 render();
});
render();
})();
