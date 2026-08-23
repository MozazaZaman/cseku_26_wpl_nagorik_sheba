const CACHE='nagorik-sheba-v3';
const CORE=['./','./index.html','./service.html','./choose.html','./auth.html','./portal.html','./new-complaint.html','./vote.html','./staff.html','./citizen.html','./dashboard.html','./css/base.css','./css/citizen.css','./css/dashboard.css','./css/public.css','./css/portal.css','./js/i18n.js','./js/data.js','./js/ui.js','./js/public.js','./js/auth.js','./js/portal.js','./js/newcomplaint.js','./js/vote.js','./js/staffdash.js','./js/citizen.js','./js/dashboard.js','./assets/icon.svg'];
self.addEventListener('install',e=>{
 e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
 e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const url=new URL(e.request.url);
 if(url.origin!==location.origin)return;
 e.respondWith(
  caches.match(e.request).then(hit=>hit||fetch(e.request).then(res=>{
   const copy=res.clone();
   caches.open(CACHE).then(c=>c.put(e.request,copy));
   return res;
  }).catch(()=>caches.match('./citizen.html')))
 );
});
