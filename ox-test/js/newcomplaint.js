(function(){
const {t,tn,num}=I18N;
const $=s=>document.querySelector(s);
const params=new URLSearchParams(location.search||'');
const NC_CATS=[
 {k:'road',em:'🛣️',cat:'road'},
 {k:'water',em:'🚰',cat:'water'},
 {k:'elec',em:'💡',cat:'electricity'},
 {k:'gas',em:'🔥',cat:'gas'},
 {k:'waste',em:'🗑️',cat:'sanitation'},
 {k:'light',em:'🔦',cat:'streetlight'},
 {k:'other',em:'🔧',cat:'other'}
];
let SEL=params.get('cat')&&DB.CATS[params.get('cat')] ? params.get('cat') : null;
let PHOTO=null,POS={lat:22.8103,lng:89.5626},map=null,marker=null;
const CITY=[22.8103,89.5626];
DB.mergeUserReports();
function routeLGI(){
 if(POS.lat>=22.83&&POS.lat<=22.88&&POS.lng>=89.47&&POS.lng<=89.53)return DB.LGIS[1];
 if(POS.lat<=22.72&&POS.lat>=22.64&&POS.lng>=89.45&&POS.lng<=89.58)return DB.LGIS[2];
 return DB.LGIS[0];
}
function compressPhoto(dataUrl,maxW,cb){
 const img=new Image();
 img.onload=()=>{
  try{
   const sc=Math.min(1,maxW/(img.width||maxW));
   const cv=document.createElement('canvas');
   cv.width=Math.max(1,Math.round(img.width*sc));cv.height=Math.max(1,Math.round(img.height*sc));
   cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
   cb(cv.toDataURL('image/jpeg',.72));
  }catch(e){cb(dataUrl);}
 };
 img.onerror=()=>cb(dataUrl);
 img.src=dataUrl;
}
function updateRouteUI(){
 const el=$('#ncLgi');
 if(el)el.textContent=I18N.lang==='bn'?routeLGI().name_bn:routeLGI().name;
}

$('#ncCats').innerHTML=NC_CATS.map(p=>'<button type="button" class="cat-tile'+(SEL===p.cat?' on':'')+'" data-ncat="'+p.cat+'"><span class="em">'+p.em+'</span><span>'+t('pcat.'+p.k)+'</span></button>').join('');
$$('#ncCats [data-ncat]').forEach(b=>b.addEventListener('click',()=>{
 SEL=b.dataset.ncat;
 $$('#ncCats [data-ncat]').forEach(x=>x.classList.toggle('on',x===b));
 hide('#e-ncCat');
}));
function $$(s){return Array.from(document.querySelectorAll(s));}
function hide(id){const e=$(id);if(e)e.classList.remove('show');}
function fail(id,msg){const e=$(id);if(!e)return;e.textContent=msg;e.classList.add('show');}

function renderPhoto(){
 const box=$('#ncPhotoBox');
 box.innerHTML=PHOTO
  ?'<div class="photo-prev" style="position:relative;border-radius:13px;overflow:hidden"><img src="'+PHOTO+'" style="width:100%;height:170px;object-fit:cover;display:block"><button type="button" class="btn btn-sm btn-outline" id="ncRetake" style="position:absolute;top:10px;right:10px">'+t('report.retake')+'</button></div>'
  :'<label class="nc-drop" style="display:block;cursor:pointer">📷 <span>'+t('nc.photoBtn')+'</span><input type="file" id="ncPhoto" accept="image/*" capture="environment" class="sr"></label>';
 const inp=$('#ncPhoto');
 if(inp)inp.addEventListener('change',ev=>{
  const f=ev.target.files[0];if(!f)return;
  const rd=new FileReader();rd.onload=()=>{PHOTO=rd.result;renderPhoto();hide('#e-ncPhoto');};rd.readAsDataURL(f);
 });
 const rt=$('#ncRetake');
 if(rt)rt.addEventListener('click',()=>{PHOTO=null;renderPhoto();});
}
renderPhoto();

function initMap(){
 map=UI.makeMap($('#ncMap'),{center:[POS.lat,POS.lng],zoom:15});
 if(!map)return;
 marker=L.marker([POS.lat,POS.lng],{draggable:true}).addTo(map);
 marker.on('dragend',()=>{const p=marker.getLatLng();POS={lat:p.lat,lng:p.lng};updateRouteUI();});
 map.on('click',e=>{marker.setLatLng(e.latlng);POS={lat:e.latlng.lat,lng:e.latlng.lng};updateRouteUI();});
}
initMap();
updateRouteUI();
$('#ncGps').addEventListener('click',()=>{
 if(navigator.geolocation){
  navigator.geolocation.getCurrentPosition(p=>{
   POS={lat:p.coords.latitude,lng:p.coords.longitude};
   if(marker){marker.setLatLng([POS.lat,POS.lng]);map.setView([POS.lat,POS.lng],16);}
   updateRouteUI();
   UI.toast('📍 '+t('nc.gps')+' ✓');
  },()=>{UI.toast('📍 Khulna (default)');});
 }else UI.toast('📍 Khulna (default)');
});
$('#ncAddr').addEventListener('input',()=>hide('#e-ncAddr'));
$('#ncDesc').addEventListener('input',()=>hide('#e-ncDesc'));

$('#ncSubmit').addEventListener('click',()=>{
 let ok=true;
 if(!SEL){fail('#e-ncCat',t('nc.err.cat'));ok=false;}
 const desc=$('#ncDesc').value.trim();
 if(desc.length<10){fail('#e-ncDesc',t('nc.err.desc'));ok=false;}
 if(!PHOTO){fail('#e-ncPhoto',t('nc.err.photo'));ok=false;}
 const addr=$('#ncAddr').value.trim();
 if(!addr){fail('#e-ncAddr',t('nc.err.addr'));ok=false;}
 if(!ok)return;
 let me=null;try{me=JSON.parse(sessionStorage.getItem('ns_portal_user')||'null');}catch(e){}
 const lgi=routeLGI();
 UI.toast('⏳ '+t('report.aiNote'));
 compressPhoto(PHOTO,900,(smallPhoto)=>{
  let maxN=1000;
  DB.complaints.forEach(x=>{const m=x.id.match(/(\d+)$/);if(m)maxN=Math.max(maxN,+m[1]);});
  const id=(lgi.type==='city'?'KCC-':lgi.type==='poura'?'POUR-':'BATI-')+(maxN+1);
  const c={id,cat:SEL,title_en:desc.slice(0,60),title_bn:desc.slice(0,60),
   addr_en:addr,addr_bn:addr,area:'Sonadanga',lat:POS.lat,lng:POS.lng,status:'open',
   priority:35+Math.floor(Math.random()*20),votes:1,ageH:0.02,slaH:lgi.sla[SEL]||DB.CATS[SEL].sla,
   lgi:lgi.name,lgiType:lgi.type,assignee:null,photo:smallPhoto,
   ai:{photoConf:.93,classConf:.9,priority:45,dupOf:null},reporter:(me&&me.phone)||'+8801712345678',mine:true,
   trail:[
    {by:'ai',agent:'Photo Verifier',en:'Photo verified authentic — 93%.',bn:'ছবি যাচাইকৃত — ৯৩%.',h:-0.015},
    {by:'ai',agent:'Text Classifier',en:'Classified (90%).',bn:'শ্রেণিবদ্ধ (৯০%)।',h:-0.012},
    {by:'ai',agent:'GPS Dedup Agent',en:'No duplicate within 300 m.',bn:'৩০০ মিটারে ডুপ্লিকেট নেই।',h:-0.01},
    {by:'ai',agent:'Priority Ranker',en:'Priority score set.',bn:'অগ্রাধিকার নির্ধারিত।',h:-0.008},
    {by:'ai',agent:'LGI Router',en:'Routed to '+lgi.name+'.',bn:(I18N.lang==='bn'?lgi.name_bn:lgi.name)+'-এ পাঠানো হয়েছে।',h:-0.005}
   ]};
  DB.saveUserReport(c);
  DB.complaints.unshift(c);
  const saved=JSON.parse(localStorage.getItem('ns_my_reports')||'[]');
  if(!saved.find(x=>x.id===id)){c.photo=null;DB.saveUserReport(c);}
  UI.toast('✓ '+t('nc.success')+' → '+lgi.name);
  setTimeout(()=>{location.href='portal.html';},700);
 });
});

document.querySelectorAll('[data-plang]').forEach(b=>b.addEventListener('click',()=>I18N.setLang(b.dataset.plang)));
document.addEventListener('langchange',()=>{
 document.querySelectorAll('[data-plang]').forEach(x=>x.classList.toggle('on',x.dataset.plang===I18N.lang));
 $$('#ncCats [data-ncat]').forEach(b=>{const p=NC_CATS.find(x=>x.cat===b.dataset.ncat);b.querySelector('span:last-child').textContent=t('pcat.'+p.k);});
});
})();
