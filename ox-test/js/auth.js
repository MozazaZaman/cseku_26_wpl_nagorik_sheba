(function(){
const {t}=I18N;
const $=s=>document.querySelector(s);
const params=new URLSearchParams(location.search||'');
function showTab(which){
 const login=which!=='signup';
 $('#tabLogin').classList.toggle('on',login);
 $('#tabSignup').classList.toggle('on',!login);
 $('#fLogin').classList.toggle('on',login);
 $('#fSignup').classList.toggle('on',!login);
}
$('#tabLogin').addEventListener('click',()=>showTab('login'));
$('#tabSignup').addEventListener('click',()=>showTab('signup'));
showTab(params.get('tab'));

const sel=$('#suArea');
sel.innerHTML=DB.AREAS.map(a=>'<option value="'+UI.esc(a.name_en)+'">'+UI.esc(I18N.lang==='bn'?a.name_bn:a.name_en)+'</option>').join('');
document.addEventListener('langchange',()=>{
 const v=sel.value;
 sel.innerHTML=DB.AREAS.map(a=>'<option value="'+UI.esc(a.name_en)+'">'+UI.esc(I18N.lang==='bn'?a.name_bn:a.name_en)+'</option>').join('');
 sel.value=v;
});

document.querySelectorAll('[data-plang]').forEach(b=>b.addEventListener('click',()=>I18N.setLang(b.dataset.plang)));

function fail(id,msg){const e=$(id);if(!e)return;e.textContent=msg;e.classList.add('show');}
function clear(id){$(id).classList.remove('show');}
function isStaffPass(v){return /^staff/i.test((v||'').trim());}
function fillLgiSels(){
 ['#liLgi','#suLgi'].forEach(s=>{const el=$(s);if(!el)return;
  el.innerHTML=DB.LGIS.map(l=>'<option value="'+l.id+'">'+UI.esc(I18N.lang==='bn'?l.name_bn:l.name_en)+'</option>').join('');});
}
fillLgiSels();
document.addEventListener('langchange',fillLgiSels);
function staffToggle(passSel,boxSel){
 const el=$(passSel);if(!el)return;
 el.addEventListener('input',()=>{
  const st=isStaffPass(el.value);
  const box=$(boxSel);if(box)box.classList.toggle('hidden',!st);
 });
}
staffToggle('#liPass','#liStaffBox');
staffToggle('#suPass','#suStaffBox');
function loginStaff(phone,lgiId){
 const name=(localStorage.getItem('ns_profile_name')||'').trim()||'Karim Sheikh';
 sessionStorage.setItem('ns_staff_user',JSON.stringify({name:name,phone:phone||'01722222222',lgiId:lgiId||'phultala'}));
 location.href='staff.html';
}
function login(id,phone){
 const name=(localStorage.getItem('ns_profile_name')||'').trim();
 const finalName=name||'Gias Uddin';
 sessionStorage.setItem('ns_portal_user',JSON.stringify({name:finalName,phone:phone||id,area:localStorage.getItem('ns_profile_area')||'Sonadanga'}));
 sessionStorage.setItem('ns_user',phone||'+8801712345678');
 location.href='portal.html';
}
['#liUser','#liPass'].forEach(s=>$(s).addEventListener('input',()=>clear('#e-liUser')));
$('#fLogin').addEventListener('submit',e=>{
 e.preventDefault();
 const id=$('#liUser').value.trim(),pass=$('#liPass').value;
 const digits=id.replace(/\D/g,'');
 const idOk=/^01[3-9]\d{8}$/.test(digits)||/^(8801[3-9]\d{8})$/.test(digits)||id.length>=4;
 if(!id){fail('#e-liUser',t('err.phoneReq'));return;}
 if(!idOk){fail('#e-liUser',t('err.phoneBad'));return;}
 if(pass.length<4){fail('#e-liPass',t('auth.err.pass'));return;}
 let phone=null;
 const digits2=digits.replace(/^0/,'');
 if(/^\d+$/.test(digits)&&digits.length>=10)phone='+880'+digits2.replace(/^880/,'');
 if(isStaffPass(pass)){loginStaff(phone,$('#liLgi')?$('#liLgi').value:'phultala');return;}
 login(id,phone);
});
const ERR_MAP={'#suName':'#e-suName','#suPhone':'#e-suPhone','#suPass':'#e-suPass','#suPass2':'#e-suPass2'};
Object.keys(ERR_MAP).forEach(s=>$(s).addEventListener('input',()=>clear(ERR_MAP[s])));
$('#fSignup').addEventListener('submit',e=>{
 e.preventDefault();
 ['#e-suName','#e-suPhone','#e-suPass','#e-suPass2'].forEach(clear);
 const name=$('#suName').value.trim(),phone=$('#suPhone').value.replace(/\D/g,''),p1=$('#suPass').value,p2=$('#suPass2').value;
 let ok=true;
 if(name.length<3){fail('#e-suName',t('auth.err.name'));ok=false;}
 if(!/^01[3-9]\d{8}$/.test(phone)){fail('#e-suPhone',t('err.phoneBad'));ok=false;}
 if(p1.length<4){fail('#e-suPass',t('auth.err.pass'));ok=false;}
 if(p1!==p2){fail('#e-suPass2',t('auth.err.match'));ok=false;}
 if(!ok)return;
 localStorage.setItem('ns_profile_name',name);
 localStorage.setItem('ns_profile_area',sel.value);
 if(isStaffPass(p1)){loginStaff('+880'+phone.replace(/^0/,''),$('#suLgi')?$('#suLgi').value:'phultala');return;}
 sessionStorage.setItem('ns_portal_user',JSON.stringify({name:name,phone:'+880'+phone.replace(/^0/,''),area:sel.value}));
 sessionStorage.setItem('ns_user','+880'+phone.replace(/^0/,''));
 UI.toast('✓ '+name);
 setTimeout(()=>{location.href='portal.html';},450);
});
})();
