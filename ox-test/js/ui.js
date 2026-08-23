(function(){
const ICONS={
road:'<path d="M4 20 9 4M15 4l5 16M12 5v3m0 3v3m0 3v2"/>',
water:'<path d="M12 3c3.5 4.2 6 7.3 6 10.2A6 6 0 0 1 6 13.2C6 10.3 8.5 7.2 12 3Z"/>',
bolt:'<path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z"/>',
gas:'<path d="M12 2c1 3-2 4.5-2 7a2.5 2.5 0 0 0 5 0c0-.8-.3-1.5-.7-2.2C16.5 8 18 9.8 18 12.5A6 6 0 0 1 6 13c0-4 4-6.5 6-11Z"/><path d="M8 21h8"/>',
trash:'<path d="M4 7h16M9 7V4h6v3m-9.5 0 .8 13h11.4l.8-13M10 11v6m4-6v6"/>',
pin:'<path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
bell:'<path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
home:'<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>',
map:'<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14m6-10v14"/>',
plus:'<path d="M12 5v14M5 12h14"/>',
case:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>',
camera:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="m8 7 1.5-3h5L16 7"/><circle cx="12" cy="13.5" r="3.5"/>',
check:'<path d="m4 12.5 5 5L20 6.5"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
vote:'<path d="M7 10v11H4V10h3Zm3 11V10l3-7 1.6.8a2 2 0 0 1 1 2.3L14.8 9H19a2 2 0 0 1 2 2.4l-1.5 7A2 2 0 0 1 17.5 20H10Z"/>',
share:'<circle cx="6" cy="12" r="2.6"/><circle cx="17" cy="6" r="2.6"/><circle cx="17" cy="18" r="2.6"/><path d="m8.4 10.8 6.2-3.5m-6.2 5.4 6.2 3.5"/>',
robot:'<rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M12 8V4m0 0h3M9 13h.01M15 13h.01M9.5 16.5h5M2 12v3m20-3v3"/>',
back:'<path d="M15 5l-7 7 7 7"/>',
fwd:'<path d="m9 5 7 7-7 7"/>',
phone:'<path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
nav:'<path d="m3 11 18-8-8 18-2.5-7.5L3 11Z"/>',
doc:'<path d="M6 2h9l5 5v15H6V2Z"/><path d="M14 2v6h6M9 13h6m-6 4h6"/>',
chart:'<path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/>',
gear:'<circle cx="12" cy="12" r="3.2"/><path d="M19 12a7 7 0 0 0-.2-1.6l2.1-1.6-2-3.4-2.5 1a7 7 0 0 0-2.7-1.6L13.3 2h-2.6l-.4 2.8a7 7 0 0 0-2.7 1.6l-2.5-1-2 3.4L5.2 10A7 7 0 0 0 5 12c0 .5.1 1.1.2 1.6L3.1 15.2l2 3.4 2.5-1a7 7 0 0 0 2.7 1.6l.4 2.8h2.6l.4-2.8a7 7 0 0 0 2.7-1.6l2.5 1 2-3.4-2.1-1.6c.1-.5.2-1.1.2-1.6Z"/>',
team:'<circle cx="9" cy="9" r="3.4"/><path d="M2.5 20c.9-3.3 3.6-5 6.5-5s5.6 1.7 6.5 5"/><circle cx="17.5" cy="8" r="2.6"/><path d="M15.5 15.4c2.7.2 5.2 1.7 6 4.6"/>',
logout:'<path d="M9 4H5v16h4M14 8l4 4-4 4M8 12h10"/>',
shield:'<path d="M12 2 4 5.5V11c0 5 3.4 8.9 8 11 4.6-2.1 8-6 8-11V5.5L12 2Z"/><path d="m8.5 11.5 2.5 2.5 4.5-4.5"/>',
warn:'<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4m0 3h.01"/>',
search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
filter:'<path d="M3 5h18M6 12h12M10 19h4"/>',
export:'<path d="M12 15V3m0 0L7 8m5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
edit:'<path d="M14 4.5 19.5 10 8.5 21H3v-5.5L14 4.5Z"/><path d="m12.5 6 5.5 5.5"/>',
trashS:'<path d="M4 7h16M9 7V4h6v3m-9.5 0 .8 13h11.4l.8-13"/>',
x:'<path d="M6 6l12 12M18 6 6 18"/>',
idcard:'<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><circle cx="8.5" cy="11" r="2.3"/><path d="M5 16.5c.7-1.7 2-2.5 3.5-2.5s2.8.8 3.5 2.5M15 9.5h4m-4 4h4"/>',
toilet:'<circle cx="12" cy="4.5" r="2"/><path d="M9 21v-6H8l1.5-7h5L16 15h-1v6"/>',
fire:'<path d="M12 3c.8 2.6-.8 3.9-1.8 5.5-1 1.5-1.7 3-.7 5.2A4.6 4.6 0 0 0 12 21c2.8 0 5-2 5-5 0-1.6-.7-2.8-1.5-4-.3 1-.9 1.7-1.7 2 .4-3.4-.6-7.5-1.8-11Z"/>',
flash:'<path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z"/>',
drop:'<path d="M12 3c3.5 4.2 6 7.3 6 10.2A6 6 0 0 1 6 13.2C6 10.3 8.5 7.2 12 3Z"/>',
build:'<rect x="4" y="3" width="16" height="18"/><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-3h4v3"/>'
};
function icon(n,cls,sz){return '<svg class="'+(cls||'')+'" width="'+(sz||18)+'" height="'+(sz||18)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(ICONS[n]||ICONS.pin)+'</svg>';}
function catIcon(cat){const c=DB.CATS[cat];if(!c)return icon('pin');return '<span style="display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9px;background:'+c.color+'18;color:'+c.color+';flex:none">'+icon(c.icon,'',16)+'</span>';}
function statusKey(s){return {open:'st-open',in_progress:'st-progress',done:'st-done',rejected:'st-rejected',merged:'st-merged'}[s];}
function statusLabel(s){return I18N.t({open:'st.open',in_progress:'st.progress',done:'st.done',rejected:'st.rejected',merged:'st.merged'}[s]);}
function badge(s){return '<span class="badge '+statusKey(s)+'"><span class="dot"></span>'+statusLabel(s)+'</span>';}
function prioClass(p){return p>60?'high':p>30?'mid':'low';}
function prio(p,cls){return '<span class="prio '+prioClass(p)+' '+(cls||'')+'" title="Priority: '+p+'">'+I18N.num(p)+'</span>';}
function slaInfo(cmp){
 if(cmp.status==='done')return {txt:I18N.t('st.done'),cls:''};
 const left=(cmp.createdAt+cmp.slaH*3600e3-Date.now())/3600e3;
 if(left<=0)return {txt:I18N.tn('c.hrsLeft',{n:0}),cls:'breach'};
 return {txt:I18N.tn('c.hrsLeft',{n:I18N.num(Math.round(left))}),cls:left<6?'danger':left<24?'warn':''};
}
function timeAgo(hAgo){
 const m=hAgo*60;
 if(m<60)return I18N.t('c.minAgo');
 if(hAgo<24)return I18N.tn('c.hAgo',{n:I18N.num(Math.floor(hAgo))});
 return I18N.tn('c.dAgo',{n:I18N.num(Math.floor(hAgo/24))});
}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
let toastT;
function toast(msg){let el=document.getElementById('toast');if(!el){el=document.createElement('div');el.id='toast';el.className='toast';document.body.appendChild(el);}el.textContent=msg;el.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('show'),2600);}
function openModal(html){const bg=document.createElement('div');bg.className='modal-bg';bg.innerHTML='<div class="modal">'+html+'</div>';bg.addEventListener('click',e=>{if(e.target===bg)bg.remove();});bg.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>bg.remove()));document.body.appendChild(bg);I18N.applyI18n(bg);return bg;}
function skeleton(tpl){const T={cards:'<div class="skelwrap">'+'<div class="sk-card skel"></div>'.repeat(4)+'</div>',rows:'<div class="skelwrap">'+'<div class="sk-line skel w80"></div><div class="sk-line skel w60"></div><div class="sk-line skel"></div><div class="sk-line skel w40"></div><div class="sk-line skel w80"></div><div class="sk-line skel"></div></div>',stats:'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">'+'<div class="sk-line skel" style="height:80px;margin:0"></div>'.repeat(4)+'</div><div style="height:16px"></div><div class="sk-card skel" style="height:220px"></div>',map:'<div class="sk-map skel"></div><div class="sk-card skel" style="height:70px"></div><div class="sk-card skel" style="height:70px;margin-bottom:0"></div>'};return T[tpl]||T.cards;}
function showSkeleton(el,tpl,ms){el.innerHTML=skeleton(tpl);return new Promise(r=>setTimeout(()=>{r();},ms==null?550:ms));}
function emptyState(){return '<div class="empty"><svg viewBox="0 0 200 140" fill="none"><rect x="55" y="28" width="90" height="66" rx="8" stroke="#94A3B8" stroke-width="3"/><path d="M75 48h50M75 62h34M75 76h42" stroke="#CBD5E1" stroke-width="4" stroke-linecap="round"/><circle cx="146" cy="96" r="22" fill="#E0F2FE"/><path d="m137 96 7 7 12-13" stroke="#006EAF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="52" cy="38" r="5" fill="#FEF3C7"/><circle cx="160" cy="30" r="4" fill="#DCFCE7"/></svg><h4 data-i18n="empty.title">'+I18N.t('empty.title')+'</h4><p>'+I18N.t('empty.msg')+'</p><p style="margin-top:3px;font-weight:600;color:#334155">এখানে এখনও কিছু নেই। পরে আবার দেখুন।</p></div>';}
let leafletMaps=[];
function makeMap(el,cfg){
 cfg=cfg||{};
 if(!window.L){el.innerHTML='<div class="map-fallback">'+icon('pin','',36)+'<b>Map needs internet</b><span>ম্যাপ দেখতে ইন্টারনেট প্রয়োজন</span></div>';return null;}
 const m=L.map(el,{zoomControl:!cfg.noZoom,attributionControl:true}).setView(cfg.center||[22.8103,89.5626],cfg.zoom||13);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(m);
 setTimeout(()=>m.invalidateSize(),150);
 leafletMaps.push(m);return m;
}
window.UI={icon,catIcon,badge,statusKey,statusLabel,prio,prioClass,slaInfo,timeAgo,esc,toast,openModal,skeleton,emptyState,makeMap,get maps(){return leafletMaps;}};
})();
