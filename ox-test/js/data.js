(function(){
const NOW=Date.now(),H=3600e3,D=24*H;
const LGIS=[
 {id:'kcc',name:'Khulna City Corporation',name_bn:'খুলনা সিটি কর্পোরেশন',type:'city',phone:'041-2830001',sla:{road:72,water:48,electricity:24,gas:24,sanitation:36,streetlight:48,other:72}},
 {id:'phultala',name:'Phultala Pourashava',name_bn:'ফলতা পৌরসভা',type:'poura',phone:'041-761234',sla:{road:96,water:72,electricity:36,gas:36,sanitation:48,streetlight:72,other:96}},
 {id:'batiaghata',name:'Batiaghata Upazila Parishad',name_bn:'বটিয়াঘাটা উপজেলা পরিষদ',type:'union',phone:'041-761888',sla:{road:120,water:96,electricity:48,gas:48,sanitation:72,streetlight:96,other:120}}
];
const CATS={
 road:{icon:'road',color:'#7C3AED',sla:72},
 water:{icon:'water',color:'#0284C7',sla:48},
 electricity:{icon:'bolt',color:'#D97706',sla:24},
 gas:{icon:'gas',color:'#DC2626',sla:24},
 sanitation:{icon:'trash',color:'#059669',sla:36},
 streetlight:{icon:'flash',color:'#B45309',sla:48},
 other:{icon:'doc',color:'#64748B',sla:72}
};
const FAC_TYPES={
 toilet:{icon:'toilet',color:'#0D9488',emoji:'🚻'},
 fire:{icon:'fire',color:'#DC2626',emoji:'🚒',hotline:'199'},
 police:{icon:'shield',color:'#1E3A8A',emoji:'👮',hotline:'999'},
 wasa:{icon:'drop',color:'#2563EB',emoji:'💧'},
 lged:{icon:'build',color:'#7C3AED',emoji:'🏗️'},
 desa:{icon:'bolt',color:'#D97706',emoji:'💡'},
 titas:{icon:'gas',color:'#B91C1C',emoji:'⛽'}
};
const AREAS=[
 {name_en:'Sonadanga',name_bn:'সোনাডাঙ্গা',lat:22.8070,lng:89.5540},
 {name_en:'Khalishpur',name_bn:'খালিশপুর',lat:22.8350,lng:89.5530},
 {name_en:'Kotwali',name_bn:'কোতোয়ালি',lat:22.8120,lng:89.5650},
 {name_en:'Daulatpur',name_bn:'দৌলতপুর',lat:22.8450,lng:89.5420},
 {name_en:'Khan Jahan Ali',name_bn:'খান জাহান আলি',lat:22.7920,lng:89.5490},
 {name_en:'Rupsa',name_bn:'রূপসা',lat:22.8230,lng:89.5290},
 {name_en:'Shibbari',name_bn:'শিববাড়ি',lat:22.8156,lng:89.5606},
 {name_en:'KDA Avenue',name_bn:'কেডিএ এভিনিউ',lat:22.8103,lng:89.5626},
 {name_en:'Royal Market',name_bn:'রয়েল মার্কেট',lat:22.8129,lng:89.5618},
 {name_en:'Hadis Park',name_bn:'হাদিস পার্ক',lat:22.8110,lng:89.5640},
 {name_en:'Rayermohal',name_bn:'রায়েরমহল',lat:22.8260,lng:89.5730},
 {name_en:'Banorgati',name_bn:'বানরগতি',lat:22.7990,lng:89.5740},
 {name_en:'Gilatola',name_bn:'গিলাতলা',lat:22.7890,lng:89.5570},
 {name_en:'Tutpara',name_bn:'টুটপাড়া',lat:22.7940,lng:89.5690},
 {name_en:'Nirala',name_bn:'নিরালা',lat:22.8020,lng:89.5730},
 {name_en:'Taltola',name_bn:'টালতলা',lat:22.8180,lng:89.5750},
 {name_en:'Boyra',name_bn:'বয়রা',lat:22.7930,lng:89.5400},
 {name_en:'Basupara',name_bn:'বাসুপাড়া',lat:22.8060,lng:89.5900},
 {name_en:'Shiromoni',name_bn:'শিরোমনি',lat:22.8560,lng:89.5330},
 {name_en:'Goborchaka',name_bn:'গোবরচাকা',lat:22.7860,lng:89.5810}
];
function c(o){o.votes=o.votes||0;o.createdAt=NOW-o.ageH*H;return o;}
let complaints=[
 c({id:'KCC-1042',cat:'road',title_en:'Deep pothole on Shibbari Mor',title_bn:'শিববাড়ি মোড়ে গভীর খাদ',addr_en:'Shibbari Mor, Kotwali',addr_bn:'শিববাড়ি মোড়, কোতোয়ালি',area:'Kotwali',lat:22.8156,lng:89.5606,status:'in_progress',priority:78,votes:34,ageH:52,slaH:72,lgi:LGIS[0].name,lgiType:'city',assignee:'s2',
   ai:{photoConf:.96,classConf:.92,priority:78,dupOf:null},reporter:'+8801712345678',mine:true,
   trail:[{by:'ai',agent:'Photo Verifier',en:'Photo verified authentic — 96% real-photo confidence.',bn:'ছবি যাচাইকৃত — ৯৬% আসল।',h:-51},{by:'ai',agent:'Text Classifier',en:'Classified as ROAD (92% confidence).',bn:'রাস্তা (৯২%) হিসেবে শনাক্ত।',h:-50.5},{by:'ai',agent:'GPS Dedup Agent',en:'No duplicate found within 300 m radius.',bn:'৩০০ মিটারের মধ্যে ডুপ্লিকেট নেই।',h:-50.4},{by:'ai',agent:'Priority Ranker',en:'Priority score set to 78 (severity + votes).',bn:'অগ্রাধিকার স্কোর ৭৮।',h:-50.3},{by:'ai',agent:'LGI Router',en:'Routed to Khulna City Corporation (Ward 21).',bn:'খুলনা সিটি কর্পোরেশনে পাঠানো হয়েছে।',h:-50},{by:'staff',staff:'Kamrul Hasan',en:'Assigned to field team A for repair.',bn:'ফিল্ড টিম এ-কে দায়িত্ব দেওয়া হয়েছে।',h:-40}]}),
 c({id:'KCC-1039',cat:'water',title_en:'Water pipeline burst near Sonadanga',title_bn:'সোনাডাঙ্গায় পানির পাইপলাইন ফেটেছে',addr_en:'Sonadanga Circle',addr_bn:'সোনাডাঙ্গা চত্বর',area:'Sonadanga',lat:22.8070,lng:89.5540,status:'open',priority:64,votes:21,ageH:20,slaH:48,lgi:LGIS[0].name,lgiType:'city',assignee:null,
   ai:{photoConf:.91,classConf:.88,priority:64,dupOf:null},reporter:'+8801811122233',mine:false,
   trail:[{by:'ai',agent:'Photo Verifier',en:'Photo verified authentic — 91%.',bn:'ছবি যাচাইকৃত — ৯১%.',h:-19},{by:'ai',agent:'Text Classifier',en:'Classified as WATER (88%).',bn:'পানি (৮৮%) হিসেবে শনাক্ত।',h:-18.6},{by:'ai',agent:'GPS Dedup Agent',en:'No duplicate within 300 m.',bn:'৩০০ মিটারে ডুপ্লিকেট নেই।',h:-18.5},{by:'ai',agent:'Priority Ranker',en:'Priority score set to 64.',bn:'অগ্রাধিকার স্কোর ৬৪।',h:-18.4},{by:'ai',agent:'LGI Router',en:'Routed to KWASA via Khulna City Corporation.',bn:'কে-ওয়াসায় পাঠানো হয়েছে।',h:-18}]}),
 c({id:'KCC-1051',cat:'electricity',title_en:'Fallen electric pole in Khalishpur',title_bn:'খালিশপুরে বিদ্যুতের খুঁটি ভেঙে তার ঝুলছে',addr_en:'Majid Sarani, Khalishpur',addr_bn:'মজিদ সরণি, খালিশপুর',area:'Khalishpur',lat:22.8350,lng:89.5525,status:'open',priority:88,votes:47,ageH:8,slaH:24,lgi:LGIS[0].name,lgiType:'city',assignee:'s1',
   ai:{photoConf:.94,classConf:.95,priority:88,dupOf:null},reporter:'+8801933445566',mine:false,
   trail:[{by:'ai',agent:'Photo Verifier',en:'Photo verified authentic — 94%.',bn:'ছবি যাচাইকৃত — ৯৪%.',h:-7.6},{by:'ai',agent:'Text Classifier',en:'Classified as ELECTRICITY (95%).',bn:'বিদ্যুৎ (৯৫%) হিসেবে শনাক্ত।',h:-7.5},{by:'ai',agent:'Priority Ranker',en:'Priority score set to 88 — public safety risk.',bn:'স্কোর ৮৮ — নিরাপত্তা ঝুঁকি।',h:-7.3},{by:'ai',agent:'LGI Router',en:'Routed to WZPDCL Khulna zone office.',bn:'ডব্লিউজেডপিডিসিএল খুলনা জোনে পাঠানো।',h:-7},{by:'staff',staff:'Rahim Uddin',en:'High priority — dispatched emergency crew.',bn:'জরুরি ক্রু পাঠানো হয়েছে।',h:-5}]}),
 c({id:'KCC-1028',cat:'sanitation',title_en:'Garbage not collected in Rayermohal',title_bn:'রায়েরমহলে এক সপ্তাহ ধরে ময়লা সংগ্রহ হচ্ছে না',addr_en:'Rayermohal Bazar',addr_bn:'রায়েরমহল বাজার',area:'Rayermohal',lat:22.8260,lng:89.5730,status:'done',priority:42,votes:15,ageH:240,slaH:36,resolvedAtH:190,lgi:LGIS[0].name,lgiType:'city',assignee:'s3',resolution_en:'Two extra collection drives completed; container placed at corner.',resolution_bn:'দুটি অতিরিক্ত সংগ্রহ অভিযান সম্পন্ন; কোণায় কন্টেইনার স্থাপন।',
   ai:{photoConf:.89,classConf:.9,priority:42,dupOf:null},reporter:'+8801611777888',mine:true,
   trail:[{by:'ai',agent:'Text Classifier',en:'Classified as SANITATION (90%).',bn:'স্যানিটেশন (৯০%)।',h:-238},{by:'ai',agent:'LGI Router',en:'Routed to KCC conservancy dept.',bn:'সংরক্ষণ বিভাগে পাঠানো।',h:-237.5},{by:'staff',staff:'Sultana Begum',en:'Scheduled pickup with conservancy team.',bn:'সংগ্রহের সময় নির্ধারণ।',h:-230},{by:'staff',staff:'Sultana Begum',en:'Resolved — garbage cleared, new bin installed.',bn:'সমাধান — ময়লা সরানো, নতুন বিন স্থাপন।',h:-190}]}),
 c({id:'KCC-1047',cat:'gas',title_en:'Gas leak smell near Rupsha',title_bn:'রূপসায় গ্যাস লিকের গন্ধ',addr_en:'Rupsha Strand Road',addr_bn:'রূপসা স্ট্র্যান্ড রোড',area:'Rupsa',lat:22.8230,lng:89.5295,status:'open',priority:92,votes:58,ageH:5,slaH:24,lgi:LGIS[0].name,lgiType:'city',assignee:'s2',
   ai:{photoConf:.93,classConf:.97,priority:92,dupOf:null},reporter:'+8801555667788',mine:false,
   trail:[{by:'ai',agent:'Photo Verifier',en:'Photo verified authentic — 93%.',bn:'ছবি যাচাইকৃত — ৯৩%.',h:-4.7},{by:'ai',agent:'Text Classifier',en:'Classified as GAS (97%) — keyword “leak/smell”.',bn:'গ্যাস (৯৭%) — “লিক/গন্ধ” শব্দ।',h:-4.6},{by:'ai',agent:'Priority Ranker',en:'Emergency priority 92 — flammable hazard.',bn:'জরুরি অগ্রাধিকার ৯২।',h:-4.5},{by:'ai',agent:'LGI Router',en:'Routed to Sundarban Gas control room.',bn:'সুন্দরবন গ্যাস কন্ট্রোল রুমে পাঠানো।',h:-4.3}]}),
 c({id:'KCC-1019',cat:'road',title_en:'Broken footpath tiles near Hadis Park',title_bn:'হাদিস পার্কের পাশে ফুটপাতের টাইলস ভাঙা',addr_en:'Hadis Park, Kotwali',addr_bn:'হাদিস পার্ক, কোতোয়ালি',area:'Kotwali',lat:22.8115,lng:89.5645,status:'merged',priority:30,votes:12,ageH:96,slaH:72,lgi:LGIS[0].name,lgiType:'city',dupInto:'KCC-1044',
   ai:{photoConf:.87,classConf:.85,priority:30,dupOf:'KCC-1044'},reporter:'+8801711223344',mine:false,
   trail:[{by:'ai',agent:'GPS Dedup Agent',en:'Duplicate detected 120 m from KCC-1044 — merged, votes combined.',bn:'KCC-1044 থেকে ১২০ মিটার দূরে ডুপ্লিকেট — একত্রিত।',h:-95}]}),
 c({id:'KCC-1044',cat:'road',title_en:'Collapsed footpath blocking walkway',title_bn:'ফুটপাত ভেঙে চলাচল বন্ধ',addr_en:'Hadis Park, Kotwali',addr_bn:'হাদিস পার্ক, কোতোয়ালি',area:'Kotwali',lat:22.8110,lng:89.5650,status:'in_progress',priority:55,votes:29,ageH:100,slaH:72,lgi:LGIS[0].name,lgiType:'city',assignee:'s1',
   ai:{photoConf:.9,classConf:.86,priority:55,dupOf:null},reporter:'+8801888990011',mine:false,
   trail:[{by:'ai',agent:'LGI Router',en:'Routed to Khulna City Corporation (Ward 19).',bn:'খুলনা সিটি কর্পোরেশনে পাঠানো।',h:-99},{by:'ai',agent:'GPS Dedup Agent',en:'Merged complaint KCC-1019 (+12 votes).',bn:'KCC-1019 একত্রিত (+১২ ভোট)।',h:-95},{by:'staff',staff:'Rahim Uddin',en:'Contractor notified for footpath rebuild.',bn:'ঠিকাদারকে জানানো হয়েছে।',h:-60}]}),
 c({id:'KCC-0999',cat:'water',title_en:'Water supply outage whole lane',title_bn:'পুরো লেনে পানি সরবরাহ বন্ধ',addr_en:'Tutpara, Khan Jahan Ali',addr_bn:'টুটপাড়া, খান জাহান আলি',area:'Tutpara',lat:22.7940,lng:89.5690,status:'rejected',priority:10,votes:3,ageH:150,slaH:48,lgi:LGIS[0].name,lgiType:'city',
   ai:{photoConf:.31,classConf:.44,priority:10,dupOf:null,rejected:true},reporter:'+8801700112233',mine:false,
   trail:[{by:'ai',agent:'Photo Verifier',en:'REJECTED — photo appears fake/unrelated (31% authenticity).',bn:'বাতিল — ছবি নকল/অসম্পর্কিত (৩১%)।',h:-149}]}),
 c({id:'KCC-1055',cat:'sanitation',title_en:'Overflowing public dustbin',title_bn:'পাবলিক ডাস্টবিন উপচে পড়ছে',addr_en:'Daulatpur Bazar',addr_bn:'দৌলতপুর বাজার',area:'Daulatpur',lat:22.8450,lng:89.5420,status:'open',priority:38,votes:9,ageH:14,slaH:36,lgi:LGIS[0].name,lgiType:'city',assignee:'s3',
   ai:{photoConf:.92,classConf:.83,priority:38,dupOf:null},reporter:'+8801999334455',mine:true,
   trail:[{by:'ai',agent:'Photo Verifier',en:'Photo verified authentic — 92%.',bn:'ছবি যাচাইকৃত — ৯২%.',h:-13.6},{by:'ai',agent:'Text Classifier',en:'Classified as SANITATION (83%).',bn:'স্যানিটেশন (৮৩%)।',h:-13.5},{by:'ai',agent:'LGI Router',en:'Routed to KCC conservancy.',bn:'সংরক্ষণ বিভাগে পাঠানো।',h:-13}]}),
 c({id:'KCC-0031',cat:'electricity',title_en:'Street lights off for 2 weeks',title_bn:'২ সপ্তাহ ধরে স্ট্রিট লাইট বন্ধ',addr_en:'Batiaghata Bazar',addr_bn:'বটিয়াঘাটা বাজার',area:'Batiaghata',lat:22.6850,lng:89.5150,status:'open',priority:46,votes:11,ageH:70,slaH:48,lgi:'Batiaghata Upazila Parishad',lgiType:'union',assignee:'s4',
   ai:{photoConf:.84,classConf:.81,priority:46,dupOf:null},reporter:'+8801733445599',mine:false,
   trail:[{by:'ai',agent:'LGI Router',en:'Outside city boundary — routed to Union Parishad (LGED).',bn:'শহরের বাইরে — ইউনিয়ন পরিষদে পাঠানো।',h:-69}]}),
 c({id:'KCC-1007',cat:'water',title_en:'Sewer line overflowing into lane',title_bn:'ড্রেনের পানি লেনে উপচে পড়ছে',addr_en:'Gilatola, Khan Jahan Ali',addr_bn:'গিলাতলা, খান জাহান আলি',area:'Gilatola',lat:22.7890,lng:89.5570,status:'done',priority:60,votes:25,ageH:400,slaH:48,resolvedAtH:330,lgi:LGIS[0].name,lgiType:'city',assignee:'s2',resolution_en:'Drain unclogged and disinfected by KWASA crew.',resolution_bn:'ড্রেন পরিষ্কার ও জীবাণুমুক্ত করা হয়েছে।',
   ai:{photoConf:.88,classConf:.87,priority:60,dupOf:null},reporter:'+8801644556677',mine:true,
   trail:[{by:'ai',agent:'LGI Router',en:'Routed to KCC / KWASA.',bn:'কে-ওয়াসায় পাঠানো।',h:-398},{by:'staff',staff:'Kamrul Hasan',en:'KWASA crew completed cleaning.',bn:'কে-ওয়াসা ক্রু পরিষ্কার শেষ করেছে।',h:-330}]})
,
 c({id:'BATI-3001',cat:'sanitation',title_en:'Dustbin overflow at Batiaghata bazar',title_bn:'বটিয়াঘাটা বাজারে ডাস্টবিন উপচে পড়ছে',addr_en:'Batiaghata Bazar',addr_bn:'বটিয়াঘাটা বাজার',area:'Batiaghata',lat:22.6855,lng:89.5160,status:'open',priority:30,votes:5,ageH:90,slaH:72,lgi:LGIS[2].name,lgiType:'union',assignee:'s4',
   ai:{photoConf:.86,classConf:.8,priority:30,dupOf:null},reporter:'+8801744556677',mine:false,
   trail:[{by:'ai',agent:'LGI Router',en:'Routed to Batiaghata Upazila Parishad.',bn:'বটিয়াঘাটা উপজেলা পরিষদে পাঠানো।',h:-89},{by:'staff',staff:'Jahangir Alam',en:'Conservancy van scheduled.',bn:'সংগ্রহ ভ্যানের সময় নির্ধারিত।',h:-70}]}),
 c({id:'POUR-2001',cat:'road',title_en:'Broken culvert at Phultala bazar',title_bn:'ফলতা বাজারে ভাঙা কালভার্ট',addr_en:'Phultala Bazar Main Road',addr_bn:'ফলতা বাজার প্রধান সড়ক',area:'Phultala',lat:22.8600,lng:89.5050,status:'open',priority:52,votes:8,ageH:30,slaH:96,lgi:LGIS[1].name,lgiType:'poura',assignee:null,
   ai:{photoConf:.9,classConf:.87,priority:52,dupOf:null},reporter:'+8801755667788',mine:false,
   trail:[{by:'ai',agent:'Photo Verifier',en:'Photo verified authentic — 90%.',bn:'ছবি যাচাইকৃত — ৯০%.',h:-29},{by:'ai',agent:'Text Classifier',en:'Classified as ROAD (87%).',bn:'রাস্তা (৮৭%)।',h:-28.7},{by:'ai',agent:'LGI Router',en:'Routed to Phultala Pourashava.',bn:'ফলতা পৌরসভায় পাঠানো হয়েছে।',h:-28.3}]}),
 c({id:'POUR-2002',cat:'water',title_en:'No water supply at Phultala new market',title_bn:'ফলতা নিউ মার্কেটে পানি সরবরাহ নেই',addr_en:'Phultala New Market',addr_bn:'ফলতা নিউ মার্কেট',area:'Phultala',lat:22.8610,lng:89.5070,status:'in_progress',priority:44,votes:12,ageH:60,slaH:72,lgi:LGIS[1].name,lgiType:'poura',assignee:'s5',
   ai:{photoConf:.88,classConf:.84,priority:44,dupOf:null},reporter:'+8801766778899',mine:false,
   trail:[{by:'ai',agent:'LGI Router',en:'Routed to Phultala Pourashava water dept.',bn:'ফলতা পৌরসভা পানি বিভাগে পাঠানো।',h:-59},{by:'staff',staff:'Karim Sheikh',en:'Pump repair started.',bn:'পাম্প মেরামত শুরু হয়েছে।',h:-40}]})];
let staff=[
 {id:'s1',name:'Rahim Uddin',role:'supervisor',capacity:8,lgiId:'kcc'},
 {id:'s2',name:'Kamrul Hasan',role:'staff',capacity:8,lgiId:'kcc'},
 {id:'s3',name:'Sultana Begum',role:'staff',capacity:6,lgiId:'kcc'},
 {id:'s4',name:'Jahangir Alam',role:'staff',capacity:5,lgiId:'batiaghata'},
 {id:'s5',name:'Karim Sheikh',role:'staff',capacity:6,lgiId:'phultala',phone:'01722222222'}
];
let facilities=[
 {id:1,type:'toilet',name_en:'Khulna Public Toilet — Shibbari',name_bn:'পাবলিক টয়লেট — শিববাড়ি',addr_en:'Shibbari Mor, Kotwali',addr_bn:'শিববাড়ি মোড়, কোতোয়ালি',phone:'01711-100101',lat:22.8156,lng:89.5606,active:true},
 {id:2,type:'toilet',name_en:'Public Toilet — Hadis Park',name_bn:'পাবলিক টয়লেট — হাদিস পার্ক',addr_en:'Hadis Park, Kotwali',addr_bn:'হাদিস পার্ক, কোতোয়ালি',phone:'01711-100102',lat:22.8110,lng:89.5640,active:true},
 {id:3,type:'toilet',name_en:'Public Toilet — Sonadanga Terminal',name_bn:'পাবলিক টয়লেট — সোনাডাঙ্গা টার্মিনাল',addr_en:'Sonadanga Bus Terminal',addr_bn:'সোনাডাঙ্গা বাস টার্মিনাল',phone:'01711-100103',lat:22.8070,lng:89.5540,active:true},
 {id:4,type:'toilet',name_en:'Public Toilet — Royal Market',name_bn:'পাবলিক টয়লেট — রয়েল মার্কেট',addr_en:'Royal Market, Kotwali',addr_bn:'রয়েল মার্কেট, কোতোয়ালি',phone:'01711-100104',lat:22.8129,lng:89.5618,active:true},
 {id:5,type:'toilet',name_en:'Public Toilet — Rayermohal Bazar',name_bn:'পাবলিক টয়লেট — রায়েরমহল বাজার',addr_en:'Rayermohal, Kotwali',addr_bn:'রায়েরমহল, কোতোয়ালি',lat:22.8260,lng:89.5730,active:true},
 {id:6,type:'toilet',name_en:'Public Toilet — Banorgati Ghat',name_bn:'পাবলিক টয়লেট — বানরগতি ঘাট',addr_en:'Banorgati Launch Ghat',addr_bn:'বানরগতি লঞ্চ ঘাট',lat:22.7990,lng:89.5740,active:false},
 {id:7,type:'fire',name_en:'Khulna Fire Service Station',name_bn:'খুলনা ফায়ার সার্ভিস স্টেশন',addr_en:'Khan Jahan Ali Road, KDA Avenue',addr_bn:'খান জাহান আলি রোড, কেডিএ এভিনিউ',phone:'041-760147',lat:22.8109,lng:89.5630,active:true},
 {id:8,type:'fire',name_en:'Sonadanga Fire Station',name_bn:'সোনাডাঙ্গা ফায়ার স্টেশন',addr_en:'Sonadanga Bazar Road',addr_bn:'সোনাডাঙ্গা বাজার রোড',phone:'041-760248',lat:22.8055,lng:89.5525,active:true},
 {id:9,type:'fire',name_en:'Khalishpur Fire Station',name_bn:'খালিশপুর ফায়ার স্টেশন',addr_en:'Khalishpur Municipal Market',addr_bn:'খালিশপুর পৌর মার্কেট',phone:'041-760349',lat:22.8350,lng:89.5520,active:true},
 {id:10,type:'fire',name_en:'Daulatpur Fire Station',name_bn:'দৌলতপুর ফায়ার স্টেশন',addr_en:'Daulatpur Bazar',addr_bn:'দৌলতপুর বাজার',phone:'041-760450',lat:22.8440,lng:89.5430,active:true},
 {id:11,type:'police',name_en:'Kotwali Police Station',name_bn:'কোতোয়ালি থানা',addr_en:'Upashahar, Jashore Road',addr_bn:'উপশহর, যশোর রোড',phone:'999',lat:22.8120,lng:89.5650,active:true},
 {id:12,type:'police',name_en:'Sonadanga Police Station',name_bn:'সোনাডাঙ্গা থানা',addr_en:'Sonadanga Circle',addr_bn:'সোনাডাঙ্গা চত্বর',phone:'999',lat:22.8075,lng:89.5530,active:true},
 {id:13,type:'police',name_en:'Khalishpur Police Station',name_bn:'খালিশপুর থানা',addr_en:'Majid Sarani, Khalishpur',addr_bn:'মজিদ সরণি, খালিশপুর',phone:'999',lat:22.8355,lng:89.5515,active:true},
 {id:14,type:'police',name_en:'Khan Jahan Ali Police Station',name_bn:'খান জাহান আলি থানা',addr_en:'Rupsha Strand Road',addr_bn:'রূপসা স্ট্র্যান্ড রোড',phone:'999',lat:22.7920,lng:89.5490,active:true},
 {id:15,type:'police',name_en:'Daulatpur Police Station',name_bn:'দৌলতপুর থানা',addr_en:'Naldanga, Daulatpur',addr_bn:'নলডাঙ্গা, দৌলতপুর',phone:'999',lat:22.8455,lng:89.5415,active:true},
 {id:16,type:'wasa',name_en:'Khulna WASA Head Office',name_bn:'খুলনা ওয়াসা সদর দপ্তর',addr_en:'Majid Sarani, Sonadanga',addr_bn:'মজিদ সরণি, সোনাডাঙ্গা',phone:'041-2830235',lat:22.8090,lng:89.5570,active:true},
 {id:17,type:'wasa',name_en:'KWASA Zone Office — Khalishpur',name_bn:'কে-ওয়াসা জোন অফিস — খালিশপুর',addr_en:'Khalishpur, Khulna',addr_bn:'খালিশপুর, খুলনা',phone:'041-2830236',lat:22.8345,lng:89.5545,active:true},
 {id:18,type:'lged',name_en:'LGED Khulna Regional Office',name_bn:'এলজিইডি খুলনা আঞ্চলিক অফিস',addr_en:'Upashahar, Khalishpur',addr_bn:'উপশহর, খালিশপুর',phone:'041-761234',lat:22.8180,lng:89.5690,active:true},
 {id:19,type:'desa',name_en:'WZPDCL (DESA) Khulna Office',name_bn:'ডব্লিউজেডপিডিসিএল (ডেসা) খুলনা অফিস',addr_en:'Ginnatola, Khan Jahan Ali Road',addr_bn:'গিন্নাতলা, খান জাহান আলি রোড',phone:'16699',lat:22.7960,lng:89.5520,active:true},
 {id:20,type:'titas',name_en:'Sundarban Gas (Titas) Office',name_bn:'সুন্দরবন গ্যাস (টিটাস) অফিস',addr_en:'Rupsha Strand Road, Khulna',addr_bn:'রূপসা স্ট্র্যান্ড রোড, খুলনা',phone:'09612-345678',lat:22.8210,lng:89.5310,active:true}
];
let notifications=[
 {id:1,ch:'app',cid:'KCC-1055',en:'Your complaint "Overflowing public dustbin" was received and is being AI-verified.',bn:'আপনার অভিযোগ "পাবলিক ডাস্টবিন উপচে পড়ছে" এআই যাচাইয়ে আছে।',h:13,read:false},
 {id:2,ch:'sms',cid:'KCC-1042',en:'KCC-1042 moved to In Progress. Field team assigned.',bn:'KCC-1042 এখন চলমান। ফিল্ড টিম নিয়োগ হয়েছে।',h:40,read:false},
 {id:3,ch:'sms',cid:'KCC-1042',en:'AI verified your photo (96%). Routed to Khulna City Corporation.',bn:'ছবি যাচাই হয়েছে (৯৬%)। খুলনা সিটি কর্পোরেশনে পাঠানো হয়েছে।',h:50,read:true},
 {id:4,ch:'app',cid:'KCC-1007',en:'Great news! "Sewer line overflowing" has been resolved.',bn:'সুখবর! "ড্রেন উপচে পড়া" সমাধান হয়েছে।',h:330,read:true},
 {id:5,ch:'app',cid:null,en:'Welcome to Nagorik Sheba! Verify your NID to unlock full features.',bn:'নাগরিক সেবায় স্বাগতম! সব সুবিধা পেতে NID যাচাই করুন।',h:400,read:true}
];
const HOTSPOTS=[
 {area_en:'Sonadanga',area_bn:'সোনাডাঙ্গা',n:3,lat:22.8070,lng:89.5540,w:.9},
 {area_en:'Kotwali',area_bn:'কোতোয়ালি',n:3,lat:22.8120,lng:89.5650,w:.85},
 {area_en:'Khalishpur',area_bn:'খালিশপুর',n:2,lat:22.8350,lng:89.5530,w:.7},
 {area_en:'Khan Jahan Ali',area_bn:'খান জাহান আলি',n:2,lat:22.7920,lng:89.5490,w:.5},
 {area_en:'Daulatpur',area_bn:'দৌলতপুর',n:1,lat:22.8450,lng:89.5420,w:.45}
];
const WEEKLY=[{w:'W1',done:2,sub:6},{w:'W2',done:3,sub:7},{w:'W3',done:4,sub:8},{w:'W4',done:3,sub:9},{w:'W5',done:5,sub:10},{w:'W6',done:6,sub:11},{w:'W7',done:5,sub:9},{w:'W8',done:7,sub:11}];
const AVG_HRS={road:96,water:80,electricity:30,gas:26,sanitation:60};
window.DB={CATS,FAC_TYPES,AREAS,LGIS,get complaints(){return complaints;},set complaints(v){complaints=v;},get facilities(){return facilities;},set facilities(v){facilities=v;},get notifications(){return notifications;},staff,HOTSPOTS,WEEKLY,AVG_HRS,NOW,
 mergeUserReports:function(){
  try{(JSON.parse(localStorage.getItem('ns_my_reports')||'[]')).forEach(c=>{if(!complaints.find(x=>x.id===c.id)){c.createdAt=NOW-(c.ageH||0.02)*H;complaints.unshift(c);}});}catch(e){}
  try{const up=JSON.parse(localStorage.getItem('ns_staff_updates')||'{}');Object.keys(up).forEach(id=>{const c=complaints.find(x=>x.id===id);if(c){Object.assign(c,up[id].fields||{});if(up[id].trail&&up[id].trail.length)(c.trail=c.trail||[]).push.apply(c.trail,up[id].trail);}});}catch(e){}
 },
 saveUserReport:function(c){
  try{
   const arr=JSON.parse(localStorage.getItem('ns_my_reports')||'[]');
   arr.unshift(c);
   try{localStorage.setItem('ns_my_reports',JSON.stringify(arr));return;}catch(e){}
   const light=arr.map(x=>x.id===c.id?Object.assign({},x,{photo:null}):x);
   try{localStorage.setItem('ns_my_reports',JSON.stringify(light));return;}catch(e){}
   const lighter=light.slice(0,6).map(x=>Object.assign({},x,{photo:null}));
   try{localStorage.setItem('ns_my_reports',JSON.stringify(lighter));return;}catch(e){}
   localStorage.setItem('ns_my_reports',JSON.stringify(lighter.map(x=>{const o=Object.assign({},x);delete o.photo;delete o.trail;return o;})));
  }catch(e){}
 },
 saveStaffUpdate:function(id,fields,trailEntry){
  try{
   const up=JSON.parse(localStorage.getItem('ns_staff_updates')||'{}');
   up[id]=up[id]||{fields:{},trail:[]};
   Object.assign(up[id].fields,fields);
   if(trailEntry)up[id].trail.push(trailEntry);
   localStorage.setItem('ns_staff_updates',JSON.stringify(up));
  }catch(e){}
 }
};
})();
