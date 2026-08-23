(function(){
const {t,tn,num}=I18N;
const FAC_TYPES=DB.FAC_TYPES;
let ME=null;
let RT={route:'overview',detailId:null};
let TB={q:'',status:'all',cat:'all',sortKey:'priority',sortDir:-1,scope:'all'};
let MV={cats:new Set(Object.keys(DB.CATS)),lgi:'all',heat:false};
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
function esc(s){return UI.esc(s);}
function destroyMaps(){UI.maps.forEach(m=>{try{m.remove();}catch(e){}});UI.maps.length=0;}
function titleOf(c){return I18N.lang==='bn'?c.title_bn:c.title_en;}
function addrOf(c){return I18N.lang==='bn'?c.addr_bn:c.addr_en;}
function noteOf(tr){return I18N.lang==='bn'?tr.bn:tr.en;}
function nameOf(f){return I18N.lang==='bn'&&f.name_bn?f.name_bn:f.name_en;}
function initials(n){return n.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();}
function staffById(id){return DB.staff.find(s=>s.id===id);}
function slaLeftH(c){return (c.createdAt+c.slaH*3600e3-Date.now())/3600e3;}

document.querySelectorAll('[data-lang-btn]').forEach(b=>b.addEventListener('click',()=>I18N.setLang(b.dataset.langBtn)));
$$('[data-dlang]').forEach(b=>b.addEventListener('click',()=>{I18N.setLang(b.dataset.dlang);}));
document.addEventListener('langchange',()=>{
 $$('[data-lang-btn],[data-dlang]').forEach(x=>x.classList.toggle('on',x.dataset.langBtn===I18N.lang||x.dataset.dlang===I18N.lang));
 if(ME)renderRoute();
});
$$('[data-ic]').forEach(el=>{el.innerHTML=UI.icon(el.dataset.ic);});

$('#f-login').addEventListener('submit',e=>{
 e.preventDefault();
 const em=$('.lg-card input[type=email]').value.toLowerCase();
 const sup=em.includes('super')||em.includes('supervisor');
 doLogin(sup?'supervisor':'staff');
});
$$('#d-login [data-role]').forEach(b=>b.addEventListener('click',()=>doLogin(b.dataset.role)));
function doLogin(role){
 ME=role==='supervisor'
  ?{name:'Rahim Uddin',role:'supervisor',id:'s1'}
  :{name:'Kamrul Hasan',role:'staff',id:'s2'};
 $('#meName').textContent=ME.name;$('#meAv').textContent=initials(ME.name);
 const mr=$('#meRole');mr.textContent=t(role==='supervisor'?'role.supervisor':'role.staff');
 mr.className='role-badge '+(role==='supervisor'?'role-supervisor':'role-staff');
 $('#teamNav').classList.toggle('hidden',role!=='supervisor');
 $('#d-login').classList.add('hidden');$('#d-shell').classList.remove('hidden');
 TB.scope=ME.role==='staff'?ME.id:'all';
 go('overview');
}
$('#btnLogout').addEventListener('click',()=>location.reload());
$$('#sb-nav a').forEach(a=>a.addEventListener('click',()=>go(a.dataset.route)));
$('#btnExportTop').addEventListener('click',exportQueuePDF);

function go(route,detailId){
 destroyMaps();RT.route=route;RT.detailId=detailId||null;
 $$('#sb-nav a').forEach(a=>a.classList.toggle('on',a.dataset.route===route));
 $('#d-title').textContent=t('d.nav.'+(route==='mapview'?'map':route));
 renderRoute();
}
let rtToken=0;
function renderRoute(){
 const fn={overview:rOverview,complaints:rComplaints,mapview:rMapView,analytics:rAnalytics,facilities:rFacilities,team:rTeam,settings:rSettings}[RT.route]||rOverview;
 const skel={overview:'stats',complaints:'rows',mapview:'map',analytics:'stats',facilities:'rows',team:'rows'}[RT.route];
 const tok=++rtToken;
 if(skel){$('#d-content').innerHTML='<div style="padding:4px 0">'+UI.skeleton(skel)+'</div>';
  setTimeout(()=>{if(tok===rtToken){fn();$('#sbCnt').textContent=num(myQueue().filter(c=>c.status==='open'||c.status==='in_progress').length);}},380);
 }else{fn();$('#sbCnt').textContent=num(myQueue().filter(c=>c.status==='open'||c.status==='in_progress').length);}
}
function myQueue(){
 let arr=DB.complaints.slice();
 if(TB.scope!=='all')arr=arr.filter(c=>c.assignee===TB.scope);
 return arr;
}

function statCard(icon,color,label,val){
 return '<div class="stat"><span class="si" style="background:'+color+'">'+UI.icon(icon,'',21)+'</span><div><b>'+num(val)+'</b><span>'+esc(label)+'</span></div></div>';
}
function rOverview(){
 const el=$('#d-content');
 const q=myQueue();
 const open=q.filter(c=>c.status==='open').length;
 const high=q.filter(c=>c.priority>60&&c.status!=='done'&&c.status!=='rejected').length;
 const prog=q.filter(c=>c.status==='in_progress').length;
 const monthAgo=Date.now()-30*24*3600e3;
 const done=q.filter(c=>c.status==='done'&&c.resolvedAtH&&(Date.now()-c.resolvedAtH*3600e3)>=monthAgo||c.status==='done'&&c.ageH<720).length;
 el.innerHTML='<div class="statgrid">'
 +statCard('case','#EAB308',t('d.stat.open'),open)
 +statCard('warn','#DC2626',t('d.stat.high'),high)
 +statCard('clock','#2563EB',t('d.stat.prog'),prog)
 +statCard('check','#16A34A',t('d.stat.done'),done)
 +'</div><div id="tblMount"></div>';
 mountTable(el.querySelector('#tblMount'));
}
function rComplaints(){const el=$('#d-content');el.innerHTML='<div id="tblMount"></div>';mountTable(el.querySelector('#tblMount'));}

function filtered(){
 let arr=myQueue();
 if(TB.q){const q=TB.q.toLowerCase();arr=arr.filter(c=>(c.id+' '+titleOf(c)+' '+addrOf(c)).toLowerCase().includes(q));}
 if(TB.status!=='all')arr=arr.filter(c=>c.status===TB.status);
 if(TB.cat!=='all')arr=arr.filter(c=>c.cat===TB.cat);
 const k=TB.sortKey;
 arr.sort((a,b)=>{
  let va,vb;
  if(k==='sla'){va=slaLeftH(a);vb=slaLeftH(b);}
  else{va=a[k];vb=b[k];}
  return (va<vb?-1:va>vb?1:0)*TB.sortDir;
 });
 return arr;
}
function mountTable(mount){
 mount.innerHTML='<div class="tbl-card"><div class="tbl-bar">'
 +'<div class="search">'+UI.icon('search','',16)+'<input class="inp" id="tbQ" placeholder="'+esc(t('d.filter.search'))+'" value="'+esc(TB.q)+'"></div>'
 +'<select class="sel" id="tbSt" style="width:auto">'
  +'<option value="all">'+esc(t('d.filter.status'))+'</option>'
  +['open','in_progress','done','rejected','merged'].map(s=>'<option value="'+s+'"'+(TB.status===s?' selected':'')+'>'+esc(UI.statusLabel(s))+'</option>').join('')+'</select>'
 +'<select class="sel" id="tbCat" style="width:auto"><option value="all">'+esc(t('d.filter.cat'))+'</option>'
  +Object.keys(DB.CATS).map(k=>'<option value="'+k+'"'+(TB.cat===k?' selected':'')+'>'+esc(t('cat.'+k))+'</option>').join('')+'</select></div>'
 +'<div class="tbl-scroll"><table class="cmp"><thead><tr>'
 +'<th data-k="id">ID</th><th></th><th>'+esc(t('d.tbl.title'))+'</th><th>'+esc(t('d.tbl.addr'))+'</th><th data-k="priority">⇅ '+esc(t('d.tbl.prio'))+'</th><th data-k="votes">⇅ '+esc(t('d.tbl.votes'))+'</th><th>'+esc(t('d.tbl.status'))+'</th><th>'+esc(t('d.tbl.assignee'))+'</th><th data-k="sla">⇅ '+esc(t('d.tbl.sla'))+'</th><th></th>'
 +'</tr></thead><tbody id="tbBody"></tbody></table></div></div>';
 $('#tbQ').addEventListener('input',e=>{TB.q=e.target.value;drawRows();});
 $('#tbSt').addEventListener('change',e=>{TB.status=e.target.value;drawRows();});
 $('#tbCat').addEventListener('change',e=>{TB.cat=e.target.value;drawRows();});
 mount.querySelectorAll('th[data-k]').forEach(th=>th.addEventListener('click',()=>{
  const k=th.dataset.k;TB.sortDir=(TB.sortKey===k)?-TB.sortDir:-1;TB.sortKey=k;drawRows();
 }));
 drawRows();
 function drawRows(){
  const arr=filtered();
  $('#tbBody').innerHTML=arr.length?arr.map(c=>{
   const st=staffById(c.assignee);
   const sla=UI.slaInfo(c);
   return '<tr data-id="'+c.id+'"><td class="cid">'+c.id+'</td><td>'+UI.catIcon(c.cat)+'</td>'
   +'<td class="tt">'+esc(titleOf(c))+'</td><td class="addr">'+esc(addrOf(c))+'</td>'
   +'<td>'+UI.prio(c.priority)+'</td><td style="font-weight:700;color:#B45309">★ '+num(c.votes)+'</td>'
   +'<td>'+UI.badge(c.status)+'</td>'
   +'<td>'+(st?'<span style="display:inline-flex;gap:6px;align-items:center"><span class="avatar navy" style="width:26px;height:26px;font-size:10.5px">'+initials(st.name)+'</span>'+esc(st.name.split(' ')[0])+'</span>':'<span class="muted">—</span>')+'</td>'
   +'<td><span class="sla '+(c.status==='done'?'':sla.cls)+'">'+UI.icon('clock','',13)+(c.status==='done'?'✓':esc(sla.txt))+'</span></td>'
   +'<td><button class="btn btn-teal btn-sm" data-view="'+c.id+'">'+esc(t('d.tbl.view'))+'</button></td></tr>';
  }).join(''):'<tr><td colspan="10">'+UI.emptyState()+'</td></tr>';
  I18N.applyI18n($('#tbBody'));
  $('#tbBody').querySelectorAll('tr[data-id]').forEach(tr=>tr.addEventListener('click',e=>openDetail(tr.dataset.id)));
 }
}
function openDetail(id){
 RT.detailId=id;
 $$('#sb-nav a').forEach(a=>a.classList.remove('on'));
 $('#d-title').textContent=id+' · '+t('d.dt.complaint');
 destroyMaps();
 const tok=++rtToken;
 $('#d-content').innerHTML='<div style="padding:4px 0">'+UI.skeleton('rows')+'</div>';
 setTimeout(()=>{if(tok===rtToken)renderDetail();},380);
}

function renderDetail(){
 const c=DB.complaints.find(x=>x.id===RT.detailId);
 const el=$('#d-content');
 if(!c){go('overview');return;}
 const st=staffById(c.assignee);
 const left=slaLeftH(c);
 const photoHTML=c.photo?'<img class="ph" src="'+c.photo+'">':'<div style="text-align:center;padding:30px">'+UI.icon(DB.CATS[c.cat].icon,'',52)+'</div>';
 el.innerHTML='<div class="d-grid"><div>'
 +(left<=0&&c.status!=='done'?'<div class="breach-banner">'+UI.icon('warn','',17)+t('d.dt.breach')+' — '+esc(UI.slaInfo(c).txt)+'</div>':'')
 +'<div class="panel" style="margin-bottom:16px"><div class="photo-box">'+photoHTML+'<span class="ai-badge" style="position:absolute;top:10px;left:10px">'+UI.icon('robot','',12)+'AI VERIFIED</span></div>'
 +'<h3 style="font-size:17px;margin-bottom:6px">'+esc(titleOf(c))+'</h3>'
 +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px">'+UI.badge(c.status)+UI.prio(c.priority)+'<b class="small muted">'+c.id+'</b></div>'
 +'<dl class="kv">'
 +'<dt>'+esc(t('report.desc'))+'</dt><dd>'+esc(I18N.lang==='bn'?c.title_bn:c.title_en)+'</dd>'
 +'<dt>'+esc(t('d.tbl.addr'))+'</dt><dd>'+esc(addrOf(c))+'</dd>'
 +'<dt>'+esc(t('d.dt.location'))+'</dt><dd class="cid">'+(+c.lat).toFixed(5)+', '+(+c.lng).toFixed(5)+' <a href="https://www.openstreetmap.org/?mlat='+c.lat+'&mlon='+c.lng+'#map=17/'+c.lat+'/'+c.lng+'" target="_blank" rel="noopener" class="link-sm">OSM ↗</a></dd>'
 +'<dt>'+esc(t('d.dt.reporter'))+'</dt><dd>'+esc(c.reporter)+'</dd>'
 +'<dt>'+esc(t('d.dt.lgi'))+'</dt><dd>'+esc(c.lgi)+'</dd>'
 +'<dt>'+esc(t('d.tbl.sla'))+'</dt><dd><span class="sla '+(c.status==='done'?'':UI.slaInfo(c).cls)+'">'+UI.icon('clock','',14)+' '+(c.status==='done'?'✓ '+esc(t('st.done')):esc(UI.slaInfo(c).txt))+'</span></dd>'
 +'</dl></div>'
 +'<div class="panel"><h4>'+UI.icon('doc','',16)+esc(t('d.dt.trail'))+'</h4>'
 +'<div>'+c.trail.map(tr=>{
   const ai=tr.by==='ai';
   return '<div class="trail-item '+(ai?'ai':'staff')+'"><div class="trail-head">'
   +'<span class="trail-who">'+(ai?'<span class="ai-tag">'+UI.icon('robot','',14)+' Agent:</span> '+esc(tr.agent):'<span class="avatar" style="width:24px;height:24px;font-size:10px">'+initials(tr.staff||'S')+'</span> '+esc(tr.staff))+'</span>'
   +'<span class="trail-ts">'+UI.timeAgo(Math.abs(tr.h))+' ago</span></div>'
   +'<p class="trail-note">'+esc(noteOf(tr))+'</p></div>';
 }).join('')+'</div></div>'
 +'</div>'
 +'<div class="panel"><h4>'+UI.icon('gear','',16)+esc(t('d.dt.actions'))+'</h4>'
 +'<div class="sla-big"><span class="tiny muted">'+esc(t('d.tbl.sla')).toUpperCase()+' ('+num(c.slaH)+esc(t('common.hours'))+')</span><b class="sla '+(c.status==='done'?'':UI.slaInfo(c).cls)+'">'+(c.status==='done'?'✓':esc(UI.slaInfo(c).txt))+'</b></div>'
 +'<label class="fld"><span class="fld-name">'+esc(t('d.dt.assign'))+'</span>'
 +'<select class="sel" id="asSel"><option value="">—</option>'+DB.staff.map(s=>'<option value="'+s.id+'"'+(c.assignee===s.id?' selected':'')+'>'+esc(s.name)+' ('+esc(t(s.role==='supervisor'?'role.supervisor':'role.staff'))+')</option>').join('')+'</select></label>'
 +'<button class="btn btn-outline btn-block act-stack" id="btnAssign" style="margin:-4px 0 14px">'+UI.icon('user','',15)+esc(t('d.dt.assignBtn'))+'</button>'
 +'<div class="act-stack">'
 +'<button class="btn btn-teal btn-block" id="btnProg" '+(c.status!=='open'?'disabled':'')+'>'+UI.icon('clock','',16)+esc(t('d.dt.markProg'))+'</button>'
 +'<label class="fld" style="margin:6px 0 0"><span class="fld-name">'+esc(t('d.dt.notes'))+'</span><textarea class="ta" id="resNotes" placeholder="'+esc(t('d.dt.notesPh'))+'" style="min-height:70px">'+esc(I18N.lang==='bn'?(c.resolution_bn||''):(c.resolution_en||''))+'</textarea><span class="ferr" id="e-notes"></span></label>'
 +'<button class="btn btn-primary btn-block" id="btnResolve" '+(c.status==='done'?'disabled':'')+'>'+UI.icon('check','',16)+esc(t('d.dt.resolve'))+'</button>'
 +'<button class="btn btn-outline btn-block" id="btnExportOne">'+UI.icon('export','',15)+esc(t('d.dt.export'))+'</button>'
 +'</div></div></div>';

 $('#btnAssign').addEventListener('click',()=>{
  const v=$('#asSel').value;if(!v)return UI.toast(t('d.dt.assign')+' → ?');
  c.assignee=v;pushTrail(c,false,ME.name,'Assigned to '+staffById(v).name+'.','স্টাফকে দায়িত্ব দেওয়া হয়েছে।');
  UI.toast('✓ '+staffById(v).name);renderDetail();
 });
 $('#btnProg').addEventListener('click',()=>{
  c.status='in_progress';pushTrail(c,false,ME.name,'Status updated: In Progress.','স্ট্যাটাস হালনাগাদঃ চলমান।');
  UI.toast('✓ '+t('d.dt.markProg'));renderDetail();refreshTitle();
 });
 $('#btnResolve').addEventListener('click',()=>{
  const notes=$('#resNotes').value.trim();
  if(!notes){const e=$('#e-notes');e.textContent=t('d.dt.needNotes');e.classList.add('show');return;}
  c.status='done';c.resolvedAtH=c.ageH;c.resolution_en=notes;c.resolution_bn=notes;
  pushTrail(c,false,ME.name,'Resolved. '+notes,'সমাধান করা হয়েছে। '+notes);
  UI.toast('✓ '+t('d.dt.resolve'));renderDetail();refreshTitle();
 });
 $('#btnExportOne').addEventListener('click',()=>exportComplaintPDF(c));
 function refreshTitle(){}
}
function pushTrail(c,ai,name,en,bn){c.trail.push(ai?{by:'ai',agent:name,en,bn,h:-0.001}:{by:'staff',staff:name,en,bn,h:-0.0005});}

function rMapView(){
 const el=$('#d-content');
 el.innerHTML='<div class="tbl-bar" style="background:#fff;border:1px solid var(--line);border-radius:14px;margin-bottom:14px">'
 +'<div class="chiprow" style="padding:0">'+Object.keys(DB.CATS).map(k=>'<button class="chip'+(MV.cats.has(k)?' on':'')+'" data-mc="'+k+'">'+UI.icon(DB.CATS[k].icon,'',13)+esc(t('cat.'+k))+'</button>').join('')+'</div>'
 +'<select class="sel" id="mvLgi" style="width:auto"><option value="all">'+esc(t('d.map.lgiType'))+'</option>'
  +[['city','d.lgi.city'],['poura','d.lgi.poura'],['union','d.lgi.union']].map(x=>'<option value="'+x[0]+'"'+(MV.lgi===x[0]?' selected':'')+'>'+esc(t(x[1]))+'</option>').join('')+'</select>'
 +'<button class="chip fac'+(MV.heat?' on':'')+'" id="mvHeat">'+UI.icon('flash','',13)+esc(t('d.map.heat'))+'</button></div>'
 +'<div class="map-wrap"><div class="map-big" id="liveMap"></div>'
 +'<div class="side-panel"><div class="panel" id="pinPanel"><p class="muted small" style="text-align:center;padding:22px 6px">'+esc(t('d.map.select'))+'</p></div>'
 +'<div class="hot-legend"><span><i style="background:#DC2626"></i>P 61–100</span><span><i style="background:#EAB308"></i>P 31–60</span><span><i style="background:#94A3B8"></i>Merged/Rejected</span><span><i style="background:#16A34A"></i>Resolved</span></div>'
 +'</div></div>';
 el.querySelectorAll('[data-mc]').forEach(ch=>ch.addEventListener('click',()=>{
  const k=ch.dataset.mc;MV.cats.has(k)?MV.cats.delete(k):MV.cats.add(k);ch.classList.toggle('on');draw();
 }));
 $('#mvLgi').addEventListener('change',e=>{MV.lgi=e.target.value;draw();});
 $('#mvHeat').addEventListener('click',()=>{MV.heat=!MV.heat;$('#mvHeat').classList.toggle('on',MV.heat);draw();});
 let heatLayer=null,pins=[];
 const m=UI.makeMap($('#liveMap'),{});if(!m)return;
 function draw(){
  pins.forEach(p=>m.removeLayer(p));pins=[];if(heatLayer){m.removeLayer(heatLayer);heatLayer=null;}
  DB.complaints.filter(c=>MV.cats.has(c.cat)&&(MV.lgi==='all'||c.lgiType===MV.lgi)&&c.status!=='rejected').forEach(c=>{
   const col=c.status==='merged'?'#94A3B8':c.status==='done'?'#16A34A':c.priority>60?'#DC2626':c.priority>30?'#EAB308':'#84CC16';
   const p=L.circleMarker([c.lat,c.lng],{radius:7+c.votes/9,color:'#fff',weight:2,fillColor:col,fillOpacity:.92}).addTo(m);
   p.on('click',()=>showPin(c,col));pins.push(p);
  });
  if(MV.heat){
   heatLayer=L.layerGroup();
   DB.HOTSPOTS.forEach(h=>{
    [[46,.16],[32,.22],[19,.3]].forEach(r=>{
     L.circle([h.lat,h.lng],{radius:r[0]*h.w*2,stroke:false,fillColor:'#DC2626',fillOpacity:r[1]}).addTo(heatLayer);
    });
   });
   heatLayer.addTo(m);
  }
 }
 function showPin(c,col){
  $('#pinPanel').innerHTML='<h4 style="display:flex;justify-content:space-between;align-items:center">'+c.id+'<span style="display:flex;gap:6px">'+UI.prio(c.priority,'sm')+UI.badge(c.status)+'</span></h4>'
  +'<b style="font-size:14px;display:block;margin:6px 0 4px">'+esc(titleOf(c))+'</b>'
  +'<p class="small muted">'+UI.icon('pin','',13)+' '+esc(addrOf(c))+'</p>'
  +'<div class="meta" style="margin-top:8px">★ '+num(c.votes)+' '+esc(t('c.votes'))+' · '+esc(t('cat.'+c.cat))+' · '+esc(c.lgi)+'</div>'
  +'<button class="btn btn-teal btn-sm btn-block" id="pinOpen" style="margin-top:12px">'+esc(t('d.tbl.view'))+' →</button>';
  $('#pinOpen').addEventListener('click',()=>openDetail(c.id));
 }
 draw();
}

function svgBars(data,maxV,w,h,colors){
 const bw=w/data.length;
 return '<svg viewBox="0 0 '+w+' '+h+'" style="width:100%">'+data.map((d,i)=>{
  const bh=(d.v/maxV)*(h-42),x=i*bw+bw*0.18,y=h-28-bh;
  return '<rect x="'+x+'" y="'+y+'" width="'+bw*0.64+'" height="'+Math.max(bh,2)+'" rx="5" fill="'+colors[i]+'"/>'
  +'<text x="'+(x+bw*0.32)+'" y="'+(y-6)+'" font-size="11" font-weight="700" text-anchor="middle" fill="#334155">'+num(d.v)+'</text>'
  +'<text x="'+(x+bw*0.32)+'" y="'+(h-10)+'" font-size="10.5" text-anchor="middle" fill="#64748B">'+esc(d.k)+'</text>';
 }).join('')+'</svg>';
}
function svgLine(series,w,h){
 const maxV=Math.max.apply(null,series.flatMap(s=>s.data))*1.15;
 const stepX=(w-50)/(series[0].data.length-1);
 let out='';
 for(let g=0;g<=4;g++){const y=14+(h-52)/4*g;out+='<line x1="40" x2="'+(w-8)+'" y1="'+y+'" y2="'+y+'" stroke="#EEF2F6"/><text x="34" y="'+(y+4)+'" font-size="10" text-anchor="end" fill="#94A3B8">'+num(Math.round(maxV-maxV/4*g))+'</text>';}
 series.forEach(s=>{
  const pts=s.data.map((v,i)=>[40+i*stepX,14+(h-52)*(1-v/maxV)]);
  out+='<polyline points="'+pts.map(p=>p.join(',')).join(' ')+'" fill="none" stroke="'+s.color+'" stroke-width="2.5"/>';
  pts.forEach(p=>out+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="3.5" fill="'+s.color+'"/>');
 });
 series[0].data.forEach((v,i)=>{out+='<text x="'+(40+i*stepX)+'" y="'+(h-8)+'" font-size="10" text-anchor="middle" fill="#94A3B8">'+esc(series[0].labels[i])+'</text>';});
 return '<svg viewBox="0 0 '+w+' '+h+'" style="width:100%">'+out+'</svg>';
}
function piePath(cx,cy,r,a0,a1){
 const large=a1-a0>Math.PI?1:0,x0=cx+r*Math.cos(a0),y0=cy+r*Math.sin(a0),x1=cx+r*Math.cos(a1),y1=cy+r*Math.sin(a1);
 return 'M '+cx+' '+cy+' L '+x0.toFixed(2)+' '+y0.toFixed(2)+' A '+r+' '+r+' 0 '+large+' 1 '+x1.toFixed(2)+' '+y1.toFixed(2)+' Z';
}
function rAnalytics(){
 const el=$('#d-content');
 const q=myQueue();
 const catKeys=Object.keys(DB.CATS);
 const catData=catKeys.map(k=>({k:t('cat.'+k),v:q.filter(c=>c.cat===k).length}));
 const catMax=Math.max.apply(null,catData.map(d=>d.v))||1;
 const active=q.filter(c=>c.status==='open'||c.status==='in_progress');
 const breached=active.filter(c=>slaLeftH(c)<=0).length;
 const breachPct=active.length?Math.round(breached/active.length*100):0;
 const stColors={open:'#EAB308',in_progress:'#2563EB',done:'#16A34A',merged:'#94A3B8',rejected:'#DC2626'};
 const stData=['open','in_progress','done','merged','rejected'].map(s=>({k:UI.statusLabel(s),v:q.filter(c=>c.status===s).length,c:stColors[s]})).filter(d=>d.v>0);
 const tot=stData.reduce((a,b)=>a+b.v,0)||1;
 let ang=-Math.PI/2,pie='';
 stData.forEach(d=>{const a2=ang+d.v/tot*Math.PI*2;pie+='<path d="'+piePath(110,105,78,ang,a2)+'" fill="'+d.c+'" stroke="#fff" stroke-width="2"/>';ang=a2;});
 const hot=DB.HOTSPOTS.slice().sort((a,b)=>b.n-a.n);
 el.innerHTML='<div class="charts">'
 +'<div class="chart-card wide" style="display:flex;justify-content:flex-end;gap:10px;align-items:center"><h4 style="flex:1;margin:0">'+esc(t('d.an.title'))+' — '+esc(ME.role==='supervisor'?t('role.supervisor'):t('role.staff'))+'</h4><button class="btn btn-outline btn-sm" id="anExport">'+UI.icon('export','',14)+esc(t('d.dt.export'))+'</button></div>'
 +'<div class="chart-card"><h4>'+esc(t('d.an.bar'))+'</h4>'+svgBars(catData,catMax,420,210,catKeys.map(k=>DB.CATS[k].color))+'</div>'
  +'<div class="chart-card"><h4>'+esc(t('d.an.line'))+'</h4>'+svgLine([{data:DB.WEEKLY.map(x=>x.sub),labels:DB.WEEKLY.map(x=>x.w),color:'#CBD5E1'},{data:DB.WEEKLY.map(x=>x.done),labels:DB.WEEKLY.map(x=>x.w),color:'#1E5240'}],420,200)+'<div class="legend"><span><i style="background:#CBD5E1"></i>Submitted</span><span><i style="background:#1E5240"></i>Resolved</span></div></div>'
 +'<div class="chart-card"><h4>'+esc(t('d.an.avg'))+'</h4>'+catKeys.map(k=>'<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><b>'+esc(t('cat.'+k))+'</b><span class="muted">'+num(DB.AVG_HRS[k])+esc(t('common.hours'))+'</span></div><div class="loadbar" style="width:100%"><i style="width:'+(DB.AVG_HRS[k]/100*100)+'%;background:'+DB.CATS[k].color+'"></i></div></div>').join('')+'</div>'
 +'<div class="chart-card"><h4>'+esc(t('d.an.breach'))+'</h4><div style="display:flex;align-items:center;gap:18px"><svg viewBox="0 0 120 130" style="width:130px"><circle cx="110" cy="105" r="78" fill="none"/><circle cx="110" cy="105" r="62" fill="none"/><g transform="rotate(-90 110 105)"><circle cx="110" cy="105" r="48" fill="none" stroke="#FEE2E2" stroke-width="13"/><circle cx="110" cy="105" r="48" fill="none" stroke="#DC2626" stroke-width="13" stroke-linecap="round" stroke-dasharray="'+(301.6*breachPct/100)+' 999"/></g><text x="110" y="112" text-anchor="middle" font-size="20" font-weight="800" fill="#DC2626">'+num(breachPct)+'%</text></svg><div class="small muted"><b style="color:var(--text);font-size:15px">'+num(breached)+' / '+num(active.length)+'</b><br>'+esc(t('d.stat.open'))+' + '+esc(t('d.stat.prog'))+'<br>past SLA deadline</div></div></div>'
 +'<div class="chart-card"><h4>'+esc(t('d.an.hot'))+'</h4><table class="cmp" style="min-width:0"><thead><tr><th>#</th><th>'+esc(t('d.an.area'))+'</th><th>'+esc(t('d.an.count'))+'</th></tr></thead><tbody>'+hot.map((h,i)=>'<tr><td class="cid">'+num(i+1)+'</td><td style="font-weight:600">'+esc(I18N.lang==='bn'?h.area_bn:h.area_en)+'</td><td><b>'+num(h.n)+'</b></td></tr>').join('')+'</tbody></table></div>'
 +'<div class="chart-card"><h4>'+esc(t('d.an.pie'))+'</h4><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><svg viewBox="0 0 220 210" style="width:190px">'+pie+'<text x="110" y="112" text-anchor="middle" font-size="21" font-weight="800" fill="#0F172A">'+num(tot)+'</text><text x="110" y="128" text-anchor="middle" font-size="10" fill="#64748B">total</text></svg><div class="legend" style="flex-direction:column;align-items:flex-start">'+stData.map(d=>'<span><i style="background:'+d.c+'"></i>'+esc(d.k)+' — <b>'+num(d.v)+'</b></span>').join('')+'</div></div></div>'
 +'</div>';
 $('#anExport').addEventListener('click',exportQueuePDF);
}

let facNextId=100;
function rFacilities(){
 const el=$('#d-content');
 el.innerHTML='<div class="tbl-card"><div class="tbl-bar"><h4 style="flex:1;margin:0">'+esc(t('d.fm.title'))+' — 🏛 Khulna City Corporation</h4><button class="btn btn-primary btn-sm" id="facAdd">'+UI.icon('plus','',14)+esc(t('d.fm.add'))+'</button></div>'
 +'<div class="tbl-scroll"><table class="cmp" style="min-width:820px"><thead><tr><th>ID</th><th>'+esc(t('d.fm.name'))+'</th><th>'+esc(t('d.fm.type'))+'</th><th>'+esc(t('d.fm.lat'))+'</th><th>'+esc(t('d.fm.lng'))+'</th><th>'+esc(t('d.fm.phone'))+'</th><th>'+esc(t('d.fm.active'))+'</th><th></th></tr></thead><tbody id="facBody"></tbody></table></div></div>';
 $('#facAdd').addEventListener('click',()=>facModal(null));
 drawFac();
 function drawFac(){
  $('#facBody').innerHTML=DB.facilities.map(f=>{
   const ft=FAC_TYPES[f.type];
   return '<tr><td class="cid">#'+num(f.id)+'</td><td style="display:flex;gap:9px;align-items:center"><span class="fac-ic" style="width:30px;height:30px;border-radius:8px;background:'+ft.color+'">'+UI.icon(ft.icon,'',15)+'</span><b>'+esc(nameOf(f))+'</b></td>'
   +'<td><span class="badge" style="background:'+ft.color+'18;color:'+ft.color+'">'+esc(t('fac.'+f.type))+'</span></td>'
   +'<td class="cid">'+f.lat+'</td><td class="cid">'+f.lng+'</td><td>'+esc(f.phone)+'</td>'
   +'<td><button class="switch'+(f.active?' on':'')+'" data-sw="'+f.id+'"></button></td>'
   +'<td><span class="fm-actions"><button class="icbtn" data-ed="'+f.id+'">'+UI.icon('edit','',15)+'</button><button class="icbtn del" data-dl="'+f.id+'">'+UI.icon('trashS','',15)+'</button></span></td></tr>';
  }).join('');
  $$('#facBody [data-sw]').forEach(sw=>sw.addEventListener('click',()=>{const f=DB.facilities.find(x=>x.id==sw.dataset.sw);f.active=!f.active;drawFac();}));
  $$('#facBody [data-ed]').forEach(b=>b.addEventListener('click',()=>facModal(DB.facilities.find(x=>x.id==b.dataset.ed))));
  $$('#facBody [data-dl]').forEach(b=>b.addEventListener('click',()=>{
   if(confirm(t('d.fm.confirm'))){DB.facilities=DB.facilities.filter(x=>x.id!=b.dataset.dl);UI.toast('🗑 '+t('d.fm.del'));drawFac();}
  }));
 }
}
function facModal(f){
 const isNew=!f;
 f=f||{type:'toilet',active:true,lat:'23.75',lng:'90.39'};
 const bg=UI.openModal('<div class="modal-hd"><h3>'+esc(isNew?t('d.fm.add'):t('d.fm.edit'))+'</h3><button class="xbtn" data-close>'+UI.icon('x','',16)+'</button></div>'
 +'<div class="modal-bd"><form id="facForm" novalidate>'
 +'<label class="fld"><span class="fld-name">'+esc(t('d.fm.name'))+'</span><input class="inp" id="ffName" value="'+esc(isNew?'':nameOf(f))+'"><span class="ferr" id="fe-name"></span></label>'
 +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
 +'<label class="fld"><span class="fld-name">'+esc(t('d.fm.type'))+'</span><select class="sel" id="ffType">'+Object.keys(FAC_TYPES).map(k=>'<option value="'+k+'"'+(f.type===k?' selected':'')+'>'+esc(t('fac.'+k))+'</option>').join('')+'</select></label>'
 +'<label class="fld"><span class="fld-name">'+esc(t('d.fm.phone'))+'</span><input class="inp" id="ffPhone" value="'+esc(f.phone||'')+'"></label>'
 +'<label class="fld"><span class="fld-name">'+esc(t('d.fm.lat'))+'</span><input class="inp" id="ffLat" value="'+f.lat+'"></label>'
 +'<label class="fld"><span class="fld-name">'+esc(t('d.fm.lng'))+'</span><input class="inp" id="ffLng" value="'+f.lng+'"></label>'
 +'</div><label style="display:flex;gap:9px;align-items:center;font-weight:600;font-size:13.5px"><button type="button" class="switch'+(f.active?' on':'')+'" id="ffActive"></button><span id="ffActLbl">'+esc(t(f.active?'d.fm.active':'d.fm.inactive'))+'</span></label>'
 +'<div style="display:flex;gap:10px;margin-top:16px"><button type="button" class="btn btn-outline" data-close style="flex:1">'+esc(t('common.cancel'))+'</button><button class="btn btn-primary" style="flex:1">'+esc(t('common.save'))+'</button></div>'
 +'</form></div>');
 bg.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>bg.remove()));
 const sw=bg.querySelector('#ffActive');let act=f.active;
 sw.addEventListener('click',()=>{act=!act;sw.classList.toggle('on',act);sw.nextElementSibling.textContent=t(act?'d.fm.active':'d.fm.inactive');});
 bg.querySelector('#facForm').addEventListener('submit',e=>{
  e.preventDefault();
  const name=bg.querySelector('#ffName').value.trim();
  if(!name){const fe=bg.querySelector('#fe-name');fe.textContent=t('err.titleReq').replace('শিরোনাম','নাম');fe.classList.add('show');return;}
  const rec={id:isNew?++facNextId+90:f.id,type:bg.querySelector('#ffType').value,name_en:name,name_bn:name,phone:bg.querySelector('#ffPhone').value,lat:+bg.querySelector('#ffLat').value,lng:+bg.querySelector('#ffLng').value,active:act};
  if(isNew)DB.facilities.unshift(rec);else Object.assign(DB.facilities.find(x=>x.id==f.id),rec);
  bg.remove();UI.toast('✓ '+t('common.save'));rFacilities();
 });
}

function rTeam(){
 const el=$('#d-content');
 el.innerHTML='<h4 class="muted" style="margin-bottom:14px">'+esc(t('d.tm.title'))+' — 🏛 Khulna City Corporation</h4>'
 +DB.staff.map(s=>{
  const mine=DB.complaints.filter(c=>c.assignee===s.id&&c.status!=='done'&&c.status!=='rejected');
  const pct=Math.min(100,Math.round(mine.length/s.capacity*100));
  const col=pct>85?'#DC2626':pct>60?'#EAB308':'#16A34A';
  return '<div class="panel" style="margin-bottom:12px;cursor:pointer" data-team="'+s.id+'">'
  +'<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">'
  +'<span class="avatar lg '+(s.role==='supervisor'?'orange':'')+'">'+initials(s.name)+'</span>'
  +'<div style="flex:1;min-width:140px"><b>'+esc(s.name)+'</b> <span class="role-badge '+(s.role==='supervisor'?'role-supervisor':'role-staff')+'">'+esc(t(s.role==='supervisor'?'role.supervisor':'role.staff'))+'</span><div class="tiny muted">ID: ST-'+s.id.toUpperCase()+' · ☎ 01XXXXXXXXX</div></div>'
  +'<div><div class="tiny muted" style="margin-bottom:4px;text-align:right">'+esc(t('d.tm.load'))+': <b>'+num(mine.length)+'</b> / '+num(s.capacity)+' '+esc(t('d.tm.capacity'))+'</div><div class="loadbar"><i style="width:'+pct+'%;background:'+col+'"></i></div></div>'
  +UI.icon('fwd','',16)
  +'</div><div class="hidden subtbl" data-sub="'+s.id+'">'
  +(mine.length?mine.map(c=>'<div style="display:flex;gap:10px;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px dashed var(--line)">'
   +'<span class="small"><b class="cid">'+c.id+'</b> · '+esc(titleOf(c).slice(0,38))+'… '+UI.prio(c.priority,'sm')+'</span>'
   +'<span style="display:flex;gap:8px;align-items:center"><label class="tiny muted">'+esc(t('d.tm.move'))+'</label><select class="sel" style="width:auto;padding:5px 8px;font-size:12px" data-rf="'+c.id+'">'
   +DB.staff.filter(x=>x.id!==s.id).map(o=>'<option value="'+o.id+'">'+esc(o.name)+'</option>').join('')+'</select>'
   +'<button class="btn btn-outline btn-sm" data-go="'+c.id+'">'+esc(t('d.tm.move'))+' →</button></span></div>').join('')
  :'<p class="small muted" style="padding:6px 0">'+esc(t('d.tm.none'))+'</p>')+'</div></div>';
 }).join('');
 el.querySelectorAll('[data-team]').forEach(p=>p.addEventListener('click',e=>{
  if(e.target.closest('[data-rf]')||e.target.closest('[data-go]'))return;
  p.querySelector('[data-sub]').classList.toggle('hidden');
 }));
 el.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',e=>{
  e.stopPropagation();
  const cid=b.dataset.go,val=b.closest('span').querySelector('[data-rf]').value;
  const c=DB.complaints.find(x=>x.id===cid);const to=staffById(val);
  c.assignee=val;pushTrail(c,false,ME.name,'Reassigned to '+to.name+'.','পুনরায় দায়িত্ব দেওয়া হয়েছে।');
  UI.toast('→ '+to.name);rTeam();
 }));
}

