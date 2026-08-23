(function(){
const {t,tn,num}=I18N;
DB.mergeUserReports();
const FAC_TYPES=DB.FAC_TYPES;
let S={view:'splash',tab:'home',catFilter:'all',caseTab:'all',detailId:null,userPhone:null,facFilters:new Set(Object.keys(FAC_TYPES))};
let R={step:1,lat:22.8103,lng:89.5626,addr:'',cat:'',title:'',desc:'',photo:null};
const USER_LOC=[22.8103,89.5626];
const $=s=>document.querySelector(s);
function destroyMaps(){UI.maps.forEach(m=>{try{m.remove();}catch(e){}});UI.maps.length=0;}
function votedIds(){try{return JSON.parse(localStorage.getItem('ns_voted')||'[]');}catch(e){return[]}}
function toggleVoted(id){const v=votedIds();const i=v.indexOf(id);if(i>=0)v.splice(i,1);else v.push(id);localStorage.setItem('ns_voted',JSON.stringify(v));return i<0;}
function readNotifs(){try{return JSON.parse(localStorage.getItem('ns_read')||'[]');}catch(e){return[]}}
function markReadN(n){const r=readNotifs();if(!r.includes(n.id)){r.push(n.id);localStorage.setItem('ns_read',JSON.stringify(r));}}
function unreadCount(){return DB.notifications.filter(n=>!n.read&&!readNotifs().includes(n.id)).length;}
function distKm(lat,lng){const dLa=(lat-USER_LOC[0])*111.32,dLo=(lng-USER_LOC[1])*111.32*Math.cos(USER_LOC[0]*Math.PI/180);return Math.sqrt(dLa*dLa+dLo*dLo);}
function pinColor(c){if(c.status==='done')return'#16A34A';if(c.status==='rejected'||c.status==='merged')return'#94A3B8';if(c.priority>60)return'#DC2626';if(c.priority>30)return'#EAB308';return'#16A34A';}
function titleOf(c){return I18N.lang==='bn'?c.title_bn:c.title_en;}
function addrOf(c){return I18N.lang==='bn'?c.addr_bn:c.addr_en;}

function splashInit(){
 setTimeout(()=>{
  S.userPhone=sessionStorage.getItem('ns_user');
  if(S.userPhone){enterApp();}
  else{showView('auth');}
 },1700);
}
function showView(v){
 ['v-splash','v-auth'].forEach(id=>$('#'+id).classList.toggle('hidden',id!=='v-'+v));
 $('#shell').classList.toggle('hidden',!(v==='app'));
}
function enterApp(){
 sessionStorage.setItem('ns_user',S.userPhone||'+8801712345678');S.view='home';S.tab='home';
 $('#shell').classList.remove('hidden');
 const qp=new URLSearchParams(location.search||'');
 const preCat=qp.get('cat');
 if(preCat&&DB.CATS[preCat])R.cat=preCat;
 if(qp.get('new')){R.step=1;resetReport();if(preCat&&DB.CATS[preCat])R.cat=preCat;go('report');}
 else go('home');
}

document.querySelectorAll('[data-lang-btn]').forEach(b=>b.addEventListener('click',()=>{
 document.querySelectorAll('[data-lang-btn]').forEach(x=>x.classList.remove('on'));b.classList.add('on');I18N.setLang(b.dataset.langBtn);
}));
document.addEventListener('langchange',()=>{
 document.querySelectorAll('[data-lang-btn]').forEach(x=>x.classList.toggle('on',x.dataset.langBtn===I18N.lang));
 if(!$('#shell').classList.contains('hidden')){renderTop();renderCurrent();}
});

$('#f-phone').addEventListener('submit',e=>{
 e.preventDefault();
 const inp=$('#phoneInp'),err=$('#e-phone'),v=inp.value.replace(/\D/g,'');
 const bad=!v?'err.phoneReq':!/^1[3-9]\d{8}$/.test(v)?'err.phoneBad':null;
 if(bad){inp.classList.add('err-b');err.textContent=t(bad);err.classList.add('show');return;}
 inp.classList.remove('err-b');err.classList.remove('show');
 S.userPhone='+880'+v;
 $('#otpPhone').textContent=S.userPhone;
 $('#f-phone').classList.add('hidden');$('#f-otp').classList.remove('hidden');
});
$('#changeNum').addEventListener('click',e=>{e.preventDefault();$('#f-otp').classList.add('hidden');$('#f-phone').classList.remove('hidden');});
$('#f-otp').addEventListener('submit',e=>{
 e.preventDefault();
 const inp=$('#otpInp'),err=$('#e-otp'),v=inp.value.trim();
 const bad=!v?'err.otpReq':v!=='123456'?'err.otpBad':null;
 if(bad){inp.classList.add('err-b');err.textContent=t(bad);err.classList.add('show');return;}
 enterApp();
});
$('#skipLogin').addEventListener('click',()=>{S.userPhone='+8801712345678';UI.toast('Demo login: +880 1712 345678');enterApp();});
$('#regLink').addEventListener('click',e=>{e.preventDefault();UI.toast(t('register.toast'));});

$('#nidIcon').innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M12 8V4M9 13h.01M15 13h.01"/></svg>';
document.querySelectorAll('.bi').forEach(el=>el.innerHTML=UI.icon(el.dataset.ic,'',21));

function renderTop(){
 const el=$('#ctop');
 const bell='<button class="iconbtn" id="btnBell">'+UI.icon('bell','',21)+(unreadCount()?'<span class="bdg">'+num(unreadCount())+'</span>':'')+'</button>';
 if(S.view==='home'){
  el.innerHTML='<div class="ct-loc"><b>'+UI.icon('pin','',15)+t('nav.home')+' · Khulna</b><span>'+t('home.locPh')+'</span></div>'+bell;
 }else{
  const titles={maptab:'nav.map',report:'report.title',cases:'cases.title',facilities:'fac.title',notifs:'notif.title',profile:'profile.title',success:'success.t'};
  const key=S.view==='detail'?'detail.timeline':titles[S.view];
  el.innerHTML='<button class="iconbtn" id="btnBack">'+UI.icon('back','',20)+'</button><div class="ct-title">'+t(key)+'</div>'+(S.view==='notifs'?'<button class="iconbtn" id="markAll" title="'+t('notif.markAll')+'">'+UI.icon('check','',19)+'</button>':'')+(S.view==='notifs'?bell:'');
 }
 const bb=$('#btnBell');if(bb)bb.addEventListener('click',()=>go('notifs'));
 const mb=$('#markAll');if(mb)mb.addEventListener('click',()=>{DB.notifications.forEach(n=>markReadN(n));UI.toast(t('notif.markAll'));go('notifs');});
 const bk=$('#btnBack');if(bk)bk.addEventListener('click',()=>{const back={detail:'cases',facilities:'home',notifs:S.detailId?'detail':'home',profile:'home',report:'home',success:'cases'}[S.view]||'home';go(back);});
}

function go(view){
 destroyMaps();S.view=view;
 document.querySelectorAll('.cview').forEach(x=>x.classList.add('hidden'));
 const tabOf={home:'home',maptab:'maptab',report:'report',cases:'cases',profile:'profile'};
 document.querySelectorAll('#bnav button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tabOf[view]));
 $('#v-'+view).classList.remove('hidden');
 renderTop();
 const skel={home:'map',maptab:'map',cases:'cards',facilities:'cards',notifs:'rows',detail:'rows',profile:'rows'}[view];
 if(skel){const tv=view;$('#v-'+view).innerHTML='<div style="padding:14px 16px">'+UI.skeleton(skel)+'</div>';
  setTimeout(()=>{if(S.view===tv)renderCurrent();},420);}
 else renderCurrent();
 $('#cmain').scrollTop=0;
}
function renderCurrent(){({home:renderHome,maptab:renderMapTab,report:()=>renderReport(),cases:renderCases,detail:()=>renderDetail(S.detailId),facilities:renderFacilities,notifs:renderNotifs,profile:renderProfile,success:renderSuccess})[S.view]();}
document.querySelectorAll('#bnav button').forEach(b=>b.addEventListener('click',()=>{
 const tb=b.dataset.tab;
 if(tb==='report'){R.step=1;resetReport();go('report');}else go(tb);
}));

function cardHTML(c,opts){
 opts=opts||{};
 const d=distKm(c.lat,c.lng);
 const sla=UI.slaInfo(c);
 return '<article class="ccard" data-id="'+c.id+'">'
  +'<div style="display:flex;flex-direction:column;align-items:center;gap:6px">'+UI.catIcon(c.cat)+UI.prio(c.priority,'sm')+'</div>'
  +'<div class="cbody"><h4>'+UI.esc(titleOf(c))+'</h4>'
  +'<div class="meta">'+UI.icon('pin')+'<span class="'+(sla.cls==='breach'?'sla breach':'')+'">'+UI.esc(addrOf(c))+'</span></div>'
  +(opts.pipe?pipeMini(c):'')
  +'<div class="cfoot"><span class="meta">'+UI.icon('clock')+timeAgoStr(c)+' · '+tn('c.kmAway',{n:num(d.toFixed(1))})+(c.mine?' · <b style="color:var(--teal)">'+t('c.byYou')+'</b>':'')+'</span>'
  +'<span style="display:flex;gap:8px;align-items:center">'+UI.badge(c.status)+'</span></div></div></article>';
}
function timeAgoStr(c){const h=(Date.now()-c.createdAt)/3600e3;return UI.timeAgo(h);}
function pipeMini(c){
 const total=7,stages=stageIndex(c);
 let segs='';for(let i=0;i<total;i++)segs+='<i class="'+(i<stages?'f':i===stages&&c.status!=='done'&&c.status!=='rejected'?'a':'')+'"></i>';
 const names=['stage.submitted','stage.aiVerified','stage.classified','stage.prioritised','stage.routed','stage.inProgress','stage.resolved'];
 return '<div style="margin-top:7px"><div class="tiny muted" style="font-weight:700;color:#7C3AED">'+UI.icon('robot','',12)+' '+t(names[Math.min(stages,total-1)])+'</div><div class="pipebar">'+segs+'</div></div>';
}
function stageIndex(c){
 if(c.status==='rejected')return 1;
 if(c.status==='merged')return 5;
 if(c.status==='done')return 7;
 if(c.status==='in_progress')return 6;
 return 5;
}

let homeCatChipsBound=false;
function renderHome(){
 const el=$('#v-home');
 const cats=['all','road','water','gas','electricity','sanitation'];
 el.innerHTML='<div class="pad"><div class="hmap" id="homeMap"></div></div>'
 +'<div style="padding:0 14px"><div class="chiprow">'+cats.map(k=>'<button class="chip'+(S.catFilter===k?' on':'')+'" data-cat="'+k+'">'+(k==='all'?'':UI.icon(DB.CATS[k].icon,'',15))+t('cat.'+k)+'</button>').join('')+'</div></div>'
 +'<div class="pad" style="padding-top:2px"><div class="sect-h"><h3>'+t('home.nearby')+'</h3><a href="#" id="lnkFac" class="link-sm">'+t('home.facilities')+' →</a></div><div id="homeList"></div></div>';
 el.querySelectorAll('[data-cat]').forEach(ch=>ch.addEventListener('click',()=>{
  S.catFilter=ch.dataset.cat;
  el.querySelectorAll('[data-cat]').forEach(x=>x.classList.toggle('on',x===ch));
  renderHomeList();
 }));
 const lf=$('#lnkFac');lf.addEventListener('click',e=>{e.preventDefault();go('facilities');});
 drawFeedMap('homeMap');
 renderHomeList();
}
function renderHomeList(){
 const list=$('#homeList');if(!list)return;
 let arr=DB.complaints.filter(c=>c.status!=='rejected'&&c.status!=='merged');
 if(S.catFilter!=='all')arr=arr.filter(c=>c.cat===S.catFilter);
 arr=arr.slice().sort((a,b)=>b.priority-a.priority);
 if(!arr.length){list.innerHTML=UI.emptyState();I18N.applyI18n(list);return;}
 list.innerHTML=arr.map(c=>cardHTML(c,{pipe:true})).join('');
 list.querySelectorAll('.ccard').forEach(x=>x.addEventListener('click',()=>openDetail(x.dataset.id)));
}
function drawFeedMap(mapId,big){
 const el=document.getElementById(mapId);if(!el)return;
 const m=UI.makeMap(el,{zoom:big?13:12.4});
 if(!m)return;
 DB.complaints.filter(c=>c.status!=='rejected'&&c.status!=='merged').forEach(c=>{
  L.circleMarker([c.lat,c.lng],{radius:big?9:7,color:'#fff',weight:2,fillColor:pinColor(c),fillOpacity:.95})
   .addTo(m).bindTooltip('<b>'+UI.esc(titleOf(c))+'</b><br>'+UI.badge(c.status)+' · ⭐ '+num(c.votes)+' · P'+num(c.priority),{direction:'top'})
   .on('click',()=>openDetail(c.id));
 });
 L.circleMarker(USER_LOC,{radius:6,color:'#fff',weight:3,fillColor:'#1E5240',fillOpacity:1}).addTo(m).bindTooltip('📍 You / আপনি',{direction:'top'});
}

function openDetail(id){S.detailId=id;go('detail');}

function renderMapTab(){
 const el=$('#v-maptab');
 el.innerHTML='<div class="pad"><div class="chiprow" id="mapLayerChips">'
  +'<button class="chip on" data-layer="complaints">'+UI.icon('pin','',14)+t('d.map.pins')+'</button>'
  +'<button class="chip fac" data-layer="facilities">'+UI.icon('build','',14)+t('home.facilities')+'</button></div>'
  +'<div class="pickmap" style="height:52vh" id="bigMap"></div>'
  +'<p class="hint" style="margin-top:10px">🔴 '+t('d.stat.high')+' · 🟡 Medium · 🟢 Resolved</p></div>';
 let layers={complaints:true,facilities:false};
 el.querySelectorAll('[data-layer]').forEach(ch=>ch.addEventListener('click',()=>{
  layers[ch.dataset.layer]=!layers[ch.dataset.layer];ch.classList.toggle('on',layers[ch.dataset.layer]);drawBig(layers);
 }));
 const m=drawBig(layers);
 function drawBig(ls){
  destroyMaps();
  const mm=UI.makeMap($('#bigMap'),{zoom:13});if(!mm)return null;
  if(ls.complaints)DB.complaints.filter(c=>c.status!=='rejected').forEach(c=>{
   L.circleMarker([c.lat,c.lng],{radius:9,color:'#fff',weight:2,fillColor:pinColor(c),fillOpacity:.95}).addTo(mm)
    .on('click',()=>openDetail(c.id));
  });
  if(ls.facilities)DB.facilities.filter(f=>f.active).forEach(f=>{
   const ft=FAC_TYPES[f.type];
   L.circleMarker([f.lat,f.lng],{radius:8,color:'#fff',weight:2,fillColor:ft.color,fillOpacity:.95}).addTo(mm)
    .bindPopup('<b>'+UI.esc(nameOf(f))+'</b><br>'+t('fac.'+f.type));
  });
  return mm;
 }
}
function nameOf(f){return I18N.lang==='bn'&&f.name_bn?f.name_bn:f.name_en;}

function resetReport(){R={step:1,lat:USER_LOC[0],lng:USER_LOC[1],addr:'',cat:'',title:'',desc:'',photo:null};}
function renderReport(){
 const el=$('#v-report');
 const steps=['report.s1','report.s2','report.s3','report.s4'];
 let st='<div class="stepper">'+steps.map((s,i)=>{
  const n=i+1,cls=R.step===n?'cur':R.step>n?'done':'';
  return '<div class="step '+cls+'"><span class="sdot">'+(R.step>n?'✓':num(n))+'</span><span>'+t(s)+'</span></div>';
 }).join('')+'</div>';
 let body='';
 if(R.step===1){
  body='<h3>'+t('report.gpsTitle')+'</h3><div class="pickmap" id="repMap"></div><p class="hint">'+t('report.gpsHint')+'</p>'
  +'<label class="fld" style="margin-top:14px"><span class="fld-name">'+t('report.addr')+'</span><input class="inp" id="rAddr" value="'+UI.esc(R.addr)+'" placeholder="'+UI.esc(t('report.addrPh'))+'"><span class="ferr" id="e-addr"></span></label>';
 }else if(R.step===2){
  body='<h3>'+t('report.pickCat')+'</h3><div class="catgrid">'+Object.keys(DB.CATS).map(k=>{
   const c=DB.CATS[k];
   return '<button type="button" class="catopt'+(R.cat===k?' on':'')+'" data-k="'+k+'"><span class="ci" style="background:'+c.color+'18;color:'+c.color+'">'+UI.icon(c.icon,'',19)+'</span>'+t('cat.'+k)+'</button>';
  }).join('')+'</div>'
  +'<label class="fld"><span class="fld-name">'+t('report.ctitle')+'</span><input class="inp" id="rTitle" value="'+UI.esc(R.title)+'" placeholder="'+UI.esc(t('report.ctitlePh'))+'"><span class="ferr" id="e-title"></span></label>'
  +'<label class="fld"><span class="fld-name">'+t('report.desc')+'</span><textarea class="ta" id="rDesc" placeholder="'+UI.esc(t('report.descPh'))+'">'+UI.esc(R.desc)+'</textarea><span class="ferr" id="e-desc"></span></label>';
 }else if(R.step===3){
  body='<h3>'+t('report.photo')+'</h3>'+(R.photo
   ?'<div class="photo-prev"><img src="'+R.photo+'" alt=""><button type="button" class="btn btn-sm btn-outline" id="retake" style="position:absolute;top:10px;right:10px">'+t('report.retake')+'</button></div>'
   :'<label class="photo-drop" style="display:block;cursor:pointer">'+UI.icon('camera','',34)+'<p style="margin-top:8px;font-weight:600">'+t('report.capture')+'</p><input type="file" id="photoInp" accept="image/*" capture="environment" class="sr"></label>')
  +'<div style="display:flex;gap:10px;margin-top:10px"><label class="btn btn-outline btn-sm" style="cursor:pointer">'+t('report.capture')+'<input type="file" id="photoInp2" accept="image/*" capture="environment" class="sr"></label><button type="button" class="btn btn-outline btn-sm" id="sampleBtn">'+t('report.sample')+'</button></div>'
  +'<span class="ferr" id="e-photo"></span>'
  +'<div class="ai-note"><span class="ai-tag">'+UI.icon('robot','',16)+'</span><span>'+t('report.aiNote')+'</span></div>';
 }else{
  const sla=DB.CATS[R.cat].sla;
  body='<h3>'+t('report.reviewT')+'</h3><div class="card" style="padding:14px 16px">'
  +'<div class="review-row"><b>'+t('report.s1')+'</b><span>'+UI.esc(R.addr||'—')+'</span></div>'
  +'<div class="review-row"><b>'+t('report.pickCat')+'</b><span style="display:flex;gap:7px;align-items:center">'+UI.catIcon(R.cat)+t('cat.'+R.cat)+'</span></div>'
  +'<div class="review-row"><b>'+t('report.ctitle')+'</b><span>'+UI.esc(R.title)+'</span></div>'
  +'<div class="review-row"><b>'+t('report.desc')+'</b><span>'+UI.esc(R.desc.length>110?R.desc.slice(0,110)+'…':R.desc)+'</span></div>'
  +(R.photo?'<div class="review-row"><b>'+t('report.photo')+'</b><img src="'+R.photo+'" style="width:74px;height:52px;object-fit:cover;border-radius:8px"></div>':'')
  +'</div><div style="display:flex;align-items:center;gap:9px;margin-top:13px;background:var(--prog-bg);border-radius:10px;padding:11px 13px;color:var(--prog);font-weight:700;font-size:13.5px">'+UI.icon('clock','',17)+t('report.estSla')+': '+tn('c.hrsLeft',{n:num(sla)})+'</div>';
 }
 el.innerHTML='<div class="rstep">'+st+body+'<span class="ferr" id="e-step"></span><div class="rnav">'
  +(R.step>1?'<button class="btn btn-outline" id="rb">'+t('report.back')+'</button>':'')
  +'<button class="btn btn-primary" id="rn">'+(R.step===4?t('report.submit'):t('report.next'))+'</button></div></div>';

 if(R.step===1){
  const m=UI.makeMap($('#repMap'),{zoom:16,center:[R.lat,R.lng]});
  if(m){
   const mk=L.marker([R.lat,R.lng],{draggable:true}).addTo(m);
   mk.on('dragend',()=>{const p=mk.getLatLng();R.lat=p.lat;R.lng=p.lng;});
   m.on('click',e=>{mk.setLatLng(e.latlng);R.lat=e.latlng.lat;R.lng=e.latlng.lng;});
  }
  const ra=$('#rAddr');ra.addEventListener('input',()=>{R.addr=ra.value;hideErr('#e-addr');});
 }else if(R.step===2){
  el.querySelectorAll('.catopt').forEach(b=>b.addEventListener('click',()=>{R.cat=b.dataset.k;el.querySelectorAll('.catopt').forEach(x=>x.classList.toggle('on',x===b));}));
  $('#rTitle').addEventListener('input',e=>{R.title=e.target.value;hideErr('#e-title');});
  $('#rDesc').addEventListener('input',e=>{R.desc=e.target.value;hideErr('#e-desc');});
 }else if(R.step===3){
  ['#photoInp','#photoInp2'].forEach(sel=>{const p=$(sel);if(p)p.addEventListener('change',ev=>{
   const f=ev.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{R.photo=rd.result;renderReport();};rd.readAsDataURL(f);
  });});
  const sb=$('#sampleBtn');if(sb)sb.addEventListener('click',()=>{
   const cv=document.createElement('canvas');cv.width=640;cv.height=420;const x=cv.getContext('2d');
   const g=x.createLinearGradient(0,0,640,420);g.addColorStop(0,'#334155');g.addColorStop(1,'#7C3AED');x.fillStyle=g;x.fillRect(0,0,640,420);
   x.fillStyle='#D9A441';x.beginPath();x.arc(320,210,70,0,7);x.fill();
   R.photo=cv.toDataURL();renderReport();
  });
  const rt=$('#retake');if(rt)rt.addEventListener('click',()=>{R.photo=null;renderReport();});
 }
 const rb=$('#rb');if(rb)rb.addEventListener('click',()=>{R.step--;renderReport();});
 $('#rn').addEventListener('click',onNext);

 function hideErr(sel){const e=$(sel);if(e)e.classList.remove('show');}
 function fail(sel,msg){const e=$(sel);if(e){e.textContent=msg;e.classList.add('show');}}
 function onNext(){
  if(R.step===1){
   if(!R.addr.trim()){fail('#e-addr',t('err.addrReq'));return;}
  }else if(R.step===2){
   if(!R.cat){const eb=$('#e-step');eb.textContent=t('err.catReq');eb.classList.add('show');return;}
   if(!R.title.trim()||R.title.trim().length<8){fail('#e-title',!R.title.trim()?t('err.titleReq'):t('err.titleShort'));return;}
   if(!R.desc.trim()){fail('#e-desc',t('err.descReq'));return;}
  }else if(R.step===3){
   if(!R.photo){fail('#e-photo',t('err.photoReq'));return;}
  }else if(R.step===4){submitComplaint();return;}
  R.step++;renderReport();
 }
}

let nextId=1060;
function submitComplaint(){
 const sla=DB.CATS[R.cat].sla;
 const id='DHSC-'+(nextId++);
 const c={id,cat:R.cat,title_en:R.title,title_bn:R.title,addr_en:R.addr,addr_bn:R.addr,area:'Sonadanga',lat:R.lat,lng:R.lng,
  status:'open',priority:35+Math.min(40,DB.complaints.length),votes:1,ageH:0.02,slaH:sla,lgi:'Khulna City Corporation',lgiType:'city',
  assignee:null,photo:R.photo,ai:{photoConf:.93,classConf:.9,priority:45,dupOf:null},reporter:S.userPhone,mine:true,
  trail:[
   {by:'ai',agent:'Photo Verifier',en:'Photo verified authentic — 93%.',bn:'ছবি যাচাইকৃত — ৯৩%.',h:-0.015},
   {by:'ai',agent:'Text Classifier',en:'Classified ('+Math.round(.9*100)+'%).',bn:'শ্রেণিবদ্ধ (৯০%)।',h:-0.012},
   {by:'ai',agent:'GPS Dedup Agent',en:'No duplicate within 300 m.',bn:'৩০০ মিটারে ডুপ্লিকেট নেই।',h:-0.01},
   {by:'ai',agent:'Priority Ranker',en:'Priority score set.',bn:'অগ্রাধিকার নির্ধারিত।',h:-0.008},
   {by:'ai',agent:'LGI Router',en:'Routed to Khulna City Corporation.',bn:'খুলনা সিটি কর্পোরেশনে পাঠানো।',h:-0.005}
  ]};
 DB.notifications.unshift({id:Date.now(),ch:'app',cid:id,en:t('notif.app')+' — '+c.title_en,bn:'আপনার অভিযোগ জমা হয়েছে: '+c.title_bn,h:0.02,read:false});
 DB.complaints.unshift(c);
 S.lastNew=c.id;go('success');
}
function renderSuccess(){
 const el=$('#v-success');
 const c=DB.complaints.find(x=>x.id===S.lastNew)||DB.complaints[0];
 const stages=['stage.submitted','stage.aiVerified','stage.classified','stage.prioritised','stage.routed'];
 el.innerHTML='<div class="success-wrap"><div class="okring">'+UI.icon('check','',42)+'</div>'
 +'<h2>'+t('success.t')+'</h2><p class="muted small" style="margin-top:6px">'+t('success.d')+'</p>'
 +'<div class="case-id-chip">'+UI.icon('doc','',15)+t('success.caseId')+': <b>'+c.id+'</b></div>'
 +'<div class="pipe">'+stages.map((s,i)=>'<div class="pipe-item" data-i="'+i+'"><span class="pi">'+UI.icon('robot','',12)+'</span>'+t(s)+'</div>').join('')+'</div>'
 +'<button class="btn btn-primary btn-block hidden" id="goCase" style="margin-top:16px">'+t('success.viewCase')+' →</button></div>';
 const items=el.querySelectorAll('.pipe-item');let i=0;
 const iv=setInterval(()=>{
  if(i>=items.length){clearInterval(iv);$('#goCase').classList.remove('hidden');return;}
  items[i++].classList.add('hit');
 },520);
 $('#goCase').addEventListener('click',()=>{S.caseTab='all';go('cases');});
}

function renderCases(){
 const el=$('#v-cases');
 const tabs=[['all','cases.all'],['open','cases.open'],['in_progress','cases.inprog'],['done','cases.done']];
 el.innerHTML='<div class="tabs">'+tabs.map(x=>'<button data-tab="'+x[0]+'" class="'+(S.caseTab===x[0]?'on':'')+'">'+t(x[1])+'</button>').join('')+'</div><div class="pad" style="padding-top:8px"><div id="caseList"></div></div>';
 el.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{S.caseTab=b.dataset.tab;renderCases();}));
 const list=$('#caseList');
 let arr=DB.complaints.filter(c=>c.mine);
 if(S.caseTab!=='all')arr=arr.filter(c=>c.status===S.caseTab);
 if(!arr.length){list.innerHTML=UI.emptyState();I18N.applyI18n(list);return;}
 list.innerHTML=arr.map(c=>cardHTML(c,{pipe:true})).join('');
 list.querySelectorAll('.ccard').forEach(x=>x.addEventListener('click',()=>openDetail(x.dataset.id)));
}

function renderDetail(){
 const el=$('#v-detail');
 const c=DB.complaints.find(x=>x.id===S.detailId);
 if(!c){go('cases');return;}
 const stages=[['submitted','stage.submitted'],['ai','stage.aiVerified'],['class','stage.classified'],['prio','stage.prioritised'],['route','stage.routed'],['prog','stage.inProgress'],['done','stage.resolved']];
 const si=c.status==='done'?7:c.status==='in_progress'?6:c.status==='rejected'?1:c.status==='merged'?5:5;
 const voted=votedIds().includes(c.id);
 const photoHTML=c.photo?'<img class="ph" src="'+c.photo+'" alt="">':'';
 const iconBig=DB.CATS[c.cat].icon;
 el.innerHTML=
 '<div class="d-photo">'+photoHTML+'<div style="position:relative;text-align:center;z-index:1">'+UI.icon(iconBig,'',64)+'</div>'
 +'<div class="votebar">'
 +'<button class="btn '+(voted?'voted':'')+'" id="voteBtn">'+UI.icon('vote','',17)+' '+t(voted?'detail.voted':'detail.vote')+' · '+num(c.votes)+'</button>'
 +'<button class="btn" id="shareBtn">'+UI.icon('share','',17)+' '+t('detail.share')+'</button></div></div>'
 +'<div class="d-head"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">'
 +'<h2>'+UI.esc(titleOf(c))+'</h2>'+UI.prio(c.priority)+'</div>'
 +'<div class="meta" style="margin-top:7px"><span class="badge '+UI.statusKey(c.status)+'"><span class="dot"></span>'+UI.statusLabel(c.status)+'</span><span>'+c.id+'</span>·<span>'+timeAgoStr(c)+'</span></div>'
 +'<p class="small muted" style="margin-top:6px;display:flex;gap:6px;align-items:flex-start">'+UI.icon('pin','',14)+UI.esc(addrOf(c))+'</p></div>'
 +(c.status==='merged'&&c.dupInto?'<div class="err-banner" style="margin:12px 18px 0;background:var(--merged-bg);border-color:var(--merged-line);color:var(--merged)">🔗 '+t('detail.merged')+' <b>'+c.dupInto+'</b></div>':'')
 +(c.status==='rejected'?'<div class="err-banner" style="margin:12px 18px 0">'+UI.icon('warn','',15)+' '+t('detail.rejected')+'</div>':'')
 +(c.ai.rejected?'':'<div class="ai-card"><h4><span class="ai-tag">'+UI.icon('robot','',15)+' '+t('detail.aiSum')+'</span></h4><div class="ai-grid">'
   +'<div class="ai-stat"><b>'+Math.round((c.ai.classConf||0)*100)+'%</b><span>'+t('detail.confidence')+'</span></div>'
   +'<div class="ai-stat">'+UI.prio(c.priority,'lg')+'</div>'
   +'<div class="ai-stat"><b>'+t('cat.'+c.cat)+'</b><span>'+DB.CATS[c.cat].sla+t('common.hours')+' SLA</span></div>'
   +'</div></div>')
 +'<div class="tlwrap"><h4 class="small muted" style="margin-bottom:10px">'+t('detail.timeline')+'</h4><div class="tl">'
 +stages.map((s,i)=>{
  let cls=i<si?'done':i===si?'now':'';
  if(c.status==='rejected')cls=i===0?'done':'';
  if(c.status==='merged'&&i===6)cls='';
  if(c.mine&&i===0)cls+=' done';
  return '<div class="tl-item '+cls+'"><b class="small">'+t(s[1])+'</b><div class="tiny muted">'+(i<si?(i===0?timeAgoStr(c):'✓'):(i===si?'●':'—'))+'</div></div>';
 }).join('')
 +'</div></div>';
 $('#voteBtn').addEventListener('click',()=>{
  const nowVoted=toggleVoted(c.id);c.votes+=nowVoted?1:-1;if(c.votes<0)c.votes=0;
  UI.toast(nowVoted?'⭐ +1 '+t('detail.voted'):t('detail.vote'));
  renderDetail();
 });
 $('#shareBtn').addEventListener('click',async()=>{
  const txt=c.id+' — '+titleOf(c)+' | Nagorik Sheba';
  try{if(navigator.share){await navigator.share({title:'Nagorik Sheba',text:txt});return;}}catch(e){}
  try{await navigator.clipboard.writeText(txt);UI.toast('🔗 Copied / কপি হয়েছে');}catch(e){UI.toast(txt);}
 });
}

let facMap=null;
function renderFacilities(){
 const el=$('#v-facilities');
 const keys=Object.keys(FAC_TYPES);
 el.innerHTML='<div class="pad" style="padding-bottom:6px"><div class="pickmap" style="height:38vh" id="facMap"></div></div>'
 +'<div style="padding:0 14px"><div class="chiprow">'+keys.map(k=>'<button class="chip fac'+(S.facFilters.has(k)?' on':'')+'" data-ft="'+k+'">'+UI.icon(FAC_TYPES[k].icon,'',14)+t('fac.'+k)+'</button>').join('')+'</div></div>'
 +'<div class="fac-cards" id="facList"></div>';
 el.querySelectorAll('[data-ft]').forEach(ch=>ch.addEventListener('click',()=>{
  const k=ch.dataset.ft;S.facFilters.has(k)?S.facFilters.delete(k):S.facFilters.add(k);ch.classList.toggle('on');drawF();drawList();
 }));
 function drawF(){
  destroyMaps();
  const m=UI.makeMap($('#facMap'),{zoom:12.6});facMap=m;if(!m)return;
  DB.facilities.filter(f=>f.active&&S.facFilters.has(f.type)).forEach(f=>{
   const ft=FAC_TYPES[f.type];
   L.circleMarker([f.lat,f.lng],{radius:8,color:'#fff',weight:2,fillColor:ft.color,fillOpacity:.95}).addTo(m)
    .bindPopup('<b>'+UI.esc(nameOf(f))+'</b><br>☎ '+f.phone);
  });
 }
 function drawList(){
  const list=$('#facList');
  const arr=DB.facilities.filter(f=>S.facFilters.has(f.type));
  if(!arr.length){list.innerHTML=UI.emptyState();I18N.applyI18n(list);return;}
  list.innerHTML=arr.map(f=>{
   const ft=FAC_TYPES[f.type],d=distKm(f.lat,f.lng);
   return '<div class="fac-card"><span class="fac-ic" style="background:'+ft.color+'">'+UI.icon(ft.icon,'',20)+'</span>'
   +'<div style="flex:1;min-width:0"><b>'+UI.esc(nameOf(f))+'</b><div class="meta">'+tn('c.kmAway',{n:num(d.toFixed(1))})+' · '+t('fac.'+f.type)+(f.active?'':' · <span style="color:var(--rej)">'+t('d.fm.inactive')+'</span>')+'</div></div>'
   +'<div style="display:flex;flex-direction:column;gap:6px"><a class="btn btn-teal btn-sm" href="tel:'+f.phone+'">'+UI.icon('phone','',14)+' '+t('fac.call')+'</a>'
   +'<a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="https://www.openstreetmap.org/directions?to='+f.lat+'%2C'+f.lng+'">'+UI.icon('nav','',14)+' '+t('fac.directions')+'</a></div></div>';
  }).join('');
 }
 drawF();drawList();
}

function renderNotifs(){
 const el=$('#v-notifs');
 const arr=DB.notifications;
 el.innerHTML=arr.length?'<div>'+arr.map(n=>{
  const isRead=n.read||readNotifs().includes(n.id);
  return '<div class="nrow '+(isRead?'read':'unread')+'" data-n="'+n.id+'"><span class="ndot"></span>'
  +'<div style="flex:1"><div style="display:flex;gap:7px;align-items:center;margin-bottom:3px"><span class="ch-tag ch-'+n.ch+'">'+t(n.ch==='sms'?'notif.sms':'notif.app')+'</span><span class="tiny muted">'+UI.timeAgo(n.h)+'</span></div>'
  +'<p class="small" style="line-height:1.45">'+UI.esc(I18N.lang==='bn'?n.bn:n.en)+'</p>'
  +(n.cid?'<a href="#" class="link-sm tiny" data-cid="'+n.cid+'" style="margin-top:4px;display:inline-block">'+n.cid+' →</a>':'')
  +'</div></div>';
 }).join('')+'</div>':UI.emptyState();
 el.querySelectorAll('[data-n]').forEach(row=>row.addEventListener('click',e=>{
  const cid=e.target.closest('[data-cid]');
  if(cid){e.preventDefault();markReadN(DB.notifications.find(n=>n.id==row.dataset.n));openDetail(cid.dataset.cid);return;}
  markReadN(DB.notifications.find(n=>n.id==row.dataset.n));renderNotifs();renderTop();
 }));
}

function renderProfile(){
 const el=$('#v-profile');
 const mine=DB.complaints.filter(c=>c.mine);
 const done=mine.filter(c=>c.status==='done').length,active=mine.filter(c=>c.status==='open'||c.status==='in_progress').length;
 const ph=S.userPhone||'+8801712345678';
 el.innerHTML=
 '<div class="prof-head"><span class="prof-avatar">'+ph.slice(-2)+'</span><h3 style="margin-top:10px">Citizen '+ph.slice(-4)+'</h3><p class="tiny" style="opacity:.85;margin-top:2px">'+t('profile.phone')+': '+ph+'</p></div>'
 +'<div class="prof-card"><div class="nid-card"><span class="nid-ok">'+UI.icon('idcard','',22)+'</span>'
 +'<div style="flex:1"><b class="small">'+t('profile.nidT')+'</b><div class="meta" style="margin-top:3px"><span class="badge st-done"><span class="dot"></span>'+t('profile.verified')+'</span></div></div>'
 +'<div style="text-align:right"><b>'+num(94)+'%</b><div class="tiny muted">'+t('profile.faceMatch')+'</div></div></div>'
 +'<div class="stat3"><div><b>'+num(mine.length)+'</b><span>'+t('profile.submitted')+'</span></div><div><b>'+num(active)+'</b><span>'+t('profile.active')+'</span></div><div><b>'+num(done)+'</b><span>'+t('profile.resolved')+'</span></div></div></div>'
 +'<div class="prof-list">'
 +'<div class="prow"><span style="display:flex;gap:9px;align-items:center">'+UI.icon('doc','',18)+t('cases.title')+'</span><a href="#" id="pfCases" class="link-sm">'+num(mine.length)+' →</a></div>'
 +'<div class="prow"><span style="display:flex;gap:9px;align-items:center">'+UI.icon('bell','',18)+t('notif.title')+'</span><a href="#" id="pfNotif" class="link-sm">'+num(unreadCount())+' →</a></div>'
 +'<div class="prow"><span style="display:flex;gap:9px;align-items:center">'+UI.icon('share','',18)+t('profile.lang')+'</span><span class="lang-seg"><button data-plang="bn">বাংলা</button><button data-plang="en">English</button></span></div>'
 +'</div>'
 +'<button class="btn btn-danger logout-btn" id="pfLogout">'+UI.icon('logout','',17)+' '+t('profile.logout')+'</button>';
 el.querySelectorAll('[data-plang]').forEach(b=>b.addEventListener('click',()=>I18N.setLang(b.dataset.plang)));
 $('#pfCases').addEventListener('click',e=>{e.preventDefault();go('cases');});
 $('#pfNotif').addEventListener('click',e=>{e.preventDefault();go('notifs');});
 $('#pfLogout').addEventListener('click',()=>{sessionStorage.removeItem('ns_user');location.reload();});
}

splashInit();
window.addEventListener('beforeunload',destroyMaps);
})();
