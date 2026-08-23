(function(){
const {t,tn,num}=I18N;
const FT=DB.FAC_TYPES;
const CITY=[22.8103,89.5626];
const params=new URLSearchParams(location.search||'');
const TYPE=params.get('type')||'toilet';
const IS_SERVICE=!!params.get('type');
let state={area:null,q:''};
const $=s=>document.querySelector(s);
function nameOf(f){return I18N.lang==='bn'&&f.name_bn?f.name_bn:f.name_en;}
function addrOf(f){return I18N.lang==='bn'&&f.addr_bn?f.addr_bn:f.addr_en;}
function areaName(a){return I18N.lang==='bn'?a.name_bn:a.name_en;}
function distKm(from,lat,lng){const dLa=(lat-from[0])*111.32,dLo=(lng-from[1])*111.32*Math.cos(from[0]*Math.PI/180);return Math.sqrt(dLa*dLa+dLo*dLo);}
function origin(){if(state.area)return[state.area.lat,state.area.lng];return CITY;}

function buildHeader(){
 const el=document.getElementById('pubHeader');if(!el)return;
 el.innerHTML='<div class="bar">'
 +'<span class="pub-logo">ন</span><span class="pub-name">নাগরিক সেবা</span><span class="sp"></span>'
 +'<span class="lang-seg pub-lang"><button data-plang="bn" class="'+(I18N.lang==='bn'?'on':'')+'">বাংলা</button><button data-plang="en" class="'+(I18N.lang==='en'?'on':'')+'">EN</button></span>'
 +(IS_SERVICE?'<a class="btn-cream" href="index.html">← '+t('svc.back')+'</a>':'<a class="btn-cream" href="auth.html">'+t('landing.login')+'</a>')
 +'<a class="btn-gold" href="auth.html?tab=signup">'+t('landing.signup')+'</a>'
 +'</div>';
}
function buildHero(){
 document.title=t('fac.'+TYPE)+' — নাগরিক সেবা';
 const h=$('#svcHero');if(!h)return;
 const meta=FT[TYPE];
 h.innerHTML='<h1><span class="em">'+meta.emoji+'</span> '+t('fac.'+TYPE)+'</h1>'
 +(meta.hotline?'<span class="hotline-chip"><span class="em">☎</span>'+t('svc.hotline')+': '+meta.hotline+'</span>':'')
 +'<span class="count-chip" id="cntChip"></span>';
}
function buildChips(){
 const el=$('#svcChips');if(!el)return;
 el.innerHTML=Object.keys(FT).map(k=>'<a class="svc-chip'+(k===TYPE?' on':'')+'" href="service.html?type='+k+'"><span class="em">'+FT[k].emoji+'</span>'+t('fac.'+k)+'</a>').join('');
}
function filteredFac(){
 let arr=DB.facilities.filter(f=>f.type===TYPE);
 if(state.area)arr=arr.slice().sort((a,b)=>distKm(origin(),a.lat,a.lng)-distKm(origin(),b.lat,b.lng));
 if(state.q){const q=state.q.toLowerCase();arr=arr.filter(f=>(nameOf(f)+' '+addrOf(f)).toLowerCase().includes(q));}
 return arr;
}
function facItem(f){
 const meta=FT[f.type];
 const d=distKm(origin(),f.lat,f.lng);
 return '<a class="fac-item" href="service.html?type='+f.type+'">'
 +'<span class="fac-sq" style="background:'+meta.color+'">'+meta.emoji+'</span>'
 +'<span style="flex:1;min-width:0"><b>'+UI.esc(nameOf(f))+'</b>'
 +'<span class="sub"><span class="dist">'+tn('c.kmAway',{n:num(d.toFixed(1))})+'</span> · '+UI.esc(addrOf(f))
 +(f.phone?' <span class="tel-chip">☎ '+UI.esc(f.phone)+'</span>':'')
 +(f.active?'':' · <span style="color:#B91C1C">'+t('d.fm.inactive')+'</span>')+'</span></span>'
 +'<span class="fac-cta">'+t('pub.viewAll')+' →</span></a>';
}
function renderList(){
 const list=$('#facList');if(!list)return;
 const arr=filteredFac();
 const cnt=$('#cntChip');if(cnt)cnt.innerHTML=num(arr.length)+' '+t('svc.results');
 const rl=$('#resultLine');
 if(rl)rl.innerHTML=state.area
  ?('📍 '+t('portal.nearLbl')+': <b>'+UI.esc(areaName(state.area))+'</b> · '+num(arr.length)+' '+t('svc.results'))
  :(num(arr.length)+' '+t('svc.results'));
 list.innerHTML=arr.length?arr.map(facItem).join(''):UI.emptyState();
 I18N.applyI18n(list);
}
let mapInst=null;
function renderMap(){
 const el=$('#pubMap')||$('#svcMap');if(!el)return;
 if(mapInst){try{mapInst.remove();}catch(e){}}
 const m=UI.makeMap(el,{center:origin(),zoom:state.area?14:12.6});
 mapInst=m;if(!m)return;
 DB.facilities.filter(f=>f.type===TYPE).forEach(f=>{
  const meta=FT[f.type];
  L.circleMarker([f.lat,f.lng],{radius:9,color:'#fff',weight:2.5,fillColor:meta.color,fillOpacity:.95}).addTo(m)
   .bindPopup('<b>'+UI.esc(nameOf(f))+'</b><br>'+UI.esc(addrOf(f))+(f.phone?'<br>☎ '+UI.esc(f.phone):''));
 });
 if(state.area){
  L.circleMarker([state.area.lat,state.area.lng],{radius:7,color:'#fff',weight:3,fillColor:'#17402F',fillOpacity:1}).addTo(m)
   .bindTooltip('📍 '+UI.esc(areaName(state.area)),{direction:'top',permanent:false});
 }
}

function attachAreaDrop(input,drop,onPick,onClear){
 if(!input||!drop)return;
 function renderDrop(items){
  drop.innerHTML='<div class="ac-item ac-all" data-reset="1">🌐 '+t('svc.allAreas')+'</div>'
  +items.map(a=>'<div class="ac-item" data-en="'+UI.esc(a.name_en)+'"><span class="pinem">📍</span>'+UI.esc(areaName(a))+'<small>'+num(distKm(CITY,a.lat,a.lng).toFixed(1))+' km</small></div>').join('');
  drop.classList.remove('hidden');
  drop.querySelectorAll('[data-reset]').forEach(x=>x.addEventListener('mousedown',e=>{e.preventDefault();onClear();}));
  drop.querySelectorAll('[data-en]').forEach(x=>x.addEventListener('mousedown',e=>{
   e.preventDefault();
   const a=DB.AREAS.find(ar=>ar.name_en===x.dataset.en);
   onPick(a||{name_en:x.dataset.en,name_bn:x.dataset.en,lat:+x.dataset.lat||0,lng:+x.dataset.lng||0});
  }));
 }
 input.addEventListener('focus',()=>{if(!input.value.trim())renderDrop(DB.AREAS.slice(0,8));});
 input.addEventListener('blur',()=>setTimeout(()=>drop.classList.add('hidden'),150));
 return renderDrop;
}

function bindSearch(){
 const box=$('#pubSearch');
 if(box){
  const drop=$('#acDrop');
  const renderDrop=attachAreaDrop(box,drop,
   a=>{state.area=a;state.q='';box.value=areaName(a);drop.classList.add('hidden');renderList();renderMap();},
   ()=>{state.area=null;state.q='';box.value='';drop.classList.add('hidden');renderList();renderMap();}
  );
  box.addEventListener('input',()=>{
   const v=box.value.trim();
   if(state.area&&box.value===areaName(state.area)){drop.classList.add('hidden');return;}
   state.area=null;state.q=v;
   if(!v){drop.classList.add('hidden');renderList();return;}
   if(renderDrop)renderDrop(DB.AREAS.filter(a=>(a.name_en+' '+a.name_bn).toLowerCase().includes(v.toLowerCase())).slice(0,6));
   renderList();
  });
 }
 const loc=$('#locSearch');
 if(loc){
  const drop=$('#acDrop2')||$('#acDrop');
  const renderDrop=attachAreaDrop(loc,drop,
   a=>{state.area=a;loc.value=areaName(a);drop.classList.add('hidden');renderList();renderMap();},
   ()=>{state.area=null;loc.value='';drop.classList.add('hidden');renderList();renderMap();}
  );
  loc.addEventListener('input',()=>{
   const v=loc.value.trim();
   if(state.area&&loc.value===areaName(state.area)){drop.classList.add('hidden');return;}
   state.area=null;
   if(!v){drop.classList.add('hidden');renderList();renderMap();return;}
   if(renderDrop)renderDrop(DB.AREAS.filter(a=>(a.name_en+' '+a.name_bn).toLowerCase().includes(v.toLowerCase())).slice(0,8));
  });
 }
}

document.addEventListener('click',e=>{
 const b=e.target.closest('[data-plang]');
 if(b)I18N.setLang(b.dataset.plang);
});
document.addEventListener('langchange',()=>{
 document.querySelectorAll('[data-plang]').forEach(x=>x.classList.toggle('on',x.dataset.plang===I18N.lang));
 buildHeader();buildHero();buildChips();renderList();renderMap();
 if(state.area){['#locSearch','#pubSearch'].forEach(s=>{const i=$(s);if(i)i.value=areaName(state.area);});}
});

buildHeader();buildHero();buildChips();bindSearch();renderList();renderMap();
document.querySelectorAll('[data-ic]').forEach(el=>{el.innerHTML=UI.icon(el.dataset.ic);});
})();
