// Functional checks: drive controls and assert the result set actually changes.
import { spawn } from "child_process";
import axios from "axios";
import WebSocket from "ws";
// Overridable like pages.mjs: the dev server lands on 5174 whenever another
// project already holds 5173, and hardcoding it plants the auth tokens on the
// wrong origin — every check then fails as an unauthenticated redirect.
const API=process.env.API||"http://localhost:3000", WEB=process.env.WEB||"http://localhost:5173", PORT=9334;
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

// ---- coverage gap breakdown --------------------------------------------------
// The worklist is behind a disclosure button, so the page-level `expect` list
// cannot reach it; without this the table could silently render empty.
await s.goto("/data-sync/sources");
await sleep(2500);
const gapsHidden = await s.ev(`/No requirement on file for this level/.test(document.body.innerText)`);
check("coverage: breakdown is collapsed until asked for", !gapsHidden);
await s.ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/What is missing/i.test(x.textContent)); if(b){b.click();return true;}return false;})()`);
await sleep(1200);
const gapRows = await s.ev(`(()=>{const t=[...document.querySelectorAll('table')].filter(t=>/Bands at level/.test(t.innerText)); return t.reduce((n,x)=>n+x.querySelectorAll('tbody tr').length,0);})()`);
check("coverage: breakdown lists the blocking gaps", gapRows>0, `${gapRows} gap rows`);
const namesLevel = await s.ev(`/Research \\(PhD\\)/.test(document.body.innerText)`);
check("coverage: PhD gap is named in plain language", namesLevel);
// One briefing can govern several institutions, and the row must then name them
// all rather than whichever one the server saw first. Whether any such gap
// exists is a property of the data, not of the UI — after the Navitas
// pathway briefing was unlinked from Curtin and Griffith Universities, no gap
// spans more than one institution. So ask the API what to expect instead of
// asserting a string that is correctly absent.
const {data:cov} = await axios.get(`${API}/data-sync/coverage-gaps`, {headers:{Authorization:`Bearer ${login.access_token}`}});
const shared = cov.gaps.filter(g=>g.universities.length>1);
const spansMany = await s.ev(`(()=>{const m=document.body.innerText.match(/also governs \\d+ other institutions?: [^\\n]+/); return m?m[0]:'';})()`);
check("coverage: a shared briefing names every institution it governs",
      shared.length ? spansMany.length>0 : spansMany.length===0,
      shared.length ? spansMany : "no gap spans >1 institution; line correctly absent");
const linksPolicy = await s.ev(`(()=>{const t=[...document.querySelectorAll('table')].find(t=>/Bands at level/.test(t.innerText));
  const b=t&&[...t.querySelectorAll('tbody tr td:first-child button')][0]; if(!b)return ''; b.click(); return 'clicked';})()`);
await sleep(2200);
const wentToPolicy = await s.ev(`location.pathname`);
check("coverage: a gap row opens the policy to fix", wentToPolicy.startsWith("/admission/") && wentToPolicy.length>"/admission/".length, `${linksPolicy} -> ${wentToPolicy}`);

// ---- AI analysis: prose markers must match the rendered reference list -------
// The answer cites its sources as [n], where n indexes the sources given to the
// model. The list under it is the DEDUPED set, renumbered from 1 — so an answer
// citing [10] used to render four chips labelled [1]-[4] and point at nothing.
// Most of those sources have no public URL either, so the chips named nothing
// and went nowhere when clicked.
const aiStudent = (await axios.get(`${API}/students?_start=0&_end=1`, {headers:{Authorization:`Bearer ${login.access_token}`}})).data;
const aiId = (aiStudent.elements ?? aiStudent)[0].id;
await s.goto(`/students/${aiId}/matches`);
await sleep(3000);
const clicked = await s.ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Get AI analysis/i.test(x.textContent)); if(b){b.click();return true;} return false;})()`);
check("AI analysis: the trigger is present", clicked);
// The model call is slow; poll until the Sources block appears.
let sourcesText = "";
for (let i = 0; i < 40; i++) {
  await sleep(3000);
  sourcesText = await s.ev(`(()=>{const el=[...document.querySelectorAll('*')].find(e=>e.children.length===0 && /^Sources$/.test((e.textContent||'').trim())); return el ? el.parentElement.innerText : '';})()`);
  if (sourcesText) break;
}
check("AI analysis: a named Sources list is rendered", /\[1\]/.test(sourcesText) && sourcesText.length > 30,
      sourcesText ? sourcesText.split("\n").slice(1,3).join(" | ").slice(0,110) : "no Sources block appeared");

const cmp = await s.ev(`(()=>{
  const all=[...document.querySelectorAll('*')];
  const head=all.find(e=>e.children.length===0 && /^Sources$/.test((e.textContent||'').trim()));
  if(!head) return null;
  const list=head.parentElement.innerText;
  const listed=[...new Set([...list.matchAll(/\\[(\\d+)\\]/g)].map(m=>+m[1]))];
  // The answer body is the block before the Sources heading.
  const body=head.parentElement.parentElement.innerText.replace(list,'');
  const used=[...new Set([...body.matchAll(/\\[(\\d+(?:\\s*,\\s*\\d+)*)\\]/g)].flatMap(m=>m[1].split(',').map(x=>+x.trim())))];
  return {listed, used, max: used.length?Math.max(...used):0, count: listed.length};
})()`);
check("AI analysis: no marker points past the end of the list",
      !!cmp && cmp.max <= cmp.count && cmp.count > 0,
      cmp ? `markers up to [${cmp.max}], ${cmp.count} sources listed` : "could not read the panel");