function rSettings(){
 const el=$('#d-content');
 el.innerHTML='<div class="panel set-panel"><h4>'+UI.icon('gear','',17)+esc(t('d.set.title'))+'</h4>'
 +'<div class="set-row"><div><b>'+esc(t('d.set.lgi'))+'</b><div class="tiny muted">🏛 Khulna City Corporation · Ward 21 · est. 1884</div></div><span class="badge st-done">✓ Active</span></div>'
 +'<div class="set-row"><div><b>'+esc(t('d.set.zone'))+'</b><div class="tiny muted">Sonadanga · Khalishpur · Kotwali · Daulatpur · Khan Jahan Ali · Rupsa</div></div><button class="btn btn-outline btn-sm">'+esc(t('d.fm.edit'))+'</button></div>'
 +'<div class="set-row"><div><b>'+esc(t('d.set.sla'))+'</b><div class="tiny muted">'+esc(t('cat.electricity'))+'/Gas 24h · '+esc(t('cat.water'))+' 48h · '+esc(t('cat.sanitation'))+' 36h · Road 72h</div></div><button class="btn btn-outline btn-sm">'+esc(t('d.fm.edit'))+'</button></div>'
 +'<div class="set-row"><b>'+esc(t('d.set.lang'))+'</b><span class="lang-seg"><button data-setlang="bn">বাংলা</button><button data-setlang="en">English</button></span></div>'
 +'</div>';
 el.querySelectorAll('[data-setlang]').forEach(b=>b.addEventListener('click',()=>I18N.setLang(b.dataset.setlang)));
}

