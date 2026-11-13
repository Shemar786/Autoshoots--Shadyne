(function(root){
"use strict";
const W=1120,H=630,MAG=20;
const missions=[
 {name:"Crater Breach",location:"Utopia Planitia · Cargo Outpost",difficulty:"ROOKIE",scene:"crater",objective:8,time:55,base:220,bonus:600,interval:2.1,dwell:4.1,firstFire:2.8,damage:11,speed:38,range:[137,205],rivals:[2550,2050],brief:"Push into a red-dust cargo outpost and clear eight enemy infantry. Their helmet glints just before they fire."},
 {name:"Canyon Intercept",location:"Valles Marineris · Ore Rail",difficulty:"VETERAN",scene:"canyon",objective:12,time:62,base:300,bonus:1000,interval:1.6,dwell:3.6,firstFire:2.4,damage:15,speed:54,range:[126,186],rivals:[5260,4610],brief:"Intercept troops at a rail depot beneath the canyon rim. Soldiers move faster and begin firing sooner."},
 {name:"Redline Relay",location:"Olympus Mons · Deep Relay",difficulty:"ELITE",scene:"relay",objective:16,time:72,base:400,bonus:1600,interval:1.28,dwell:3.2,firstFire:2.0,damage:18,speed:64,range:[116,176],rivals:[9460,8170],brief:"Retake the relay station through thick Martian dust. Precision and fast streaks pay the difference against elite rivals."}
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const money=n=>'$'+Math.round(n).toLocaleString('en-US');
const make=(i,random=Math.random)=>({i,m:missions[i],random,clock:0,next:0.42,serial:0,kills:0,cash:0,armor:100,ammo:MAG,reloadEnd:0,cool:0,cover:false,shots:0,hits:0,precision:0,streak:0,lastKill:-99,targets:[],effects:[],damageAt:-99,shotAt:-99,notice:'',noticeUntil:0,result:null,clean:false,evasive:0,shotX:W/2,shotY:H/2});
const tell=(s,notice,d=1.5)=>{s.notice=notice;s.noticeUntil=s.clock+d};
function ranks(s){
 const prog=s.result&&s.clean?1:clamp(Math.max(s.clock/s.m.time,s.kills/s.m.objective*.74),0,1);
 const names=['VANTA-12','COBALT-03'];
 return [{name:'GHOST-07',cash:s.cash,you:true},...s.m.rivals.map((score,i)=>({name:names[i],cash:Math.floor(score*Math.pow(prog,i===0?0.82:1.1)/10)*10,you:false}))].sort((a,b)=>b.cash-a.cash||Number(a.you)-Number(b.you));
}
function finish(s,reason){
 if(s.result)return;
 s.clean=reason==='cleared';
 if(s.clean)s.cash+=s.m.bonus;
 s.result=reason;
 s.won=s.clean&&ranks(s)[0].you;
}
function spawn(s){
 const r=s.random,m=s.m,h=m.range[0]+r()*(m.range[1]-m.range[0]), lanes=[0.21,0.39,0.59,0.77,0.50,0.28,0.71];
 const left=lanes[(s.serial*3+s.i)%lanes.length]*W;
 const dir=(s.serial%2?1:-1);
 s.targets.push({id:s.serial++,x:left+(r()-.5)*75,hp:100,w:h*.36,h,base:411+(h-115)*.78+r()*18,born:s.clock,fire:m.firstFire+r()*.42,dir,speed:(.53+r()*.53)*m.speed,dead:false,fallAt:0,hitAt:-99,hitDir:1,variant:s.serial%3});
}
function box(t,s){
 const age=s.clock-t.born;
 const recoil=Math.max(0,1-(s.clock-t.hitAt)/.27);
 const x=clamp(t.x+t.dir*t.speed*age+Math.sin(age*7)*2+t.hitDir*recoil*7,92,W-92);
 const extra=Math.max(0,age)*t.speed*.058,w=t.w+extra*.36,h=t.h+extra;
 const feet=t.base+extra*1.4+Math.abs(Math.sin(age*8+t.id))*2.6;
 const y=feet-h+Math.max(0,.22-age)*76;
 return {x:x-w/2,y,w,h,feet};
}
function tick(s,dt){
 if(s.result)return;
 s.clock+=dt;
 if(s.clock>=s.m.time){s.clock=s.m.time;finish(s,'expired');return}
 if(s.reloadEnd&&s.clock>=s.reloadEnd){s.ammo=MAG;s.reloadEnd=0;tell(s,s.cover?'IN COVER':'MAGAZINE READY',.65)}
 if(s.clock>=s.next){
   if(s.targets.filter(x=>!x.dead).length<(s.i===0?2:3))spawn(s);
   s.next+=s.m.interval;
 }
 for(const t of s.targets){
   const age=s.clock-t.born;
   if(!t.dead&&age>=t.fire&&age<s.m.dwell){
     t.fire+=1.65;
     const b=box(t,s);
     s.effects.push({kind:'enemy',at:s.clock,x:b.x+b.w*.5,y:b.y+b.h*.236});
     if(!s.cover){s.armor=clamp(s.armor-Math.round(s.m.damage*(1-s.evasive*.40)),0,100);s.damageAt=s.clock;tell(s,'TAKING FIRE · C FOR COVER',1.05)}
     if(s.armor<=0){finish(s,'down');return}
   }
 }
 s.targets=s.targets.filter(t=>t.dead?s.clock-t.fallAt<.46:s.clock-t.born<s.m.dwell);
 s.effects=s.effects.filter(f=>s.clock-f.at<.44);
}
function reload(s){
 if(s.result||s.reloadEnd||s.ammo===MAG)return false;
 s.reloadEnd=s.clock+1.42;tell(s,'RELOADING',1.44);return true;
}
function cover(s){
 if(s.result)return false;
 s.cover=!s.cover;tell(s,s.cover?'IN COVER · C TO PEEK':'BACK IN THE FIGHT',1.15);return s.cover;
}
function hitTest(t,s,x,y){
 const b=box(t,s),u=(x-b.x)/b.w,v=(y-b.y)/b.h;
 if(((u-.49)/.238)**2+((v-.083)/.086)**2<=1)return 'head';
 if(v>.14&&v<.65&&u>.11&&u<.89)return 'body';
 if(v>=.65&&v<.99&&u>.08&&u<.92&&Math.abs(u-.5)>.055)return 'leg';
 return null;
}
function fire(s,x,y){
 if(s.result||s.clock<s.cool)return 'blocked';
 if(s.cover){tell(s,'IN COVER · C TO PEEK',1.25);return 'blocked'}
 if(s.reloadEnd)return 'blocked';
 if(!s.ammo){s.cool=s.clock+.24;tell(s,'EMPTY · R TO RELOAD',1.5);return 'empty'}
 s.cool=s.clock+.118;s.shotAt=s.clock;s.shotX=x;s.shotY=y;s.ammo--;s.shots++;
 const targets=s.targets.filter(t=>!t.dead&&s.clock-t.born>=.14).sort((a,b)=>b.base-a.base);
 for(const t of targets){
   const where=hitTest(t,s,x,y);
   if(!where)continue;
   const b=box(t,s);
   t.hitAt=s.clock;t.hitDir=x>b.x+b.w*.5?-1:1;
   t.hp=Math.max(0,t.hp-({head:64,body:43,leg:34}[where]));
   s.hits++;if(where==='head')s.precision++;
   s.effects.push({kind:t.hp===0?'eliminate':where==='head'?'helmet':'hit',at:s.clock,x,y,dir:t.hitDir});
   if(t.hp>0){
     tell(s,where==='head'?'HELMET HIT':where==='leg'?'LEG HIT':'ARMOR HIT',.55);
     return 'wound';
   }
   t.dead=true;t.fallAt=s.clock;s.kills++;
   s.streak=s.clock-s.lastKill<=3.5?s.streak+1:1;
   s.lastKill=s.clock;
   const mult=(where==='head'?1.5:1)+(s.streak>=3?.25:0),pay=Math.round(s.m.base*mult);
   s.cash+=pay;
   tell(s,(where==='head'?'PRECISION ELIMINATION':'ELIMINATION')+'  +'+money(pay)+(s.streak>=3?'  ·  '+s.streak+'× STREAK':''),1.4);
   if(s.kills>=s.m.objective)finish(s,'cleared');
   return where;
 }
 s.streak=0;s.effects.push({kind:'miss',at:s.clock,x,y});tell(s,s.ammo?'MISSED':'EMPTY · R TO RELOAD',.75);return 'miss';
}
const api={W,H,MAG,missions,clamp,money,make,ranks,box,tick,reload,cover,fire};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.IronEngine=api;
})(globalThis);