// ---- AI consultant: history list and one conversation at a time ------------
// Was single-threaded, then briefly a split pane which left the chat squeezed
// and the history half-visible. It is a drill-down: history first, open one,
// back out. These checks pin that only ONE of the two is ever on screen.
const convStudent = (await axios.get(`${API}/students?_start=0&_end=1`, {headers:{Authorization:`Bearer ${login.access_token}`}})).data;
const convId = (convStudent.elements ?? convStudent)[0].id;
await s.goto(`/students/${convId}`);
await sleep(1500);
await s.ev(`(()=>{const t=[...document.querySelectorAll('[role="tab"],button')].find(x=>/AI Consultant/i.test(x.textContent)); if(t){t.click();return true;} return false;})()`);
await sleep(3500);

// A "view" is identified by what only that view has: the composer (chat) and
// the New-conversation button (history).
const viewState = () => s.ev(`(()=>({
  composer: !!document.querySelector('textarea[placeholder^="Ask about courses"]'),
  newBtn: [...document.querySelectorAll('button')].some(x=>/New conversation/i.test(x.textContent)),
  back: !!document.querySelector('button[aria-label="Back to all conversations"]'),
  rows: document.querySelectorAll('.MuiListItemButton-root').length,
}))()`);

let v = await viewState();
check("AI consultant: opens on the conversation history, not a chat", v.newBtn && !v.composer, JSON.stringify(v));
check("AI consultant: past conversations are listed", v.rows > 0, `${v.rows} rows`);

// Opening one must replace the history rather than sit beside it.
await s.ev(`(()=>{const r=[...document.querySelectorAll('.MuiListItemButton-root')].find(x=>/message/.test(x.innerText)&&!/^0 message/.test(x.innerText)); if(r){r.click();return true;} return false;})()`);
await sleep(3000);
v = await viewState();
check("AI consultant: opening a conversation replaces the history", v.composer && v.back && !v.newBtn, JSON.stringify(v));
const restored = await s.ev(`document.querySelectorAll('.MuiPaper-root .MuiAvatar-root').length`);
check("AI consultant: the opened conversation shows its messages", restored > 0, `${restored} message avatars`);

// And back must return to the history, not leave both showing.
await s.ev(`(()=>{const b=document.querySelector('button[aria-label="Back to all conversations"]'); if(b){b.click();return true;} return false;})()`);
await sleep(2500);
v = await viewState();
check("AI consultant: back returns to the history", v.newBtn && !v.composer, JSON.stringify(v));

// New conversation opens an empty composer.
await s.ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/New conversation/i.test(x.textContent)); if(b){b.click();return true;} return false;})()`);
await sleep(1800);
v = await viewState();
const emptyState = await s.ev(`/Ask the AI consultant about this student/.test(document.body.innerText)`);
check("AI consultant: New conversation opens an empty chat", v.composer && !v.newBtn && emptyState, JSON.stringify(v));

// Rename / delete reachable per row, and delete confirms first.
await s.ev(`(()=>{const b=document.querySelector('button[aria-label="Back to all conversations"]'); if(b){b.click();return true;} return false;})()`);
await sleep(2200);
await s.ev(`(()=>{const b=document.querySelector('.MuiListItemButton-root button[aria-label^="Options for"]'); if(b){b.click();return true;} return false;})()`);
await sleep(900);
const menuText = await s.ev(`(()=>{const m=document.querySelector('.MuiMenu-root'); return m?m.innerText.replace(/\\n/g,'|'):'';})()`);
check("AI consultant: each conversation offers rename and delete", /Rename/.test(menuText) && /Delete/.test(menuText), menuText);

await s.ev(`(()=>{const i=[...document.querySelectorAll('.MuiMenu-root li')].find(x=>/Delete/.test(x.textContent)); if(i){i.click();return true;} return false;})()`);
await sleep(900);
const confirmText = await s.ev(`(()=>{const d=document.querySelector('.MuiDialog-root'); return d?d.innerText.replace(/\\n/g,' '):'';})()`);
check("AI consultant: delete asks before destroying a transcript", /cannot be undone/i.test(confirmText), confirmText.slice(0,80));
await s.ev(`(()=>{const b=[...document.querySelectorAll('.MuiDialog-root button')].find(x=>/Cancel/i.test(x.textContent)); if(b){b.click();return true;} return false;})()`);
await sleep(600);

// The transcript panel is the tab's main working surface, so measure THAT
// rather than the tallest Paper on the page (which is the page container and
// would pass whatever height the panel had).
await s.ev(`(()=>{const r=[...document.querySelectorAll('.MuiListItemButton-root')].find(x=>/message/.test(x.innerText)); if(r){r.click();return true;} return false;})()`);
await sleep(2800);
const panelH = await s.ev(`(()=>{
  const ta=document.querySelector('textarea[placeholder^="Ask about courses"]');
  if(!ta) return 0;
  // The scrollable transcript is the Paper in the same flex column as the composer.
  const col=ta.closest('.MuiStack-root')?.parentElement;
  const panel=col && [...col.querySelectorAll('.MuiPaper-root')].find(e=>getComputedStyle(e).overflowY==='auto');
  return panel ? Math.round(panel.getBoundingClientRect().height) : 0;
})()`);
check("AI consultant: the transcript panel is given real height", panelH >= 420, `${panelH}px tall`);

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