function ltrHead(){
 return '<div class="ltr-head"><div class="ltr-emblem">KCC</div><div><h1>Khulna City Corporation</h1><p>Nagar Bhaban, Upashahar, Khulna-9100 · khulnacity.gov.bd<br>Nagorik Sheba — Official Complaint Report / দাপ্তরিক অভিযোগ রিপোর্ট</p></div><div style="margin-left:auto;text-align:right;font-size:10.5pt">Generated: '+new Date().toLocaleString()+'<br>By: '+esc(ME.name)+' ('+esc(ME.role)+')</div></div>';
}
function exportComplaintPDF(c){
 $('#printArea').innerHTML=ltrHead()
 +'<h3 style="margin:8px 0">Complaint '+c.id+' — '+esc(c.title_en)+'</h3>'
 +'<table class="pr"><tr><th>Status</th><td>'+c.status.toUpperCase()+'</td><th>Priority</th><td>'+c.priority+' / 100</td></tr>'
 +'<tr><th>Category</th><td>'+c.cat+'</td><th>Votes</th><td>'+c.votes+'</td></tr>'
 +'<tr><th>Address</th><td colspan="3">'+esc(c.addr_en)+' (GPS: '+c.lat+', '+c.lng+')</td></tr>'
 +'<tr><th>Reporter</th><td colspan="3">'+esc(c.reporter)+'</td></tr>'
 +'<tr><th>SLA</th><td colspan="3">'+c.slaH+' hours — '+(c.status==='done'?'RESOLVED within policy':(slaLeftH(c)>0?Math.max(0,Math.round(slaLeftH(c)))+' hours remaining':'BREACHED'))+'</td></tr>'
 +(c.resolution_en?'<tr><th>Resolution notes</th><td colspan="3">'+esc(c.resolution_en)+'</td></tr>':'')
 +'</table><h3 style="margin:14px 0 6px">AI Audit Trail (COMPLAINT_TRAIL)</h3><div class="pr-trail">'
 +c.trail.map(tr=>'<div><b>'+(tr.by==='ai'?'🤖 AGENT '+tr.agent:'👤 '+tr.staff)+'</b> — '+esc(tr.by==='ai'?tr.en:tr.en)+'<br><small>'+new Date(Date.now()-Math.abs(tr.h)*3600e3).toLocaleString()+'</small></div>').join('')
 +'</div><div class="ltr-foot"><div class="sig">'+esc(ME.name)+'<br><small>Signature / স্বাক্ষর</small></div></div>';
 window.print();
}
function exportQueuePDF(){
 const arr=filtered();
 $('#printArea').innerHTML=ltrHead()
 +'<h3 style="margin:8px 0">Complaint Queue Report — '+arr.length+' records</h3>'
 +'<table class="pr"><tr><th>ID</th><th>Title</th><th>Category</th><th>Priority</th><th>Status</th><th>SLA</th></tr>'
 +arr.map(c=>'<tr><td>'+c.id+'</td><td>'+esc(c.title_en.slice(0,42))+'</td><td>'+c.cat+'</td><td>'+c.priority+'</td><td>'+c.status+'</td><td>'+(c.status==='done'?'Done':Math.round(slaLeftH(c))+'h')+'</td></tr>').join('')
 +'</table><div class="ltr-foot"><div class="sig">'+esc(ME.name)+'<br><small>Signature / স্বাক্ষর</small></div></div>';
 window.print();
}
})();
