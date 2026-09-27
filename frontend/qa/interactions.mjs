// Functional checks: drive controls and assert the result set actually changes.
import { spawn } from "child_process";
import axios from "axios";
import WebSocket from "ws";
const API="http://localhost:3000", WEB="http://localhost:5173", PORT=9334;
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const chrome=spawn("/usr/bin/google-chrome",["--headless=new",`--remote-debugging-port=${PORT}`,"--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--window-size=1500,2400","about:blank"],{stdio:"ignore"});
process.on("exit",()=>chrome.kill());
async function target(){for(let i=0;i<60;i++){try{const{data}=await axios.get(`http://127.0.0.1:${PORT}/json/list`);const p=data.find(t=>t.type==="page");if(p?.webSocketDebuggerUrl)return p;}catch{}await sleep(300);}throw new Error("no chrome");}
class S{constructor(ws){this.ws=ws;this.id=0;this.p=new Map();this.errs=[];ws.on("message",raw=>{const m=JSON.parse(raw.toString());if(m.id&&this.p.has(m.id)){const{resolve,reject}=this.p.get(m.id);this.p.delete(m.id);m.error?reject(new Error(JSON.stringify(m.error))):resolve(m.result);}if(m.method==="Runtime.exceptionThrown")this.errs.push(String(m.params.exceptionDetails?.exception?.description||"").slice(0,200));});}
 send(method,params={}){const id=++this.id;return new Promise((res,rej)=>{this.p.set(id,{resolve:res,reject:rej});this.ws.send(JSON.stringify({id,method,params}));setTimeout(()=>{if(this.p.has(id)){this.p.delete(id);rej(new Error(method+" timeout"));}},30000);});}
 async ev(e){const r=await this.send("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true});return r.result?.value;}
 async goto(p){this.errs=[];await this.send("Page.navigate",{url:WEB+p});await sleep(1500);for(let i=0;i<20;i++){if(!await this.ev(`!!document.querySelector('.MuiCircularProgress-root,.MuiLinearProgress-root')`))break;await sleep(500);}await sleep(700);}}
const results=[];
const check=(name,ok,detail="")=>{results.push({name,ok,detail});console.log(`${ok?"✓":"✗"} ${name}${detail?"  — "+detail:""}`);};

const t=await target();const ws=new WebSocket(t.webSocketDebuggerUrl,{perMessageDeflate:false});
await new Promise(r=>ws.on("open",r));const s=new S(ws);
await s.send("Page.enable");await s.send("Runtime.enable");
const {data:login}=await axios.post(`${API}/auth/login`,{email:"admin@edu-visa.local",password:"password123"});
await s.send("Page.navigate",{url:WEB});await sleep(1200);
await s.ev(`localStorage.setItem('ev-auth',${JSON.stringify(login.access_token)});localStorage.setItem('ev-refresh',${JSON.stringify(login.refresh_token)});localStorage.setItem('ev-user',${JSON.stringify(JSON.stringify({id:login.user.id,name:login.user.email,role:login.user.role,branch:"",avatar:""}))});'ok'`);

// helper: read the data-grid's reported row count text
const rowCount = () => s.ev(`
  (()=>{ const el=[...document.querySelectorAll('*')].find(e=>/\\b\\d+\\s*(–|-)\\s*\\d+\\s*of\\s*\\d+/.test(e.textContent||'') && e.children.length===0);
         return el ? el.textContent.trim() : (document.querySelectorAll('.MuiDataGrid-row').length + ' rows'); })()`);

// ---- university list filters ------------------------------------------------
await s.goto("/universities");
const uniBefore = await rowCount();
// A MUI Select opens on mousedown of .MuiSelect-select — a plain .click() on the
// hidden input does nothing, which previously looked like a UI bug.
await s.ev(`(()=>{const l=[...document.querySelectorAll('label')].find(x=>/Provider type/i.test(x.textContent));
  const sel=l&&l.closest('.MuiFormControl-root')?.querySelector('.MuiSelect-select');
  if(!sel) return false; sel.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); return true;})()`);
await sleep(700);
const openedType = await s.ev(`!!document.querySelector('.MuiPopover-root,[role="listbox"]')`);
check("university list: Provider type control opens", openedType);
await s.ev(`(()=>{const o=[...document.querySelectorAll('[role="option"],li')].find(x=>x.textContent.trim()==='Government'); if(o){o.click();return true;} return false;})()`);
await sleep(2200);
const uniAfter = await rowCount();
check("university list: Government filter changes results", uniBefore!==uniAfter, `${uniBefore} -> ${uniAfter}`);

// ---- catalogue university filter -------------------------------------------
await s.goto("/catalogue");
const catBefore = await rowCount();
await s.ev(`(()=>{const l=[...document.querySelectorAll('label')].find(x=>/University \\/ college/i.test(x.textContent));
  const inp=l&&l.closest('.MuiFormControl-root')?.querySelector('input'); if(!inp)return false;
  inp.focus(); const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
  set.call(inp,'Monash'); inp.dispatchEvent(new Event('input',{bubbles:true})); return true;})()`);
await sleep(2500);
const optCount = await s.ev(`document.querySelectorAll('.MuiAutocomplete-option,[role="option"]').length`);
check("catalogue: university autocomplete returns options", optCount>0, `${optCount} options`);
await s.ev(`(()=>{const o=document.querySelector('.MuiAutocomplete-option,[role="option"]'); if(o){o.click();return true;}return false;})()`);
await sleep(2500);
const catAfter = await rowCount();
check("catalogue: university filter changes results", catBefore!==catAfter, `${catBefore} -> ${catAfter}`);

// ---- catalogue "taught in" (per-course campus) filter ------------------------
await s.goto("/catalogue");
const beforeCampus = await rowCount();
await s.ev(`(()=>{const l=[...document.querySelectorAll('label')].find(x=>/Taught in/i.test(x.textContent));
  const sel=l&&l.closest('.MuiFormControl-root')?.querySelector('.MuiSelect-select');
  if(!sel) return false; sel.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); return true;})()`);
await sleep(800);
const melbOpt = await s.ev(`(()=>{const o=[...document.querySelectorAll('[role="option"]')].find(x=>x.textContent.trim()==='Melbourne'); if(o){o.click();return true;} return false;})()`);
check("catalogue: 'Taught in' offers real campus cities", melbOpt);
await sleep(2500);
const afterCampus = await rowCount();
check("catalogue: 'Taught in' filter narrows to courses taught there",
      beforeCampus !== afterCampus, `${beforeCampus} -> ${afterCampus}`);

// ---- admission policy list -> detail navigation ------------------------------
await s.goto("/admission");
const hasRows = await s.ev(`document.querySelectorAll('table tbody tr').length`);
check("admission list: renders policy rows", hasRows>=9, `${hasRows} rows`);
await s.ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^View$/.test(x.textContent.trim())); if(b){b.click();return true;}return false;})()`);
await sleep(2500);
const onDetail = await s.ev(`location.pathname`);
check("admission list: View opens the detail page", onDetail.startsWith("/admission/") && onDetail.length>"/admission/".length, onDetail);

console.log(`\n${results.filter(r=>r.ok).length}/${results.length} functional checks passed`);
if (s.errs.length) console.log("uncaught errors:\n"+[...new Set(s.errs)].join("\n"));
ws.close();chrome.kill();process.exit(0);
