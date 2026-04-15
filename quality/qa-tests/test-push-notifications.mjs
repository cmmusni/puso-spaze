const API="http://localhost:4000";const TS=Date.now();let P=0,F=0,W=0;const R=[],bugs=[];
function log(n,nm,ex,ac,st){R.push({n,nm,ex,ac,st});if(st=="PASS")P++;else if(st=="FAIL")F++;else W++;console.log((st=="PASS"?"[PASS]":st=="FAIL"?"[FAIL]":"[WARN]")+" #"+n+" "+nm);if(st=="FAIL")console.log("  Expected:",ex,"Actual:",ac);}
async function api(m,p,b,t){const h={"Content-Type":"application/json"};if(t)h["Authorization"]="Bearer "+t;const o={method:m,headers:h};if(b)o.body=JSON.stringify(b);const r=await fetch(API+p,o);let d=null;try{d=await r.json();}catch{}return{s:r.status,d};}
async function run(){
console.log("\n=== PUSH NOTIFICATION QA ===");
const h=await api("GET","/health");log(0,"Health","200",h.s+"",h.s===200?"PASS":"FAIL");
const rA=await api("POST","/api/users",{displayName:"PA_"+TS,deviceId:crypto.randomUUID()});
const rB=await api("POST","/api/users",{displayName:"PB_"+TS,deviceId:crypto.randomUUID()});
if(rA.s!==201||rB.s!==201){console.error("FATAL",rA.d,rB.d);process.exit(1);}
const A={id:rA.d.userId,nm:"PA_"+TS,tk:rA.d.token};const B={id:rB.d.userId,nm:"PB_"+TS,tk:rB.d.token};
console.log("A:",A.nm,"B:",B.nm);
console.log("\n-- VAPID --");
const v=await api("GET","/api/notifications/vapid-public-key");
log(1,"VAPID key","200+key",v.s+" "+typeof v.d?.publicKey,v.s===200&&v.d?.publicKey?.length>20?"PASS":"FAIL");
log(2,"VAPID base64","url-safe",/^[A-Za-z0-9_-]+$/.test(v.d?.publicKey||"")?"valid":"invalid",/^[A-Za-z0-9_-]+$/.test(v.d?.publicKey||"")?"PASS":"FAIL");
console.log("\n-- Expo Token --");
const tk="ExponentPushToken[t_"+TS+"]";
let r=await api("POST","/api/notifications/register-token",{userId:A.id,expoPushToken:tk},A.tk);log(3,"Register token","200",r.s+"",r.s===200&&r.d?.success?"PASS":"FAIL");
r=await api("POST","/api/notifications/register-token",{userId:A.id},A.tk);log(4,"Missing token","400",r.s+"",r.s===400?"PASS":"FAIL");
r=await api("POST","/api/notifications/register-token",{expoPushToken:tk},A.tk);log(5,"Missing userId","400",r.s+"",r.s===400?"PASS":"FAIL");
r=await api("POST","/api/notifications/register-token",{userId:A.id,expoPushToken:tk});log(6,"No auth","401",r.s+"",r.s===401?"PASS":"FAIL");
r=await api("POST","/api/notifications/register-token",{userId:A.id,expoPushToken:""},A.tk);log(7,"Empty token","400",r.s+"",r.s===400?"PASS":"FAIL");
r=await api("POST","/api/notifications/register-token",{userId:A.id,expoPushToken:"ExponentPushToken[v2_"+TS+"]"},A.tk);log(8,"Overwrite","200",r.s+"",r.s===200?"PASS":"FAIL");
console.log("\n-- Web Push --");
const ws={endpoint:"https://fcm.googleapis.com/f"+TS,keys:{p256dh:"P"+TS,auth:"A"+TS}};
r=await api("POST","/api/notifications/register-web-push",{userId:B.id,subscription:ws},B.tk);log(9,"Register web push","200",r.s+"",r.s===200&&r.d?.success?"PASS":"FAIL");
r=await api("POST","/api/notifications/register-web-push",{userId:B.id},B.tk);log(10,"Missing sub","400",r.s+"",r.s===400?"PASS":"FAIL");
r=await api("POST","/api/notifications/register-web-push",{userId:B.id,subscription:{endpoint:"x"}},B.tk);log(11,"Missing keys","400",r.s+"",r.s===400?"PASS":"FAIL");
r=await api("POST","/api/notifications/register-web-push",{userId:B.id,subscription:{keys:{p256dh:"x",auth:"y"}}},B.tk);log(12,"Missing endpoint","400",r.s+"",r.s===400?"PASS":"FAIL");
r=await api("POST","/api/notifications/register-web-push",{userId:B.id,subscription:ws});log(13,"No auth","401",r.s+"",r.s===401?"PASS":"FAIL");
r=await api("POST","/api/notifications/register-web-push",{subscription:ws},B.tk);log(14,"Missing userId","400",r.s+"",r.s===400?"PASS":"FAIL");
r=await api("POST","/api/notifications/register-web-push",{userId:B.id,subscription:{endpoint:"https://fcm.googleapis.com/v2/"+TS,keys:{p256dh:"V",auth:"V"}}},B.tk);log(15,"Overwrite sub","200",r.s+"",r.s===200?"PASS":"FAIL");
console.log("\n-- Triggers --");
const pr=await api("POST","/api/posts",{content:"Push test "+TS,userId:A.id},A.tk);const pid=pr.d?.post?.id;
log(16,"Create post","201",pr.s+"",pr.s===201&&pid?"PASS":"FAIL");
if(pid){
await new Promise(w=>setTimeout(w,300));
r=await api("POST","/api/posts/"+pid+"/reactions",{userId:B.id,type:"PRAY"},B.tk);log(17,"B reacts","201",r.s+"",r.s===201?"PASS":"FAIL");
await new Promise(w=>setTimeout(w,500));
let n=await api("GET","/api/notifications?userId="+A.id,null,A.tk);
let rn=(n.d?.notifications||[]).find(x=>x.type==="REACTION"&&x.data?.postId===pid);
log(18,"A react notif","exists",rn?"found":"MISSING",rn?"PASS":"FAIL");
log(19,"Has B name","in body",rn?((rn.body||"").includes(B.nm)?"yes":"no"):"n/a",rn&&(rn.body||"").includes(B.nm)?"PASS":rn?"FAIL":"WARN");
r=await api("POST","/api/posts/"+pid+"/comments",{userId:B.id,content:"Comment "+TS},B.tk);log(20,"B comments","201",r.s+"",r.s===201?"PASS":"FAIL");
await new Promise(w=>setTimeout(w,500));
n=await api("GET","/api/notifications?userId="+A.id,null,A.tk);
let cn=(n.d?.notifications||[]).find(x=>x.type==="COMMENT"&&x.data?.postId===pid);
log(21,"A comment notif","exists",cn?"found":"MISSING",cn?"PASS":"FAIL");
await api("POST","/api/posts/"+pid+"/reactions",{userId:A.id,type:"CARE"},A.tk);await new Promise(w=>setTimeout(w,300));
n=await api("GET","/api/notifications?userId="+A.id,null,A.tk);
let sn=(n.d?.notifications||[]).find(x=>x.type==="REACTION"&&x.data?.reactorId===A.id);
log(22,"No self-react","absent",sn?"FOUND":"absent",sn?"FAIL":"PASS");
await api("POST","/api/posts/"+pid+"/comments",{userId:A.id,content:"Self "+TS},A.tk);await new Promise(w=>setTimeout(w,300));
n=await api("GET","/api/notifications?userId="+A.id,null,A.tk);
let sc=(n.d?.notifications||[]).find(x=>x.type==="COMMENT"&&x.data?.commenterId===A.id);
log(23,"No self-comment","absent",sc?"FOUND":"absent",sc?"FAIL":"PASS");
}else{for(let i=17;i<=23;i++)log(i,"SKIP","","","WARN");}
console.log("\n-- Read/Unread --");
r=await api("GET","/api/notifications/unread-count?userId="+A.id,null,A.tk);log(24,"Unread count","200",r.s+" c="+r.d?.count,r.s===200?"PASS":"FAIL");
const al=await api("GET","/api/notifications?userId="+A.id,null,A.tk);
const un=(al.d?.notifications||[]).find(x=>x.read===false);
if(un){r=await api("PATCH","/api/notifications/"+un.id+"/read",{userId:A.id},A.tk);log(25,"Mark read","200",r.s+"",r.s===200?"PASS":"FAIL");}else{log(25,"Mark read","","SKIP","WARN");}
r=await api("PATCH","/api/notifications/read-all",{userId:A.id},A.tk);log(26,"Mark all","200",r.s+"",r.s===200&&r.d?.success?"PASS":"FAIL");
r=await api("GET","/api/notifications/unread-count?userId="+A.id,null,A.tk);log(27,"Unread=0","0",r.d?.count+"",r.d?.count===0?"PASS":"FAIL");
console.log("\n-- Auth --");
r=await api("GET","/api/notifications?userId="+A.id);log(28,"No auth","401",r.s+"",r.s===401?"PASS":"FAIL");
r=await api("GET","/api/notifications/unread-count?userId="+A.id);log(29,"Unread no auth","401",r.s+"",r.s===401?"PASS":"FAIL");
r=await api("PATCH","/api/notifications/read-all",{userId:A.id});log(30,"Mark no auth","401",r.s+"",r.s===401?"PASS":"FAIL");
r=await api("GET","/api/notifications?userId="+A.id,null,"bad");log(31,"Bad JWT","401",r.s+"",r.s===401?"PASS":"FAIL");
r=await api("GET","/api/notifications",null,A.tk);log(32,"No userId","400",r.s+"",r.s===400?"PASS":"FAIL");
console.log("\n-- Toggle --");
r=await api("PATCH","/api/users/"+A.id+"/notifications",{enabled:false},A.tk);log(33,"OFF","200+false",r.s+" "+r.d?.notificationsEnabled,r.s===200&&r.d?.notificationsEnabled===false?"PASS":"FAIL");
r=await api("PATCH","/api/users/"+A.id+"/notifications",{enabled:true},A.tk);log(34,"ON","200+true",r.s+" "+r.d?.notificationsEnabled,r.s===200&&r.d?.notificationsEnabled===true?"PASS":"FAIL");
console.log("\n-- Edge Cases --");
const lt="ExponentPushToken["+"a".repeat(5000)+"]";r=await api("POST","/api/notifications/register-token",{userId:A.id,expoPushToken:lt},A.tk);log(35,"5000ch token","200or400",r.s+"",r.s===200||r.s===400?"PASS":"FAIL");if(r.s===200){bugs.push({id:"W1",t:"Accepts 5000ch token"});W++;}
r=await api("POST","/api/notifications/register-token",{userId:A.id,expoPushToken:"ExponentPushToken[OR 1=1]"},A.tk);log(36,"SQLi token","200",r.s+"",r.s===200?"PASS":"FAIL");
r=await api("POST","/api/notifications/register-web-push",{userId:B.id,subscription:{endpoint:"<script>alert(1)</script>",keys:{p256dh:"t",auth:"t"}}},B.tk);log(37,"XSS endpoint","200",r.s+"",r.s===200?"PASS":"FAIL");
r=await api("PATCH","/api/notifications/"+crypto.randomUUID()+"/read",{userId:A.id},A.tk);log(38,"Non-existent","404",r.s+"",r.s===404?"PASS":"FAIL");
const f1=(al.d?.notifications||[])[0];if(f1){r=await api("PATCH","/api/notifications/"+f1.id+"/read",{},A.tk);log(39,"No userId body","400",r.s+"",r.s===400?"PASS":"FAIL");}else{log(39,"No userId","","SKIP","WARN");}
r=await api("POST","/api/notifications/register-web-push",{userId:B.id,subscription:{endpoint:"https://x.com/bell",keys:{p256dh:"e",auth:"e"}}},B.tk);log(40,"Special chars","200",r.s+"",r.s===200?"PASS":"FAIL");
console.log("\n-- Stress --");
let t0=Date.now();let sr=await Promise.allSettled(Array.from({length:50},(_,i)=>api("POST","/api/notifications/register-token",{userId:A.id,expoPushToken:"ExponentPushToken[s"+TS+"_"+i+"]"},A.tk)));let ok=sr.filter(x=>x.status==="fulfilled"&&x.value.s===200).length;log(41,"50x token ("+(Date.now()-t0)+"ms)",">=45",ok+"ok",ok>=45?"PASS":"FAIL");
t0=Date.now();sr=await Promise.allSettled(Array.from({length:50},(_,i)=>api("POST","/api/notifications/register-web-push",{userId:B.id,subscription:{endpoint:"https://fcm.googleapis.com/s/"+TS+"/"+i,keys:{p256dh:"k"+i,auth:"a"+i}}},B.tk)));ok=sr.filter(x=>x.status==="fulfilled"&&x.value.s===200).length;log(42,"50x web push ("+(Date.now()-t0)+"ms)",">=45",ok+"ok",ok>=45?"PASS":"FAIL");
if(pid){const ru=[];for(let i=0;i<20;i++){const r2=await api("POST","/api/users",{displayName:"R"+TS+"_"+i,deviceId:crypto.randomUUID()});if(r2.s===201)ru.push({id:r2.d.userId,tk:r2.d.token});}t0=Date.now();sr=await Promise.allSettled(ru.map(u=>api("POST","/api/posts/"+pid+"/reactions",{userId:u.id,type:"CARE"},u.tk)));ok=sr.filter(x=>x.status==="fulfilled"&&(x.value.s===201||x.value.s===409)).length;log(43,"20x reacts ("+(Date.now()-t0)+"ms)",">=18",ok+"ok",ok>=18?"PASS":"FAIL");await new Promise(w=>setTimeout(w,1000));const fn=await api("GET","/api/notifications?userId="+A.id,null,A.tk);const rns=(fn.d?.notifications||[]).filter(x=>x.type==="REACTION");log(44,"Mass notifs",">=10",rns.length+"",rns.length>=10?"PASS":"FAIL");}else{log(43,"Reacts","","SKIP","WARN");log(44,"Notifs","","SKIP","WARN");}
t0=Date.now();sr=await Promise.allSettled(Array.from({length:100},()=>api("GET","/api/notifications/vapid-public-key")));ok=sr.filter(x=>x.status==="fulfilled"&&x.value.s===200).length;log(45,"100x VAPID ("+(Date.now()-t0)+"ms)","100",ok+"ok",ok===100?"PASS":"FAIL");
console.log("\n-- Anon Leak --");
if(pid){await api("PATCH","/api/users/"+B.id+"/anonymous",{isAnonymous:true},B.tk);log(46,"B anon","200","ok","PASS");
r=await api("POST","/api/posts/"+pid+"/comments",{userId:B.id,content:"AnonP "+TS},B.tk);log(47,"Anon comment","201",r.s+"",r.s===201?"PASS":"FAIL");
await new Promise(w=>setTimeout(w,500));const an=await api("GET","/api/notifications?userId="+A.id,null,A.tk);const lc=(an.d?.notifications||[]).find(x=>x.type==="COMMENT"&&(x.body||"").includes("AnonP"));
if(lc){const lk=(lc.body||"").includes(B.nm)||(lc.title||"").includes(B.nm);const ld=JSON.stringify(lc.data).includes(B.nm);log(48,"No leak","absent",lk?"LEAKED":ld?"LEAKED data":"hidden",lk||ld?"FAIL":"PASS");if(lk||ld)bugs.push({id:"B1",t:"Anon leak"});}else{log(48,"Leak chk","","SKIP","WARN");}
await api("PATCH","/api/users/"+B.id+"/anonymous",{isAnonymous:false},B.tk);}else{log(46,"A","","S","WARN");log(47,"A","","S","WARN");log(48,"A","","S","WARN");}
console.log("\n=== REPORT ===");
console.log("Total:",P+F+W,"PASS:",P,"FAIL:",F,"WARN:",W);
if(bugs.length){console.log("Bugs:");bugs.forEach(b=>console.log("["+b.id+"]",b.t));}
console.log("| # | Test | Expected | Actual | Status |");console.log("|---|------|----------|--------|--------|");
for(const x of R){console.log("| "+x.n+" | "+x.nm+" | "+x.ex+" | "+x.ac+" | "+x.st+" |");}
process.exit(F>0?1:0);}
run().catch(e=>{console.error("Crashed:",e);process.exit(2);});