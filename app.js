// ===== Utilities =====
const $ = (s)=>document.querySelector(s);
const escapeHTML = (s)=> (s==null?'':String(s)).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const enc = (window.TextEncoder ? new TextEncoder() : { encode: (s)=> new Uint8Array(Array.from(unescape(encodeURIComponent(s))).map(c=>c.charCodeAt(0))) });
const HAS_SUBTLE = !!(window.crypto && crypto.subtle && crypto.subtle.digest);
const b64 = (buf)=> btoa(String.fromCharCode(...new Uint8Array(buf)));
const ab  = (b64s)=>{ const bin=atob(b64s); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i); return u.buffer; };
async function sha256B64(s){ const data = enc.encode(s); const dig = await crypto.subtle.digest('SHA-256', data); return b64(dig); }
function today(){ const d=new Date(); d.setHours(0,0,0,0); return d; }
const pad = (n)=> (n<10? '0'+n : ''+n);
const fmt = (d)=> `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse = (s)=>{ const [y,m,d]=s.split('-').map(x=>parseInt(x,10)); const dt=new Date(y,m-1,d); dt.setHours(0,0,0,0); return dt; };
function describeSched(s){
  const t = s.type; const e = s.every||1;
  const map = { daily:'täglich', weekly:'wöchentlich', monthly:'monatlich', quarterly:'quartalsweise', yearly:'jährlich' };
  const base = map[t]||t;
  return e>1 ? `${base} (${e})` : base;
}

// ===== Data layer =====
const DB = {
  load(){
    let j={}; try{ j=JSON.parse(localStorage.getItem('roomlog-v2')||'{}'); }catch{}
    this.users = Array.isArray(j.users)? j.users : [];
    this.rooms = Array.isArray(j.rooms)? j.rooms : [];
    this.acts  = Array.isArray(j.acts)? j.acts : [];
    this.logs  = Array.isArray(j.logs)? j.logs : [];
    this.acks  = Array.isArray(j.acks)? j.acks : []; // {id, activityId, dueDate, type:'ok'|'abw', note, abwNo, userId, ts}
    this.comments = Array.isArray(j.comments) ? j.comments : [];  // Neue Zeile

    // Try migration from v1 if empty
    if (!this.rooms.length && !this.acts.length && !this.users.length){
      tryMigrateFromV1(this);
    }

    // Seed demo if still empty
    if (!this.rooms.length || !this.acts.length || !this.users.length){
      if (!this.users.length){
        this.users = [
          {id:'u1', name:'Demo Admin', role:'admin', hash:null},
          {id:'u2', name:'Mitarbeiter/in', role:'user', hash:null},
          {id:'u3', name:'Pruefer/in', role:'pruefer', hash:null}
        ];
      }
      if (!this.rooms.length || !this.acts.length){ seed(this); }
      this.save();
    }
  },
  save(){ 
    localStorage.setItem('roomlog-v2', JSON.stringify({
      users: this.users, 
      rooms: this.rooms, 
      acts: this.acts, 
      logs: this.logs, 
      acks: this.acks,
      comments: this.comments  // Neue Zeile
    })); 
  }
};

function tryMigrateFromV1(db){
  try{
    const raw = localStorage.getItem('roomlog-db'); if (!raw) return;
    const v1 = JSON.parse(raw);
    const users = (v1.users||[]).map(u=>({ id:u.id||uuid(), name:u.name||'Benutzer', role:u.role||'user', hash:null }));
    const rooms = (v1.rooms||[]).map(r=>({ id:r.id||uuid(), name:r.name||'Raum', note:r.note||'' }));
    const acts = (v1.activities||[]).map(a=>({ id:a.id||uuid(), roomId:a.roomId, title:a.title||'Tätigkeit', desc:a.desc||'', sched: mapSched(a.schedule||{}) }));
    const logs = (v1.logs||[]).map(l=>({ id:l.id||uuid(), activityId:l.activityId, dueDate:l.dueDate, userId:l.userId, ts:l.doneAtISO||new Date().toISOString() }));
    if (rooms.length){ db.rooms = rooms; }
    if (acts.length){ db.acts = acts; }
    if (users.length){ db.users = users; }
    if (logs.length){ db.logs = logs; }
    const acks = (v1.acks||[]).map(a=>({ id:a.id||uuid(), activityId:a.activityId, dueDate:a.dueDate, type:'ok', note:a.note||'', abwNo:null, userId:a.userId||null, ts:a.ackAtISO||new Date().toISOString() }));
    if (acks.length){ db.acks = acks; }
    db.save();
    console.info('Migration aus v1 abgeschlossen.');
  }catch(e){ console.warn('Migration v1 fehlgeschlagen:', e); }
}

function mapSched(s){
  const type = s.type||'daily';
  let every = s.every||1;
  let t = type;
  if (type==='quarterly'){ t='monthly'; every = every*3; }
  if (type==='yearly'){ t='monthly'; every = every*12; }
  const start = s.startDate || fmt(today());
  return { type:t, every, start };
}

function uuid(){ if (crypto.randomUUID) return crypto.randomUUID(); return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);}); }

function seed(db){
  const r1={id:uuid(), name:'Reinraum 101', note:'EG Nord'}; const r2={id:uuid(), name:'Lager A', note:'UG West'};
  db.rooms.push(r1,r2);
  const start = fmt(today());
  db.acts.push(
    {id:uuid(), roomId:r1.id, title:'Oberflächenreinigung', desc:'Tische, Griffe, Bedienelemente', sched:{type:'daily', every:1, start}},
    {id:uuid(), roomId:r1.id, title:'Filterkontrolle', desc:'HEPA Sichtkontrolle', sched:{type:'monthly', every:1, start}},
    {id:uuid(), roomId:r2.id, title:'Temperatur prüfen', desc:'Soll 15–25 °C', sched:{type:'daily', every:1, start}},
  );
}

// ===== Auth =====
const state = { date: today(), userId:null, role:null, view:'today' };

function refreshLoginUsers(){ const dl=$('#loginUsers'); dl.innerHTML = DB.users.map(u=>`<option value="${u.name}"></option>`).join(''); }
function applyAuthUI(){
  const logged = !!state.userId;
  $('#auth').style.display = logged? 'none':'flex';
  $('#btnLogout').style.display = logged? '':'none';
  $('#btnOpenLogin').style.display = logged? 'none':'';
  $('#profileBox').style.display = logged? '':'none';
  if (logged){ const u=DB.users.find(x=>x.id===state.userId); $('#badge').textContent = `${u.name} (${u.role})`; }
  $('#admin').style.display = (state.role==='admin')? '':'none';
  // Bottom nav admin tab visibility
  const adminTab = document.querySelector('.bottom-nav [data-tab="admin"]');
  if (adminTab) adminTab.style.display = (state.role==='admin')? '' : 'none';
  // Apply per-user card widths
  if (typeof applyCardWidths === 'function') applyCardWidths();
  // Show/hide bottom nav when logged out
  const nav = document.getElementById('bottomNav');
  if (nav) nav.style.display = logged ? '' : 'none';
}

async function setPassword(u, pw){
  if (HAS_SUBTLE){ u.hash = await sha256B64('v2:'+pw); }
  else { u.hash = null; /* Demo-Betrieb: akzeptiere nur "test" */ }
}
async function verify(u, pw){
  if (HAS_SUBTLE){ const h = await sha256B64('v2:'+pw); return u.hash? (h===u.hash) : (pw==='test'); }
  return pw==='test';
}
function saveSession(remember){ const payload=JSON.stringify({uid:state.userId, ts:Date.now()}); (remember? localStorage: sessionStorage).setItem('roomlog-v2-session', payload); if (!remember) localStorage.removeItem('roomlog-v2-session'); }
function loadSession(){ try{ const j=JSON.parse(localStorage.getItem('roomlog-v2-session')||sessionStorage.getItem('roomlog-v2-session')||'null'); return j&&j.uid? j:null; }catch{return null;} }
function clearSession(){ localStorage.removeItem('roomlog-v2-session'); sessionStorage.removeItem('roomlog-v2-session'); }

// ===== Scheduling helpers (simplified) =====
function monthsBetween(a,b){ return (a.getFullYear()-b.getFullYear())*12 + (a.getMonth()-b.getMonth()); }
function daysBetween(a,b){ return Math.floor((a-b)/(1000*60*60*24)); }
function isDue(act, d){
  const s=act.sched; const start=parse(s.start); if (d<start) return false; const every=Math.max(1, s.every||1);
  if (s.type==='daily'){
    const dd = daysBetween(d, start); return dd % every === 0;
  }
  if (s.type==='weekly'){
    const dd = daysBetween(d, start);
    const wd = (s.weekday!=null) ? ((parseInt(s.weekday,10)-1+7)%7) : start.getDay();
    if (d.getDay()!==wd) return false; const weeks=Math.floor(dd/7); return weeks % every === 0;
  }
  if (s.type==='monthly'){
    const md = s.monthDay || start.getDate();
    if (d.getDate()!==md) return false; const mm = monthsBetween(d, start); return mm % every === 0;
  }
  if (s.type==='quarterly'){
    const md = s.monthDay || start.getDate();
    if (d.getDate()!==md) return false; const mm = monthsBetween(d, start); return mm % (every*3) === 0;
  }
  if (s.type==='yearly'){
    const md = s.monthDay || start.getDate();
    const ym = (s.yearMonth!=null) ? parseInt(s.yearMonth,10)-1 : start.getMonth();
    if (d.getDate()!==md || d.getMonth()!==ym) return false; const mm = monthsBetween(d, start); return mm % (every*12) === 0;
  }
  return false;
}
parse.start = parse; // small trick to keep functions together

// ----- Prüfer-Aktionen -----
function onAckComment(activityId, dueDate){
  if (state.role!=='pruefer'){ alert('Nur Prüfer darf quittieren.'); return; }
  const note = prompt('Kurzer Kommentar (kleiner Mangel):');
  if (note==null) return;
  const rec = { id:uuid(), activityId, dueDate, type:'ok', note:note.trim(), abwNo:null, userId:state.userId, ts:new Date().toISOString() };
  if (!DB.acks) DB.acks=[];
  if (DB.acks.find(a=>a.activityId===activityId && a.dueDate===dueDate)){
    alert('Diese Fälligkeit wurde bereits quittiert und kann nicht geändert werden.');
    return;
  }
  DB.acks.push(rec); DB.save(); renderOverdue(); renderAcks();
}
function onAckABW(activityId, dueDate){
  if (state.role!=='pruefer'){ alert('Nur Prüfer darf ABW erfassen.'); return; }
  const nr = prompt('ABW-Nummer eingeben:');
  if (nr==null || !nr.trim()) return;
  const note = prompt('Hinweis (optional):')||'';
  const rec = { id:uuid(), activityId, dueDate, type:'abw', note:note.trim(), abwNo:nr.trim(), userId:state.userId, ts:new Date().toISOString() };
  if (!DB.acks) DB.acks=[];
  if (DB.acks.find(a=>a.activityId===activityId && a.dueDate===dueDate)){
    alert('Diese Fälligkeit wurde bereits quittiert und kann nicht geändert werden.');
    return;
  }
  DB.acks.push(rec); DB.save(); renderOverdue(); renderAcks();
}

// ===== Rendering =====
function fillSelects(){
  const fr=$('#filterRoom'); const lr=$('#logRoom'); const ar=$('#actRoom'); const ak=$('#ackRoom');
  const opts = ['<option value="">Alle Räume</option>'].concat(DB.rooms.map(r=>`<option value="${r.id}">${r.name}</option>`)).join('');
  if (fr) fr.innerHTML = opts; if (lr) lr.innerHTML = opts; if (ak) ak.innerHTML = opts; if (ar) ar.innerHTML = DB.rooms.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
}

function renderCommentHistory(activityId, dueDate) {
    const comments = DB.comments
        .filter(c => c.activityId === activityId && c.dueDate === dueDate)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (!comments.length) return '';

    return `
        <div class="comment-history">
            ${comments.map(c => {
                const user = DB.users.find(u => u.id === c.userId);
                const date = new Date(c.createdAt);
                return `
                    <div class="comment-entry">
                        <div>${escapeHTML(c.text)}</div>
                        <div class="comment-metadata">
                            ${escapeHTML(user?.name || 'Unbekannt')} - 
                            ${date.toLocaleDateString('de-DE')} 
                            ${date.toLocaleTimeString('de-DE')}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Chronologische (älteste zuerst) Darstellung für Prüfungs-/Quittierungsbereiche
function renderCommentHistoryChrono(activityId, dueDate) {
    const comments = DB.comments
        .filter(c => c.activityId === activityId && c.dueDate === dueDate)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    if (!comments.length) return '';

    return `
        <div class="comment-history">
            ${comments.map(c => {
                const user = DB.users.find(u => u.id === c.userId);
                const d = new Date(c.createdAt);
                const datum = d.toLocaleDateString('de-DE');
                const zeit = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                return `
                    <div class="comment-entry">
                        <div class="comment-metadata">${datum} ${zeit} – ${escapeHTML(user?.name || 'Unbekannt')}:</div>
                        <div>${escapeHTML(c.text)}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderToday(){
  $('#today').textContent = ' '+fmt(state.date);
  const tbody=$('#tblToday tbody'); const q=($('#search').value||'').toLowerCase(); const room=($('#filterRoom').value||''); const st=$('#filterStatus').value||'';
  const canMark = state.role==='user' && fmt(state.date)===fmt(today());
  const rows=[];
  DB.acts.forEach(a=>{
    const r=DB.rooms.find(x=>x.id===a.roomId); if (!r) return;
    if (!isDue(a, state.date)) return;
    if (room && a.roomId!==room) return;
    const hay=(a.title+' '+r.name).toLowerCase(); if (q && !hay.includes(q)) return;
    const due=fmt(state.date);
    const done = DB.logs.some(l=>l.activityId===a.id && l.dueDate===due);
    if (st==='offen' && done) return; if (st==='erledigt' && !done) return;
    const statusHtml = done ? '<span class="status-done">Erledigt</span>' : '<span class="status-open">Offen</span>';
    const rowCls = done ? 'row-done' : 'row-open';
    const hasComment = DB.comments.some(c => c.activityId === a.id && c.dueDate === due);
    rows.push(`
        <tr class="${rowCls}" onclick="toggleComment(event, '${a.id}', '${due}')">
            <td>${r.name}</td>
            <td>
                ${a.title}
                ${hasComment ? '<span class="comment-indicator" onclick="toggleComment(event, \''+a.id+'\', \''+due+'\')"></span>' : ''}
                <div class="muted"><small>${a.desc||''}</small></div>
            </td>
            <td class="hide-sm">${describeSched(a.sched)}</td>
            <td>${due}</td>
            <td>${statusHtml}</td>
            <td>
                <button ${!canMark||done ? 'disabled' : ''} 
                        data-done="${a.id}" 
                        onclick="event.stopPropagation()"
                        class="${done ? 'disabled' : ''}">
                    Erledigt
                </button>
            </td>
        </tr>
        <tr id="comment-row-${a.id}" class="comment-row">
            <td colspan="6">
                <textarea id="comment-${a.id}" 
                         placeholder="Kommentar eingeben..."
                ></textarea>
                <div class="comment-actions">
                    <button onclick="saveComment('${a.id}', '${due}')" 
                            class="small-button">
                        Speichern
                    </button>
                    <button onclick="toggleComment(event, '${a.id}', '${due}')" 
                            class="small-button ghost">
                        Schließen
                    </button>
                </div>
                ${renderCommentHistory(a.id, due)}
            </td>
        </tr>
    `);
  });
  tbody.innerHTML = rows.join('') || `<tr><td colspan="6" class="muted">Keine fälligen Tätigkeiten.</td></tr>`;
  tbody.querySelectorAll('button[data-done]').forEach(btn=> btn.addEventListener('click', (e)=>{
    const id=e.currentTarget.getAttribute('data-done'); const a=DB.acts.find(x=>x.id===id); if (!a) return;
    DB.logs.unshift({id:uuid(), activityId:id, dueDate:fmt(state.date), userId:state.userId, ts:new Date().toISOString()}); DB.save(); renderToday(); renderLogs();
  }));

  // Event-Listener für Kommentarbereiche
  tbody.querySelectorAll('.activity-title').forEach(el => {
    el.addEventListener('click', () => {
      const activityId = el.getAttribute('data-activity');
      const commentArea = document.getElementById(`comment-area-${activityId}`);
      if (commentArea) {
        commentArea.style.display = 
          commentArea.style.display === 'none' ? 'block' : 'none';
      }
    });
  });
  // also update mobile cards
  renderTodayCards();
}

function renderTodayCards(){
  const host = document.getElementById('cardsToday'); if (!host) return;
  const q=($('#search').value||'').toLowerCase(); const room=($('#filterRoom').value||''); const st=$('#filterStatus').value||'';
  const canMark = state.role==='user' && fmt(state.date)===fmt(today());
  const due = fmt(state.date);
  const cards=[];
  DB.acts.forEach(a=>{
    const r=DB.rooms.find(x=>x.id===a.roomId); if (!r) return;
    if (!isDue(a, state.date)) return;
    if (room && a.roomId!==room) return;
    const hay=(a.title+' '+r.name).toLowerCase(); if (q && !hay.includes(q)) return;
    const done = DB.logs.some(l=>l.activityId===a.id && l.dueDate===due);
    if (st==='offen' && done) return; if (st==='erledigt' && !done) return;
    const comments = DB.comments.filter(c=>c.activityId===a.id && c.dueDate===due).length;
    cards.push(`
      <div class="task-card">
        <div class="task-head">
          <div class="task-title">${escapeHTML(a.title)}</div>
          <span class="${done?'status-done':'status-open'}">${done?'Erledigt':'Offen'}</span>
        </div>
        <div class="task-sub">${escapeHTML(r.name)} • ${escapeHTML(describeSched(a.sched))} • ${escapeHTML(due)}</div>
        ${a.desc?`<div class="muted"><small>${escapeHTML(a.desc)}</small></div>`:''}
        <div class="task-meta">
          <span class="meta-pill">Kommentare: ${comments}</span>
        </div>
        <div class="task-actions">
          <button class="small-button" onclick="openSheet('today','${a.id}','${due}')">Kommentar</button>
          <button class="small-button" ${!canMark||done?'disabled':''} onclick="markDone('${a.id}','${due}')">Erledigt</button>
        </div>
      </div>`);
  });
  host.innerHTML = cards.join('') || `<div class="muted">Keine fälligen Tätigkeiten.</div>`;
}

function markDone(activityId, due){
  DB.logs.unshift({id:uuid(), activityId, dueDate:due, userId:state.userId, ts:new Date().toISOString()}); DB.save(); renderToday(); renderOverdue(); renderLogs();
}

function renderOverdue() {
    const tbody = $('#tblOverdue tbody');
    if (!tbody) return;

    const rows = [];
    const pastDays = [];
    let checkDate = new Date(state.date);
    for (let i = 0; i < 30; i++) {
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
        pastDays.push(fmt(checkDate));
    }

    DB.acts.forEach(a => {
        for (let checkDay of pastDays) {
            if (!isDue(a, parse(checkDay))) continue;

            const isDone = DB.logs.some(l => l.activityId === a.id && l.dueDate === checkDay);
            if (isDone) continue;

            const hasAck = DB.acks && DB.acks.some(ack => ack.activityId === a.id && ack.dueDate === checkDay);
            if (hasAck) continue;

            const r = DB.rooms.find(x => x.id === a.roomId);
            if (!r) continue;

            const hasComment = DB.comments.some(c => c.activityId === a.id && c.dueDate === checkDay);
            const isPruefer = (state.role === 'pruefer');

            const statusHtml = '<span class="status-open">Versäumt</span>';
            const schedHtml = describeSched(a.sched);

            rows.push(`
                <tr class="overdue-row${hasComment ? ' has-comment' : ''}" onclick="toggleOverdueComment(event, '${a.id}', '${checkDay}')">
                    <td>${escapeHTML(r.name)}</td>
                    <td>
                        ${escapeHTML(a.title)}
                        ${hasComment
                            ? '<span class="comment-indicator" onclick="toggleOverdueComment(event, \'' + a.id + '\', \'' + checkDay + '\')"></span>'
                            : ''}
                        <div class="muted"><small>${escapeHTML(a.desc || '')}</small></div>
                    </td>
                    <td class="hide-sm">${escapeHTML(schedHtml)}</td>
                    <td>${escapeHTML(checkDay)}</td>
                    <td>${statusHtml}</td>
                    <td>
                        <button class="small-button quit-btn" onclick="event.stopPropagation(); quitOverdue('${a.id}', '${checkDay}')" ${isPruefer ? '' : 'disabled'}>Quittieren</button>
                    </td>
                </tr>
                <tr id="overdue-comment-row-${a.id}" class="comment-row">
                    <td colspan="6">
                        <textarea id="overdue-comment-${a.id}" placeholder="Kommentar eingeben..."></textarea>
                        <div class="comment-actions">
                            <button class="small-button" onclick="saveOverdueComment('${a.id}', '${checkDay}')">Speichern</button>
                            <button class="small-button ghost" onclick="toggleOverdueComment(event, '${a.id}', '${checkDay}')">Schließen</button>
                        </div>
                        ${renderCommentHistoryChrono(a.id, checkDay)}
                    </td>
                </tr>
            `);
            break;
        }
    });

    tbody.innerHTML = rows.join('') || '<tr><td colspan="6" class="muted">Keine offenen Prüfungen.</td></tr>';
    // also update mobile cards
    renderOverdueCards();
}

function renderOverdueCards(){
  const host = document.getElementById('cardsOverdue'); if (!host) return;
  const rows=[]; const pastDays=[]; let checkDate=new Date(state.date);
  for (let i=0;i<30;i++){ checkDate=new Date(checkDate.getTime()-86400000); pastDays.push(fmt(checkDate)); }
  DB.acts.forEach(a=>{
    for (let checkDay of pastDays){
      if (!isDue(a, parse(checkDay))) continue;
      const isDone = DB.logs.some(l=>l.activityId===a.id && l.dueDate===checkDay); if (isDone) continue;
      const hasAck = DB.acks && DB.acks.some(ack=>ack.activityId===a.id && ack.dueDate===checkDay); if (hasAck) continue;
      const r=DB.rooms.find(x=>x.id===a.roomId); if (!r) continue;
      const commentCount = DB.comments.filter(c=>c.activityId===a.id && c.dueDate===checkDay).length;
      const isPruefer = (state.role==='pruefer');
      rows.push(`
        <div class="task-card">
          <div class="task-head">
            <div class="task-title">${escapeHTML(a.title)}</div>
            <span class="status-open">Versäumt</span>
          </div>
          <div class="task-sub">${escapeHTML(r.name)} • ${escapeHTML(describeSched(a.sched))} • ${escapeHTML(checkDay)}</div>
          ${a.desc?`<div class="muted"><small>${escapeHTML(a.desc)}</small></div>`:''}
          <div class="task-meta"><span class="meta-pill">Kommentare: ${commentCount}</span></div>
          <div class="task-actions">
            <button class="small-button" onclick="openSheet('overdue','${a.id}','${checkDay}')">Kommentar</button>
            <button class="small-button quit-btn" onclick="openSheet('overdue','${a.id}','${checkDay}', true)" ${isPruefer?'' :'disabled'}>Quittieren</button>
          </div>
        </div>`);
      break;
    }
  });
  host.innerHTML = rows.join('') || `<div class="muted">Keine offenen Prüfungen.</div>`;
}

function renderLogs(){
  const tbody=$('#tblLogs tbody'); const rf=$('#logRoom').value||''; const q=($('#logSearch').value||'').toLowerCase();
  const slice = DB.logs.slice(0,200).filter(l=>{ const a=DB.acts.find(x=>x.id===l.activityId); if (!a) return false; if (rf && a.roomId!==rf) return false; const r=DB.rooms.find(x=>x.id===a.roomId); const hay=`${a.title} ${r?r.name:''} ${l.dueDate}`.toLowerCase(); if (q && !hay.includes(q)) return false; return true; });
  const rows = slice.map(l=>{
    const a=DB.acts.find(x=>x.id===l.activityId);
    const r=DB.rooms.find(x=>x.id===a.roomId);
    const dt=new Date(l.ts);
    const when=`${fmt(dt)} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    const u=DB.users.find(x=>x.id===l.userId);
    const cid=`log-comments-${l.activityId}-${l.dueDate}`;
    const commentsHtml = renderCommentHistoryChrono(l.activityId, l.dueDate);
    const hasComment = !!commentsHtml;
    const rowOpenAttr = hasComment ? ` onclick=\"toggleLogComments('${l.activityId}','${l.dueDate}')\"` : '';
    const bubble = hasComment ? `<span class=\"comment-indicator\" onclick=\"toggleLogComments('${l.activityId}','${l.dueDate}')\"></span>` : '';
    const detail = hasComment ? `<tr id=\"${cid}\" class=\"comment-row\" style=\"display:none; background: var(--bg);\"><td colspan=\"6\">${commentsHtml}</td></tr>` : '';
    return `<tr${rowOpenAttr}><td>${when}</td><td>${u?u.name:'—'}</td><td>${r?r.name:'—'}</td><td>${a?a.title:'—'}</td><td>${l.dueDate}</td><td>${bubble}</td></tr>${detail}`;
  }).join('');
  tbody.innerHTML = rows || `<tr><td colspan=\"6\" class=\"muted\">Keine Protokolle.</td></tr>`;
  renderLogsCards();
}

function toggleLogComments(activityId, dueDate){
  const row = document.getElementById(`log-comments-${activityId}-${dueDate}`);
  if (!row) return; const vis = row.style.display === 'table-row'; row.style.display = vis ? 'none' : 'table-row';
}

function renderAcks(){
  const tbody = document.querySelector('#tblAcks tbody'); if (!tbody) return;
  const rf = ($('#ackRoom')?.value)||''; const q=(($('#ackSearch')?.value)||'').toLowerCase();
  const items = (DB.acks||[]).slice(0,200).filter(a=>{ const act=DB.acts.find(x=>x.id===a.activityId); if (!act) return false; if (rf && act.roomId!==rf) return false; const room=DB.rooms.find(x=>x.id===act.roomId); const hay = `${act.title} ${room?room.name:''} ${a.dueDate} ${a.note||''}`.toLowerCase(); if (q && !hay.includes(q)) return false; return true; });
  items.sort((a,b)=> new Date(b.ts) - new Date(a.ts));
  tbody.innerHTML = items.map(a=>{
    const act = DB.acts.find(x=>x.id===a.activityId);
    const room = act ? DB.rooms.find(r=>r.id===act.roomId) : null;
    const dt = new Date(a.ts); const when = `${fmt(dt)} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    const pruefer = DB.users.find(u=>u.id===a.userId)?.name || '—';
    const typ = a.type==='abw' ? 'ABW' : 'OK';
    const details = a.type==='abw'
      ? `ABW${a.abwNo?(' #'+a.abwNo):''}${a.note?': '+escapeHTML(a.note):''}`
      : (a.note? escapeHTML(a.note) : '—');
    const info = `Geprüft von ${escapeHTML(pruefer)} am ${when}`;
    const comments = renderCommentHistoryChrono(a.activityId, a.dueDate);
    const hasComment = !!comments;
    const cid = `ack-comments-${a.activityId}-${a.dueDate}`;
    const rowOpenAttr = hasComment ? ` onclick=\"toggleAckComments('${a.activityId}','${a.dueDate}')\"` : '';
    const bubble = hasComment ? `<span class=\"comment-indicator\" onclick=\"toggleAckComments('${a.activityId}','${a.dueDate}')\"></span>` : '';
    const detail = hasComment ? `
      <tr id=\"${cid}\" class=\"comment-row\" style=\"display:none; background: var(--bg);\">
        <td colspan=\"7\">
          <div class=\"ack-info\">${info}</div>
          ${comments}
        </td>
      </tr>` : '';
    return `
      <tr${rowOpenAttr}>
        <td>${when}</td>
        <td>${pruefer}</td>
        <td>${room?escapeHTML(room.name):'—'}</td>
        <td>${act?escapeHTML(act.title):'—'}</td>
        <td>${escapeHTML(a.dueDate)}</td>
        <td>${typ}</td>
        <td>${details}</td>
        <td>${bubble}</td>
      </tr>
      ${detail}`;
  }).join('') || `<tr><td colspan="7" class="muted">Keine Quittierungen vorhanden.</td></tr>`;
  renderAcksCards();
}

function toggleAckComments(activityId, dueDate){
  const row = document.getElementById(`ack-comments-${activityId}-${dueDate}`);
  if (!row) return; const vis = row.style.display === 'table-row'; row.style.display = vis ? 'none' : 'table-row';
}

function renderAdmin(){
  $('#admin').style.display = (state.role==='admin')? '':'none';
  if (state.role!=='admin') return;
  // Populate admin filter selects
  const sfr=$('#actFilterRoom'); if (sfr){ const cur=sfr.value||''; sfr.innerHTML = ['<option value="">Alle Räume</option>'].concat(DB.rooms.map(r=>`<option value="${r.id}">${escapeHTML(r.name)}</option>`)).join(''); sfr.value=cur; }
  const sfd=$('#actFilterDept'); if (sfd){ const curd=sfd.value||''; sfd.innerHTML = ['<option value="">Alle Abteilungen</option>'].concat((departments.items||[]).map(d=>`<option value="${d.id}">${escapeHTML(d.name)}</option>`)).join(''); sfd.value=curd; }
  // Rooms (with search filter)
  const rtbody=$('#tblRooms tbody');
  const rq = ($('#roomSearch')?.value||'').toLowerCase();
  const rooms = DB.rooms.filter(r=>{ const hay=`${r.name} ${r.note||''}`.toLowerCase(); return !rq || hay.includes(rq); });
  rtbody.innerHTML = rooms.map(r=>`<tr id="room-${r.id}"><td>${escapeHTML(r.name)}</td><td class=\"muted\">${escapeHTML(r.note||'')}</td><td><span class=\"link\" data-edit-room="${r.id}">Bearbeiten</span> | <span class=\"dangerlink\" data-del-room="${r.id}">löschen</span></td></tr>`).join('')||`<tr><td colspan=\"3\" class=\"muted\">Keine Räume.</td></tr>`;
  rtbody.querySelectorAll('[data-del-room]').forEach(el=> el.addEventListener('click',()=>{ const id=el.getAttribute('data-del-room'); const r=DB.rooms.find(x=>x.id===id); if (!confirm(`Raum "${r?r.name:''}" wirklich löschen?`)) return; DB.rooms=DB.rooms.filter(r=>r.id!==id); DB.acts=DB.acts.filter(a=>a.roomId!==id); DB.save(); fillSelects(); renderAdmin(); renderToday(); renderOverdue(); }));
  rtbody.querySelectorAll('[data-edit-room]').forEach(el=> el.addEventListener('click',()=>{ const id=el.getAttribute('data-edit-room'); const r=DB.rooms.find(x=>x.id===id); if (!r) return; const tr=$(`#room-${id}`); tr.innerHTML = `<td><input id=\"er-name-${id}\" value=\"${escapeHTML(r.name)}\"/></td><td><input id=\"er-note-${id}\" value=\"${escapeHTML(r.note||'')}\"/></td><td><button data-save-room=\"${id}\">Speichern</button> <button class=\"ghost\" data-cancel-room=\"${id}\">Abbrechen</button></td>`; tr.querySelector('[data-save-room]').addEventListener('click',()=>{ const name=tr.querySelector(`#er-name-${id}`).value.trim(); const note=tr.querySelector(`#er-note-${id}`).value.trim(); if (!name) return alert('Name fehlt'); r.name=name; r.note=note; DB.save(); fillSelects(); renderAdmin(); renderToday(); renderOverdue(); }); tr.querySelector('[data-cancel-room]').addEventListener('click',()=>{ renderAdmin(); }); }));
  // Acts (with filters)
  const atbody=$('#tblActs tbody'); 
  const afRoom = ($('#actFilterRoom')?.value)||'';
  const afDept = ($('#actFilterDept')?.value)||'';
  const afQ = ($('#actSearch')?.value||'').toLowerCase();
  const actsFiltered = DB.acts.filter(a=>{ if (afRoom && a.roomId!==afRoom) return false; if (afDept && a.department!==afDept) return false; const hay=`${a.title} ${a.desc||''}`.toLowerCase(); if (afQ && !hay.includes(afQ)) return false; return true; });
  atbody.innerHTML = actsFiltered.map(a=>{ 
    const r=DB.rooms.find(x=>x.id===a.roomId);
    const d=departments.items.find(x=>x.id===a.department);
    return `<tr id="act-${a.id}">
        <td>${r?escapeHTML(r.name):'—'}</td>
        <td>${d?escapeHTML(d.name):'—'}</td>
        <td>${escapeHTML(a.title)}</td>
        <td>${escapeHTML(describeSched(a.sched))}</td>
        <td>${escapeHTML(a.sched.start)}</td>
        <td>
            <span class="link" data-edit-act="${a.id}">Bearbeiten</span> | 
            <span class="dangerlink" data-del-act="${a.id}">löschen</span>
        </td>
    </tr>`; 
}).join('') || `<tr><td colspan="6" class="muted">Keine Tätigkeiten.</td></tr>`;
  atbody.querySelectorAll('[data-del-act]').forEach(el=> el.addEventListener('click',()=>{ const id=el.getAttribute('data-del-act'); const a=DB.acts.find(x=>x.id===id); if (!confirm(`Tätigkeit "${a?a.title:''}" wirklich löschen?`)) return; DB.logs=DB.logs.filter(l=>l.activityId!==id); DB.acts=DB.acts.filter(a=>a.id!==id); DB.save(); renderAdmin(); renderToday(); renderOverdue(); }));
  atbody.querySelectorAll('[data-edit-act]').forEach(el=> el.addEventListener('click',()=>{ 
    const id=el.getAttribute('data-edit-act'); 
    const a=DB.acts.find(x=>x.id===id); 
    if (!a) return; 
    const tr=$(`#act-${id}`); 
    const roomOpts = DB.rooms.map(r=>
        `<option value="${r.id}" ${r.id===a.roomId?'selected':''}>${escapeHTML(r.name)}</option>`
    ).join('');
    const deptOpts = departments.items.map(d=>
        `<option value="${d.id}" ${d.id===a.department?'selected':''}>${escapeHTML(d.name)}</option>`
    ).join('');
    const t=a.sched.type; 
    const disp=(want)=> (want? 'inline-block':'none'); 
    tr.innerHTML = `
    <td colspan="6">
        <div class="grid cols-2">
            <div class="form-group">
                <label>Raum</label>
                <select id="ea-room-${id}">${roomOpts}</select>
            </div>
            <div class="form-group">
                <label>Abteilung</label>
                <select id="ea-dept-${id}">${deptOpts}</select>
            </div>
        </div>
        
        <div class="grid cols-2">
            <div class="form-group">
                <label>Bezeichnung</label>
                <input id="ea-title-${id}" value="${escapeHTML(a.title)}"/>
            </div>
            <div class="form-group">
                <label>Beschreibung</label>
                <input id="ea-desc-${id}" value="${escapeHTML(a.desc||'')}"/>
            </div>
        </div>

        <div class="grid cols-3">
            <div class="form-group">
                <label>Intervall</label>
                <select id="ea-type-${id}">
                    <option value="daily" ${t==='daily'?'selected':''}>täglich</option>
                    <option value="weekly" ${t==='weekly'?'selected':''}>wöchentlich</option>
                    <option value="monthly" ${t==='monthly'?'selected':''}>monatlich</option>
                    <option value="quarterly" ${t==='quarterly'?'selected':''}>quartalsweise</option>
                    <option value="yearly" ${t==='yearly'?'selected':''}>jährlich</option>
                </select>
            </div>
            <div class="form-group">
                <label>Alle</label>
                <input id="ea-every-${id}" type="number" min="1" value="${a.sched.every||1}"/>
            </div>
            <div class="form-group">
                <label>Start</label>
                <input id="ea-start-${id}" type="date" value="${escapeHTML(a.sched.start)}"/>
            </div>
        </div>

        <div class="grid cols-3">
            <div class="form-group ea-weekly-${id}" style="display:${disp(t==='weekly')}">
                <label>Wochentag</label>
                <select id="ea-wd-${id}">
                    <option value="1" ${(a.sched.weekday||1)==1?'selected':''}>Montag</option>
                    <option value="2" ${(a.sched.weekday||1)==2?'selected':''}>Dienstag</option>
                    <option value="3" ${(a.sched.weekday||1)==3?'selected':''}>Mittwoch</option>
                    <option value="4" ${(a.sched.weekday||1)==4?'selected':''}>Donnerstag</option>
                    <option value="5" ${(a.sched.weekday||1)==5?'selected':''}>Freitag</option>
                    <option value="6" ${(a.sched.weekday||1)==6?'selected':''}>Samstag</option>
                    <option value="7" ${(a.sched.weekday||1)==7?'selected':''}>Sonntag</option>
                </select>
            </div>
            <div class="form-group ea-monthday-${id}" style="display:${disp(t==='monthly'||t==='quarterly'||t==='yearly')}">
                <label>Tag im Monat</label>
                <input id="ea-md-${id}" type="number" min="1" max="31" value="${a.sched.monthDay||parse(a.sched.start).getDate()}"/>
            </div>
            <div class="form-group ea-yearmonth-${id}" style="display:${disp(t==='yearly')}">
                <label>Monat</label>
                <input id="ea-ym-${id}" type="number" min="1" max="12" value="${a.sched.yearMonth||parse(a.sched.start).getMonth()+1}"/>
            </div>
        </div>

        <div class="bar">
            <button data-save-act="${id}">Speichern</button>
            <button class="ghost" data-cancel-act="${id}">Abbrechen</button>
        </div>
    </td>
`;

    const toggle=()=>{ 
        const cur=tr.querySelector(`#ea-type-${id}`).value; 
        tr.querySelector(`.ea-weekly-${id}`).style.display = (cur==='weekly')?'inline-block':'none'; 
        tr.querySelector(`.ea-monthday-${id}`).style.display = (cur==='monthly'||cur==='quarterly'||cur==='yearly')?'inline-block':'none'; 
        tr.querySelector(`.ea-yearmonth-${id}`).style.display = (cur==='yearly')?'inline-block':'none'; 
    }; 

    tr.querySelector(`#ea-type-${id}`).addEventListener('change', toggle); 
    toggle(); 

    tr.querySelector('[data-save-act]').addEventListener('click',()=>{ 
        const roomId=tr.querySelector(`#ea-room-${id}`).value;
        const department=tr.querySelector(`#ea-dept-${id}`).value;
        const title=tr.querySelector(`#ea-title-${id}`).value.trim();
        const desc=tr.querySelector(`#ea-desc-${id}`).value.trim();
        const type=tr.querySelector(`#ea-type-${id}`).value;
        const every=Math.max(1, parseInt(tr.querySelector(`#ea-every-${id}`).value||'1',10));
        const start=tr.querySelector(`#ea-start-${id}`).value || a.sched.start;
        
        if (!roomId||!title||!department) {
            alert('Raum, Bezeichnung & Abteilung sind erforderlich');
            return;
        }
        
        const sched={type, every, start};
        if (type==='weekly'){ 
            sched.weekday=parseInt(tr.querySelector(`#ea-wd-${id}`).value||'1',10);
        }
        if (type==='monthly'||type==='quarterly'||type==='yearly'){
            sched.monthDay=parseInt(tr.querySelector(`#ea-md-${id}`).value||'1',10);
        }
        if (type==='yearly'){
            sched.yearMonth=parseInt(tr.querySelector(`#ea-ym-${id}`).value||'1',10);
        }
        
        a.roomId=roomId;
        a.department=department;
        a.title=title;
        a.desc=desc;
        a.sched=sched;
        
        DB.save();
        renderAdmin();
        renderToday();
        renderOverdue();
    });
    
    tr.querySelector('[data-cancel-act]').addEventListener('click',()=>{ 
        renderAdmin();
    });
}));
  // Users
  const utbody=$('#tblUsers tbody');
  const uRole = ($('#userRoleFilter')?.value)||''; const uQ = ($('#userSearch')?.value||'').toLowerCase();
  const users = DB.users.filter(u=>{ if (uRole && u.role!==uRole) return false; return !uQ || (u.name||'').toLowerCase().includes(uQ); });
  utbody.innerHTML = users.map(u=>`<tr id="user-${u.id}"><td>${u.name}</td><td><select data-role="${u.id}"><option value=\"user\" ${u.role==='user'?'selected':''}>User</option><option value=\"admin\" ${u.role==='admin'?'selected':''}>Admin</option><option value=\"pruefer\" ${u.role==='pruefer'?'selected':''}>Pruefer</option></select></td><td><span class=\"link\" data-set-pass="${u.id}">Passwort</span> | <span class=\"dangerlink\" data-del-user="${u.id}">löschen</span></td></tr>`).join('') || `<tr><td colspan=\"3\" class=\"muted\">Keine Benutzer.</td></tr>`;
  utbody.querySelectorAll('[data-role]').forEach(el=> el.addEventListener('change',()=>{ const id=el.getAttribute('data-role'); const u=DB.users.find(x=>x.id===id); if (u){ u.role=el.value; DB.save(); if (state.userId===id){ state.role=u.role; applyAuthUI(); } }}));
  utbody.querySelectorAll('[data-del-user]').forEach(el=> el.addEventListener('click',()=>{ const id=el.getAttribute('data-del-user'); const u=DB.users.find(x=>x.id===id); if (!confirm(`Benutzer "${u?u.name:''}" wirklich löschen?`)) return; DB.users=DB.users.filter(u=>u.id!==id); DB.save(); refreshLoginUsers(); renderAdmin(); }));
  utbody.querySelectorAll('[data-set-pass]').forEach(el=> el.addEventListener('click', async ()=>{ const id=el.getAttribute('data-set-pass'); const u=DB.users.find(x=>x.id===id); if (!u) return; const pw=prompt('Neues Passwort für "'+u.name+'" eingeben:'); if (pw==null||!pw.trim()) return; await setPassword(u, pw.trim()); DB.save(); alert('Passwort gespeichert.'); }));
}

// ===== Events & Init =====
function init(){
  DB.load();
  $('#appDate').value = fmt(state.date);
  fillSelects(); refreshLoginUsers();
  // Login UI
  $('#btnEye').addEventListener('click', (e)=>{ e.preventDefault(); const p=$('#loginPass'); p.type = p.type==='password'?'text':'password'; });
  const setQuick=(role)=>{ const u=DB.users.find(x=>x.role===role); if (u) $('#loginUser').value = u.name; };
  $('#btnQuickAdmin').addEventListener('click', (e)=>{ e.preventDefault(); setQuick('admin'); });
  $('#btnQuickPruefer').addEventListener('click', (e)=>{ e.preventDefault(); setQuick('pruefer'); });
  $('#btnQuickUser').addEventListener('click', (e)=>{ e.preventDefault(); setQuick('user'); });
  $('#btnDemo').addEventListener('click', (e)=>{ e.preventDefault(); const u=DB.users.find(x=>x.role==='admin')||DB.users[0]; state.userId=u.id; state.role=u.role; DB.save(); saveSession(true); applyAuthUI(); renderToday(); renderOverdue(); renderLogs(); applyView(); });
  $('#btnOpenLogin').addEventListener('click', ()=>{ $('#auth').style.display='flex'; $('#loginUser').focus(); });
  $('#btnLogout').addEventListener('click', ()=>{ clearSession(); state.userId=null; state.role=null; applyAuthUI(); });
  $('#btnLogin').addEventListener('click', async ()=>{
    const name=$('#loginUser').value.trim(); const pw=$('#loginPass').value; const remember=$('#remember').checked; const msg=$('#loginMsg'); msg.textContent='';
    const u=DB.users.find(x=>x.name.toLowerCase()===name.toLowerCase()) || DB.users.find(x=>x.role===name.toLowerCase());
    if (!u){ msg.textContent='Benutzer nicht gefunden.'; return; }
    if (!u.hash && pw==='test'){ /* bootstrap demo */ }
    const ok = await verify(u, pw);
    if (!ok){ msg.textContent='Falsches Passwort.'; return; }
    state.userId=u.id; state.role=u.role; saveSession(remember); applyAuthUI(); renderToday(); renderOverdue(); renderLogs(); applyView();
  });
  $('#loginUser').addEventListener('keydown', (e)=>{ if (e.key==='Enter') $('#btnLogin').click(); });
  $('#loginPass').addEventListener('keydown', (e)=>{ if (e.key==='Enter') $('#btnLogin').click(); });

  // Admin creation
  $('#btnAddRoom').addEventListener('click', ()=>{ if (state.role!=='admin') return alert('Nur Admin'); const name=$('#roomName').value.trim(); const note=$('#roomNote').value.trim(); if (!name) return alert('Name fehlt'); DB.rooms.push({id:uuid(), name, note}); DB.save(); $('#roomName').value=''; $('#roomNote').value=''; fillSelects(); renderAdmin(); });
  $('#btnAddAct').addEventListener('click', ()=>{ if (state.role!=='admin') return alert('Nur Admin'); const roomId=$('#actRoom').value; const title=$('#actTitle').value.trim(); const desc=$('#actDesc').value.trim(); const start=$('#actStart').value||fmt(today()); const type=$('#actType').value; const every=Math.max(1, parseInt($('#actEvery').value||'1',10)); if (!roomId||!title) return alert('Raum & Bezeichnung erforderlich'); const sched={type, every, start}; if (type==='weekly'){ sched.weekday=parseInt($('#actWeekday').value||'1',10); } if (type==='monthly'||type==='quarterly'||type==='yearly'){ sched.monthDay=parseInt($('#actMonthDay').value||'1',10); } if (type==='yearly'){ sched.yearMonth=parseInt($('#actYearMonth').value||'1',10); } DB.acts.push({id:uuid(), roomId, title, desc, sched}); DB.save(); $('#actTitle').value=''; $('#actDesc').value=''; renderAdmin(); renderToday(); renderOverdue(); });
  $('#btnAddUser').addEventListener('click', async ()=>{ if (state.role!=='admin') return alert('Nur Admin'); const name=$('#userName').value.trim(); const role=$('#userRole').value; const pass=$('#userPass').value; if (!name) return alert('Name fehlt'); const u={id:uuid(), name, role, hash:null}; DB.users.push(u); if (pass && HAS_SUBTLE){ await setPassword(u, pass); } DB.save(); $('#userName').value=''; $('#userPass').value=''; refreshLoginUsers(); renderAdmin(); });
  // Filters
  $('#appDate').addEventListener('change', ()=>{ state.date = parse($('#appDate').value); renderToday(); renderOverdue(); });
  $('#filterRoom').addEventListener('change', renderToday);
  $('#filterStatus').addEventListener('change', renderToday);
  $('#search').addEventListener('input', renderToday);
  $('#logRoom').addEventListener('change', renderLogs);
  $('#logSearch').addEventListener('input', renderLogs);
  const ackRoomEl = document.getElementById('ackRoom'); if (ackRoomEl) ackRoomEl.addEventListener('change', renderAcks);
  const ackSearchEl = document.getElementById('ackSearch'); if (ackSearchEl) ackSearchEl.addEventListener('input', renderAcks);
  // Toggle schedule creation fields
  const toggleCreateSched=()=>{ const t=$('#actType').value; $('#weeklyBox').style.display = (t==='weekly')?'block':'none'; const hasMD=(t==='monthly'||t==='quarterly'||t==='yearly'); $('#monthDayBox').style.display = hasMD?'block':'none'; $('#yearMonthBox').style.display = (t==='yearly')?'block':'none'; };
  $('#actType').addEventListener('change', toggleCreateSched); toggleCreateSched();
  // Admin filters
  const rs=$('#roomSearch'); if (rs) rs.addEventListener('input', renderAdmin);
  const afr=$('#actFilterRoom'); if (afr) afr.addEventListener('change', renderAdmin);
  const afd=$('#actFilterDept'); if (afd) afd.addEventListener('change', renderAdmin);
  const as=$('#actSearch'); if (as) as.addEventListener('input', renderAdmin);
  const ur=$('#userRoleFilter'); if (ur) ur.addEventListener('change', renderAdmin);
  const us=$('#userSearch'); if (us) us.addEventListener('input', renderAdmin);
  const ds=$('#deptSearch'); if (ds) ds.addEventListener('input', renderAdmin);
  if (ds) ds.addEventListener('input', ()=>{
    const q = ds.value.toLowerCase();
    const rows = document.querySelectorAll('#tblDepts tbody tr');
    rows.forEach(tr=>{ const t=(tr.textContent||'').toLowerCase(); tr.style.display = (!q || t.includes(q))? '' : 'none'; });
  });

  // Session restore
  const sess = loadSession(); if (sess){ const u=DB.users.find(x=>x.id===sess.uid); if (u){ state.userId=u.id; state.role=u.role; } }
  // Bottom nav
  const nav = document.getElementById('bottomNav');
  if (nav){
    nav.querySelectorAll('.tab').forEach(btn=> btn.addEventListener('click', ()=>{
      state.view = btn.getAttribute('data-tab');
      applyView();
    }));
  }
  // Sheet events
  const sheetClose = document.getElementById('sheetClose'); if (sheetClose) sheetClose.addEventListener('click', closeSheet);
  const sheetPrimary = document.getElementById('sheetPrimary'); if (sheetPrimary) sheetPrimary.addEventListener('click', saveSheetComment);
  const sheetSecondary = document.getElementById('sheetSecondary'); if (sheetSecondary) sheetSecondary.addEventListener('click', quitFromSheet);

  applyAuthUI(); renderAdmin(); renderToday(); renderOverdue(); renderLogs(); renderAcks(); applyView();
  setupCardDragAndDrop(); restoreCardOrder(); attachResizers();
  setupMainWindows();
  setupAdminWindows(); setupAdminDragAndDrop(); restoreAdminOrder();
  setupAnalytics(); renderAnalytics();
}

document.addEventListener('DOMContentLoaded', init);

// ===== Comments =====
function getComment(activityId, dueDate) {
    return DB.comments.find(c => 
        c.activityId === activityId && 
        c.dueDate === dueDate
    )?.text || '';
}

function toggleComment(event, activityId, dueDate) {
    event.stopPropagation();
    const row = document.getElementById(`comment-row-${activityId}`);
    if (row) {
        const isVisible = row.style.display === 'table-row';
        row.style.display = isVisible ? 'none' : 'table-row';
        if (!isVisible) {
            const textarea = document.getElementById(`comment-${activityId}`);
            if (textarea) textarea.focus();
        }
    }
}

function saveComment(activityId, dueDate) {
    const commentText = document.getElementById(`comment-${activityId}`).value.trim();
    if (!commentText) return;
    
    const comment = {
        id: uuid(),
        activityId,
        dueDate,
        text: commentText,
        userId: state.userId,
        createdAt: new Date().toISOString()
    };
    
    DB.comments.push(comment);
    DB.save();
    
    // Formular zurücksetzen und neu rendern
    document.getElementById(`comment-${activityId}`).value = '';
    renderToday();
}

function showComment(activityId, dueDate, title) {
    selectedActivityId = activityId;
    selectedActivityDate = dueDate;
    
    const comment = getComment(activityId, dueDate);
    $('#selectedActivity').textContent = title;
    $('#globalComment').value = comment;
    $('#commentSection').style.display = 'block';
    
    // Prüfen ob Tätigkeit erledigt ist
    const isDone = DB.logs.some(l => 
        l.activityId === activityId && 
        l.dueDate === dueDate
    );
    
    $('#globalComment').disabled = isDone;
    $('#globalComment').focus();
}

function closeCommentSection() {
    $('#commentSection').style.display = 'none';
    selectedActivityId = null;
    selectedActivityDate = null;
}

function saveGlobalComment() {
    if (!selectedActivityId || !selectedActivityDate) return;
    
    const commentText = $('#globalComment').value.trim();
    let comment = DB.comments.find(c => 
        c.activityId === selectedActivityId && 
        c.dueDate === selectedActivityDate
    );
    
    if (comment) {
        comment.text = commentText;
        comment.updatedAt = new Date().toISOString();
    } else {
        comment = {
            id: uuid(),
            activityId: selectedActivityId,
            dueDate: selectedActivityDate,
            text: commentText,
            userId: state.userId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        DB.comments.push(comment);
    }
    
    DB.save();
    closeCommentSection();
    renderToday(); // Aktualisiert die Ansicht mit dem neuen Kommentar-Icon
}

// ===== Mobile sheet for comments & actions =====
let SHEET_CTX = { context:null, activityId:null, dueDate:null };
function openSheet(context, activityId, dueDate, wantQuit){
  SHEET_CTX = { context, activityId, dueDate };
  const act = DB.acts.find(a=>a.id===activityId);
  const room = act? DB.rooms.find(r=>r.id===act.roomId) : null;
  const title = (act?act.title:'') + (room? ' – '+room.name : '');
  document.getElementById('sheetTitle').textContent = title;
  document.getElementById('sheetMeta').textContent = `Fälligkeit: ${dueDate}`;
  const history = renderCommentHistoryChrono(activityId, dueDate);
  document.getElementById('sheetHistory').innerHTML = history;
  document.getElementById('sheetTextarea').value = '';
  const sec = document.getElementById('sheetSecondary');
  if (sec){
    const isOverdue = (context==='overdue');
    sec.style.display = isOverdue ? '' : 'none';
    sec.disabled = (state.role!=='pruefer');
  }
  document.getElementById('sheet').classList.remove('hidden');
}
function closeSheet(){ document.getElementById('sheet').classList.add('hidden'); }
function saveSheetComment(){
  if (!SHEET_CTX.activityId) return;
  const txt = document.getElementById('sheetTextarea').value.trim();
  if (!txt) { closeSheet(); return; }
  DB.comments.push({ id:uuid(), activityId:SHEET_CTX.activityId, dueDate:SHEET_CTX.dueDate, text:txt, userId:state.userId, createdAt:new Date().toISOString() });
  DB.save();
  renderToday(); renderOverdue();
  openSheet(SHEET_CTX.context, SHEET_CTX.activityId, SHEET_CTX.dueDate); // refresh history
}
function quitFromSheet(){
  if (!SHEET_CTX.activityId) return;
  const txt = document.getElementById('sheetTextarea').value.trim();
  if (txt){ DB.comments.push({ id:uuid(), activityId:SHEET_CTX.activityId, dueDate:SHEET_CTX.dueDate, text:txt, userId:state.userId, createdAt:new Date().toISOString() }); }
  DB.save();
  quitOverdue(SHEET_CTX.activityId, SHEET_CTX.dueDate);
  closeSheet();
}

// View switcher (mobile)
function applyView(){
  const isMobile = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
  const cards = document.querySelectorAll('[data-view]');
  cards.forEach(el=>{
    if (!isMobile){
      // Desktop: respektiere Admin-Visibility
      if (el.id==='admin' && state.role!=='admin') { el.style.display='none'; }
      else { el.style.display = ''; }
      return;
    }
    el.style.display = (el.getAttribute('data-view')===state.view || el.id==='admin'&&state.view==='admin') ? '' : 'none';
  });
  // Update bottom nav active state
  const nav = document.getElementById('bottomNav'); if (nav){
    nav.querySelectorAll('.tab').forEach(btn=> btn.classList.toggle('active', btn.getAttribute('data-tab')===state.view));
  }
  // Render card lists for current views
  renderTodayCards(); renderOverdueCards(); renderLogsCards(); renderAcksCards();
}

// ===== Analytics (Dashboard) =====
function setupAnalytics(){
  const d = fmt(today());
  const anaDate = document.getElementById('anaDate'); if (anaDate) anaDate.value = d;
  const anaWeek = document.getElementById('anaWeek'); if (anaWeek){ const t=new Date(); const y=t.getFullYear(); const oneJan=new Date(y,0,1); const week=Math.ceil((((t-oneJan)/86400000)+oneJan.getDay()+1)/7); const isoWeek=`${y}-W${pad(week)}`; anaWeek.value = isoWeek; }
  const anaMonth = document.getElementById('anaMonth'); if (anaMonth){ const t=new Date(); anaMonth.value = `${t.getFullYear()}-${pad(t.getMonth()+1)}`; }
  const tabs = document.querySelectorAll('#anaTabs .tab');
  tabs.forEach(btn=> btn.addEventListener('click', ()=>{
    tabs.forEach(b=> b.classList.remove('active')); btn.classList.add('active');
    const which = btn.getAttribute('data-ana');
    document.querySelectorAll('.ana-panel').forEach(p=> p.style.display = (p.getAttribute('data-ana-panel')===which)? '' : 'none');
    renderAnalytics();
  }));
  if (anaDate) anaDate.addEventListener('change', renderAnalytics);
  if (anaWeek) anaWeek.addEventListener('change', renderAnalytics);
  if (anaMonth) anaMonth.addEventListener('change', renderAnalytics);
  // dataset filter chips per panel
  state.analytics = state.analytics || { daily:'default', weekly:'default', monthly:'default' };
  document.querySelectorAll('.dash-filter').forEach(bar=>{
    bar.addEventListener('click', (e)=>{
      const btn = e.target.closest('.chip'); if (!btn) return;
      bar.querySelectorAll('.chip').forEach(c=> c.classList.remove('active'));
      btn.classList.add('active');
      const panel = bar.getAttribute('data-ana-filter');
      const mode = btn.getAttribute('data-mode');
      state.analytics[panel] = mode;
      renderAnalytics();
    });
  });
}

function startOfWeek(d){ const x=new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x; }
function endOfWeek(d){ const s=startOfWeek(d); const e=new Date(s); e.setDate(s.getDate()+6); return e; }
function parseWeek(weekStr){ // yyyy-Www
  const [y,w] = weekStr.split('-W'); const firstThu = new Date(Number(y),0,1); while(firstThu.getDay()!==4){ firstThu.setDate(firstThu.getDate()+1); } const d=new Date(firstThu); d.setDate(firstThu.getDate() + (Number(w)-1)*7 -3); return startOfWeek(d); }

function countDaily(date){
  const dueActs = DB.acts.filter(a=> isDue(a, date));
  const due = dueActs.length;
  const dateStr = fmt(date);
  const logs = DB.logs.filter(l=> l.dueDate===dateStr);
  const done = logs.length;
  const comments = DB.comments.filter(c=> c.dueDate===dateStr).length;
  const overdue = Math.max(0, due - done);
  const acks = (DB.acks||[]).filter(a=> a.dueDate===dateStr).length;
  return {due, done, overdue, comments, acks, rate: due? Math.round(done*100/due): 0, examples: dueActs.slice(0,8)};
}

function sumRange(from, to){
  let d=new Date(from); const res={due:0, done:0, overdue:0, comments:0, acks:0};
  while(d<=to){ const r=countDaily(d); res.due+=r.due; res.done+=r.done; res.overdue+=r.overdue; res.comments+=r.comments; res.acks+=r.acks; d.setDate(d.getDate()+1); }
  res.rate = res.due? Math.round(res.done*100/res.due):0; return res;
}

function renderAnalytics(){
  // Daily
  const dailyHost=document.getElementById('kpiDaily'); if (dailyHost){ const d=parse(document.getElementById('anaDate').value||fmt(today())); const r=countDaily(d); dailyHost.innerHTML = kpiHtml(r); bindKpiClicks('daily', dailyHost); const mode=(state.analytics?.daily)||'default'; highlightKpi('daily', dailyHost, mode); if (mode==='default') renderExamples('tblDailyTop', r.examples, fmt(d)); else renderAnaList('tblDailyTop', mode, d, d); }
  // Weekly
  const wkHost=document.getElementById('kpiWeekly'); const wkIn=document.getElementById('anaWeek');
  if (wkHost && wkIn && wkIn.value){ const start=parseWeek(wkIn.value); const end=endOfWeek(start); const r=sumRange(start,end); wkHost.innerHTML = kpiHtml(r); bindKpiClicks('weekly', wkHost); const mode=(state.analytics?.weekly)||'default'; highlightKpi('weekly', wkHost, mode); if (mode==='default') renderExamplesRange('tblWeeklyTop', start, end); else renderAnaList('tblWeeklyTop', mode, start, end); }
  // Monthly
  const moHost=document.getElementById('kpiMonthly'); const moIn=document.getElementById('anaMonth');
  if (moHost && moIn && moIn.value){ const [y,m]=moIn.value.split('-').map(n=>parseInt(n,10)); const start=new Date(y,m-1,1); start.setHours(0,0,0,0); const end=new Date(y,m,0); const r=sumRange(start,end); moHost.innerHTML = kpiHtml(r); bindKpiClicks('monthly', moHost); const mode=(state.analytics?.monthly)||'default'; highlightKpi('monthly', moHost, mode); if (mode==='default') renderExamplesRange('tblMonthlyTop', start, end); else renderAnaList('tblMonthlyTop', mode, start, end); }
  updateAnalyticsTabFiltered();
  // Attach toggles to show comments on click
  attachAnaToggle('tblDailyTop', {dateFrom:'#anaDate'});
  attachAnaToggle('tblWeeklyTop', {});
  attachAnaToggle('tblMonthlyTop', {});
}

function attachAnaToggle(tableId, opts){
  const table = document.getElementById(tableId); if (!table) return;
  const tbody = table.querySelector('tbody'); if (!tbody) return;
  // Clear previous delegated handler
  tbody.onclick = (ev)=>{
    const tr = ev.target.closest('tr'); if (!tr || tr.classList.contains('comment-row')) return;
    // If this row already has a comment-row sibling, toggle
    let next = tr.nextElementSibling;
    const cells = tr.children;
    // Determine room, title, date
    let room = cells[0]?.textContent?.trim()||'';
    let title = cells[1]?.textContent?.trim()||'';
    let due = cells[2]?.textContent?.trim()||'';
    if (!due && opts?.dateFrom){ const inp=document.querySelector(opts.dateFrom); if (inp && inp.value) due = inp.value; }
    // Find activity
    const r = DB.rooms.find(rr=> (rr.name||'').toLowerCase()===room.toLowerCase());
    const a = DB.acts.find(ax=> (ax.title||'')===title && (!r || ax.roomId===r.id));
    const actId = a?.id;
    if (!actId || !due){ return; }
    const cid = `ana-cmt-${actId}-${due}`;
    if (!next || next.id!==cid){
      // Insert detail row
      const trDetail = document.createElement('tr'); trDetail.id=cid; trDetail.className='comment-row';
      const td = document.createElement('td'); td.colSpan = table.querySelectorAll('thead th').length; td.innerHTML = renderCommentHistoryChrono(actId, due) || '<div class="muted">Keine Kommentare.</div>';
      trDetail.appendChild(td); tr.after(trDetail); next = trDetail;
    }
    next.style.display = (next.style.display==='table-row')? 'none' : 'table-row';
  };
}

function renderAnaList(tableId, mode, fromDate, toDate){
  const tbody = document.querySelector(`#${tableId} tbody`); const thead = document.querySelector(`#${tableId} thead`); if (!tbody || !thead) return;
  // header unified
  thead.innerHTML = `<tr><th>Raum</th><th>Tätigkeit</th><th>Datum</th><th>Typ</th></tr>`;
  const from = new Date(fromDate); const to = new Date(toDate); from.setHours(0,0,0,0); to.setHours(0,0,0,0);
  const items=[];
  // due/open
  let d=new Date(from);
  while(d<=to){ const ds=fmt(d); DB.acts.forEach(a=>{ if (isDue(a,d)){ const r=DB.rooms.find(x=>x.id===a.roomId); const done = DB.logs.some(l=> l.activityId===a.id && l.dueDate===ds); if (mode==='due') items.push({room:r?.name||'—', title:a.title, date:ds, type:'Fällig'}); if (mode==='open' && !done) items.push({room:r?.name||'—', title:a.title, date:ds, type:'Offen'}); } }); d.setDate(d.getDate()+1); }
  // done
  if (mode==='done'){ DB.logs.forEach(l=>{ const dt=parse(l.dueDate); if (dt>=from && dt<=to){ const a=DB.acts.find(x=>x.id===l.activityId); const r=DB.rooms.find(x=>x.id===a?.roomId); items.push({room:r?.name||'—', title:a?.title||'—', date:l.dueDate, type:'Erledigt'}); } }); }
  // comments
  if (mode==='comments'){ DB.comments.forEach(c=>{ const dt=parse(c.dueDate); if (dt>=from && dt<=to){ const a=DB.acts.find(x=>x.id===c.activityId); const r=DB.rooms.find(x=>x.id===a?.roomId); items.push({room:r?.name||'—', title:a?.title||'—', date:c.dueDate, type:'Kommentar'}); } }); }
  // acks
  if (mode==='acks'){ (DB.acks||[]).forEach(a=>{ const dt=parse(a.dueDate); if (dt>=from && dt<=to){ const act=DB.acts.find(x=>x.id===a.activityId); const r=DB.rooms.find(x=>x.id===act?.roomId); items.push({room:r?.name||'—', title:act?.title||'—', date:a.dueDate, type:'Quittiert'}); } }); }
  const rows = items.map(it=> `<tr><td>${escapeHTML(it.room)}</td><td>${escapeHTML(it.title)}</td><td>${escapeHTML(it.date)}</td><td>${escapeHTML(it.type)}</td></tr>`).join('') || `<tr><td colspan="4" class="muted">Keine Daten.</td></tr>`;
  tbody.innerHTML = rows;
}

function kpiHtml(r){
  return [
    {t:'Fällige Aufgaben', v:r.due},
    {t:'Erledigt', v:r.done},
    {t:'Offen', v:r.overdue},
    {t:'Erledigungsrate', v:r.rate+'%'},
    {t:'Kommentare', v:r.comments},
    {t:'Quittierungen', v:r.acks}
  ].map(k=>`<div class="kpi"><div class="kv">${k.v}</div><div class="kt">${k.t}</div></div>`).join('');
}

function renderExamples(tableId, acts, dueStr){
  const tbody = document.querySelector(`#${tableId} tbody`); if (!tbody) return;
  const rows = acts.map(a=>{ const r=DB.rooms.find(x=>x.id===a.roomId); const done = DB.logs.some(l=> l.activityId===a.id && l.dueDate===dueStr); return `<tr><td>${escapeHTML(r?r.name:'—')}</td><td>${escapeHTML(a.title)}</td><td>${done?'<span class="status-done">Erledigt</span>':'<span class="status-open">Offen</span>'}</td></tr>`; }).join('') || `<tr><td colspan="3" class="muted">Keine Beispiele.</td></tr>`;
  tbody.innerHTML = rows;
}
function renderExamplesRange(tableId, from, to){
  const tbody = document.querySelector(`#${tableId} tbody`); if (!tbody) return;
  const coll = [];
  DB.acts.forEach(a=>{ let dueCnt=0, doneCnt=0; let d=new Date(from); while(d<=to){ if (isDue(a,d)){ dueCnt++; const ds=fmt(d); if (DB.logs.some(l=> l.activityId===a.id && l.dueDate===ds)) doneCnt++; } d.setDate(d.getDate()+1); } if (dueCnt>0) coll.push({a, dueCnt, doneCnt}); });
  coll.sort((x,y)=> (y.dueCnt-y.doneCnt) - (x.dueCnt-x.doneCnt));
  const rows = coll.slice(0,10).map(x=>{ const r=DB.rooms.find(rr=>rr.id===x.a.roomId); return `<tr><td>${escapeHTML(r?r.name:'—')}</td><td>${escapeHTML(x.a.title)}</td><td>${x.doneCnt}/${x.dueCnt}</td></tr>`; }).join('') || `<tr><td colspan="3" class="muted">Keine Daten.</td></tr>`;
  tbody.innerHTML = rows;
}

// ========= Dashboard: KPI-Kacheln als Filter =========
function bindKpiClicks(panel, host){
  const tiles = host.querySelectorAll('.kpi'); if (!tiles.length) return;
  const apply=(mode)=>{ state.analytics = state.analytics || {}; state.analytics[panel]=mode; renderAnalytics(); };
  // Reihenfolge aus kpiHtml(): [due, done, open, rate, comments, acks]
  tiles[0]?.addEventListener('click', ()=> apply('due'));
  tiles[1]?.addEventListener('click', ()=> apply('done'));
  tiles[2]?.addEventListener('click', ()=> apply('open'));
  tiles[3]?.addEventListener('click', ()=> apply('default'));
  tiles[4]?.addEventListener('click', ()=> apply('comments'));
  tiles[5]?.addEventListener('click', ()=> apply('acks'));
}

function highlightKpi(panel, host, mode){
  const tiles = host.querySelectorAll('.kpi'); tiles.forEach(t=> t.classList.remove('active'));
  const idx = {default:-1, due:0, done:1, open:2, comments:4, acks:5}[mode] ?? -1;
  if (idx>=0 && tiles[idx]) tiles[idx].classList.add('active');
}

function updateAnalyticsTabFiltered(){
  document.querySelectorAll('#anaTabs .tab').forEach(btn=>{
    const key=btn.getAttribute('data-ana'); const mode=(state.analytics?.[key])||'default';
    btn.classList.toggle('filtered', mode!=='default');
  });
}

// Override: sicheres Neu-Rendering mit KPI-Filter-Logik
function renderAnalytics2(){
  const dailyHost=document.getElementById('kpiDaily');
  if (dailyHost){
    const d=parse(document.getElementById('anaDate').value||fmt(today()));
    const r=countDaily(d);
    dailyHost.innerHTML = kpiHtml(r);
    bindKpiClicks('daily', dailyHost);
    const mode=(state.analytics?.daily)||'default';
    highlightKpi('daily', dailyHost, mode);
    if (mode==='default') renderExamples('tblDailyTop', r.examples, fmt(d));
    else renderAnaList('tblDailyTop', mode, d, d);
  }
  const wkHost=document.getElementById('kpiWeekly'); const wkIn=document.getElementById('anaWeek');
  if (wkHost && wkIn && wkIn.value){
    const start=parseWeek(wkIn.value); const end=endOfWeek(start); const r=sumRange(start,end);
    wkHost.innerHTML = kpiHtml(r);
    bindKpiClicks('weekly', wkHost);
    const mode=(state.analytics?.weekly)||'default';
    highlightKpi('weekly', wkHost, mode);
    if (mode==='default') renderExamplesRange('tblWeeklyTop', start, end);
    else renderAnaList('tblWeeklyTop', mode, start, end);
  }
  const moHost=document.getElementById('kpiMonthly'); const moIn=document.getElementById('anaMonth');
  if (moHost && moIn && moIn.value){
    const [y,m]=moIn.value.split('-').map(n=>parseInt(n,10)); const start=new Date(y,m-1,1); start.setHours(0,0,0,0); const end=new Date(y,m,0);
    const r=sumRange(start,end);
    moHost.innerHTML = kpiHtml(r);
    bindKpiClicks('monthly', moHost);
    const mode=(state.analytics?.monthly)||'default';
    highlightKpi('monthly', moHost, mode);
    if (mode==='default') renderExamplesRange('tblMonthlyTop', start, end);
    else renderAnaList('tblMonthlyTop', mode, start, end);
  }
  updateAnalyticsTabFiltered();
  attachAnaToggle('tblDailyTop', {dateFrom:'#anaDate'});
  attachAnaToggle('tblWeeklyTop', {});
  attachAnaToggle('tblMonthlyTop', {});
}

// Neu zuweisen (überschreibt eine ältere Implementierung sicher)
renderAnalytics = renderAnalytics2;

// ===== Drag & Drop ordering of cards =====
function setupCardDragAndDrop(){
  const grid = document.getElementById('mainGrid'); if (!grid) return;
  let dragging = null;
  grid.querySelectorAll('.card[data-card]').forEach(card=>{
    card.addEventListener('dragstart', (e)=>{
      dragging = card; card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', ()=>{ if (dragging){ dragging.classList.remove('dragging'); dragging=null; saveCardOrder(); clearDropStates(grid); }});
  });
  grid.addEventListener('dragover', (e)=>{
    e.preventDefault();
    const afterEl = getDragAfterElement(grid, e.clientY);
    clearDropStates(grid);
    if (afterEl==null){ grid.appendChild(dragging); }
    else { grid.insertBefore(dragging, afterEl); afterEl.classList.add('drop-above'); }
  });
  grid.addEventListener('drop', (e)=>{ e.preventDefault(); saveCardOrder(); clearDropStates(grid); });
}

function getDragAfterElement(container, y){
  const els = [...container.querySelectorAll('.card[data-card]:not(.dragging)')];
  return els.reduce((closest, child)=>{
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height/2;
    if (offset < 0 && offset > closest.offset){ return {offset, element: child}; }
    else { return closest; }
  }, {offset: Number.NEGATIVE_INFINITY, element: null}).element;
}

function clearDropStates(container){ container.querySelectorAll('.drop-above,.drop-below,.drop-target').forEach(el=> el.classList.remove('drop-above','drop-below','drop-target')); }

function saveCardOrder(){
  const grid = document.getElementById('mainGrid'); if (!grid) return;
  const order = [...grid.querySelectorAll('.card[data-card]')].map(el=> el.getAttribute('data-card'));
  localStorage.setItem('roomlog-v2-card-order', JSON.stringify(order));
}

function restoreCardOrder(){
  const grid = document.getElementById('mainGrid'); if (!grid) return;
  let order = [];
  try{ order = JSON.parse(localStorage.getItem('roomlog-v2-card-order')||'[]'); }catch{}
  if (!order || !order.length) return;
  order.forEach(id=>{
    const el = grid.querySelector(`.card[data-card="${id}"]`);
    if (el) grid.appendChild(el);
  });
}

// ===== Admin sub-windows: collapse + reorder =====
function adminWinKey(key){ return `roomlog-v2-admin-${key}-${state.userId||'anon'}`; }
function setupAdminWindows(){
  const grid = document.getElementById('adminGrid'); if (!grid) return;
  let collapsed={}; try{ collapsed=JSON.parse(localStorage.getItem(adminWinKey('collapsed'))||'{}'); }catch{}
  grid.querySelectorAll('.card[data-admin-card]').forEach(card=>{
    const id = card.getAttribute('data-admin-card');
    const h = card.querySelector('.section-title'); if (!h) return;
    if (!h.querySelector('.win-actions')){
      const actions = document.createElement('div'); actions.className='win-actions';
      const grab = document.createElement('span'); grab.className='grab'; grab.textContent='⠿';
      const btnOpen = document.createElement('button'); btnOpen.className='win-btn open'; btnOpen.title='Aufklappen'; btnOpen.textContent='+';
      const btnClose = document.createElement('button'); btnClose.className='win-btn close'; btnClose.title='Zuklappen'; btnClose.textContent='×';
      actions.appendChild(grab); actions.appendChild(btnOpen); actions.appendChild(btnClose); h.appendChild(actions);
      const applyState=()=>{ const isColl = !!collapsed[id]; card.classList.toggle('collapsed', isColl); btnOpen.style.display = isColl? 'inline-flex':'none'; btnClose.style.display = isColl? 'none':'inline-flex'; };
      btnClose.addEventListener('click', ()=>{ collapsed[id]=true; localStorage.setItem(adminWinKey('collapsed'), JSON.stringify(collapsed)); applyState(); });
      btnOpen.addEventListener('click', ()=>{ delete collapsed[id]; localStorage.setItem(adminWinKey('collapsed'), JSON.stringify(collapsed)); applyState(); });
      applyState();
    }
  });
}

function setupAdminDragAndDrop(){
  const grid = document.getElementById('adminGrid'); if (!grid) return;
  let dragging=null;
  grid.querySelectorAll('.card[data-admin-card]').forEach(card=>{
    card.setAttribute('draggable','true');
    card.addEventListener('dragstart', (e)=>{ dragging=card; card.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; });
    card.addEventListener('dragend', ()=>{ if (dragging){ dragging.classList.remove('dragging'); dragging=null; saveAdminOrder(); }});
  });
  grid.addEventListener('dragover', (e)=>{ e.preventDefault(); const after = getDragAfterElement(grid, e.clientY); if (!dragging) return; if (after==null) grid.appendChild(dragging); else grid.insertBefore(dragging, after); });
  grid.addEventListener('drop', (e)=>{ e.preventDefault(); saveAdminOrder(); });
}

function saveAdminOrder(){
  const grid = document.getElementById('adminGrid'); if (!grid) return;
  const order = [...grid.querySelectorAll('.card[data-admin-card]')].map(el=> el.getAttribute('data-admin-card'));
  localStorage.setItem(adminWinKey('order'), JSON.stringify(order));
}

function restoreAdminOrder(){
  const grid = document.getElementById('adminGrid'); if (!grid) return;
  let order=[]; try{ order=JSON.parse(localStorage.getItem(adminWinKey('order'))||'[]'); }catch{}
  if (!order || !order.length) return;
  order.forEach(id=>{ const el = grid.querySelector(`.card[data-admin-card="${id}"]`); if (el) grid.appendChild(el); });
}

function winCollapsedKey(scope){ return `roomlog-v2-win-collapsed-${scope}-${state.userId||'anon'}`; }
function setupMainWindows(){
  const grid = document.getElementById('mainGrid'); if (!grid) return;
  let collapsed={}; try{ collapsed=JSON.parse(localStorage.getItem(winCollapsedKey('main'))||'{}'); }catch{}
  grid.querySelectorAll('.card[data-card]').forEach(card=>{
    const id = card.getAttribute('data-card');
    const h = card.querySelector('.section-title'); if (!h) return;
    if (!h.querySelector('.win-actions')){
      const actions = document.createElement('div'); actions.className='win-actions';
      const grab = document.createElement('span'); grab.className='grab'; grab.textContent='⠿';
      const btnOpen = document.createElement('button'); btnOpen.className='win-btn open'; btnOpen.title='Aufklappen'; btnOpen.textContent='+';
      const btnClose = document.createElement('button'); btnClose.className='win-btn close'; btnClose.title='Zuklappen'; btnClose.textContent='×';
      actions.appendChild(grab); actions.appendChild(btnOpen); actions.appendChild(btnClose); h.appendChild(actions);
      const applyState=()=>{ const isColl = !!collapsed[id]; card.classList.toggle('collapsed', isColl); btnOpen.style.display = isColl? 'inline-flex':'none'; btnClose.style.display = isColl? 'none':'inline-flex'; };
      btnClose.addEventListener('click', ()=>{ collapsed[id]=true; localStorage.setItem(winCollapsedKey('main'), JSON.stringify(collapsed)); applyState(); });
      btnOpen.addEventListener('click', ()=>{ delete collapsed[id]; localStorage.setItem(winCollapsedKey('main'), JSON.stringify(collapsed)); applyState(); });
      applyState();
    }
  });
}

// ===== Mobile card renderers for Logs and Acks =====
function renderLogsCards(){
  const host = document.getElementById('cardsLogs'); if (!host) return;
  const rf=$('#logRoom').value||''; const q=($('#logSearch').value||'').toLowerCase();
  const slice = DB.logs.slice(0,200).filter(l=>{ const a=DB.acts.find(x=>x.id===l.activityId); if (!a) return false; if (rf && a.roomId!==rf) return false; const r=DB.rooms.find(x=>x.id===a.roomId); const hay=`${a.title} ${r?r.name:''} ${l.dueDate}`.toLowerCase(); if (q && !hay.includes(q)) return false; return true; });
  const cards = slice.map(l=>{
    const a=DB.acts.find(x=>x.id===l.activityId); const r=DB.rooms.find(x=>x.id===a.roomId); const dt=new Date(l.ts);
    const when=`${fmt(dt)} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`; const u=DB.users.find(x=>x.id===l.userId)?.name||'—';
    return `<div class="task-card"><div class="task-head"><div class="task-title">${escapeHTML(a?a.title:'—')}</div><span class="status-done">Erledigt</span></div><div class="task-sub">${escapeHTML(r?r.name:'—')} • ${escapeHTML(l.dueDate)} • ${escapeHTML(u)} • ${escapeHTML(when)}</div></div>`;
  }).join('');
  host.innerHTML = cards || `<div class="muted">Keine Protokolle.</div>`;
}

function renderAcksCards(){
  const host = document.getElementById('cardsAcks'); if (!host) return;
  const rfEl = document.getElementById('ackRoom'); const qEl = document.getElementById('ackSearch');
  const rf = rfEl? (rfEl.value||'') : ''; const q = (qEl? qEl.value : '').toLowerCase();
  const items = (DB.acks||[]).slice(0,200).filter(a=>{ const act=DB.acts.find(x=>x.id===a.activityId); if (!act) return false; if (rf && act.roomId!==rf) return false; const room=DB.rooms.find(x=>x.id===act.roomId); const hay = `${act.title} ${room?room.name:''} ${a.dueDate} ${a.note||''}`.toLowerCase(); if (q && !hay.includes(q)) return false; return true; }).sort((a,b)=> new Date(b.ts)-new Date(a.ts));
  const cards = items.map(a=>{
    const act = DB.acts.find(x=>x.id===a.activityId); const room = act? DB.rooms.find(r=>r.id===act.roomId):null;
    const dt=new Date(a.ts); const when=`${fmt(dt)} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    const pruefer = DB.users.find(u=>u.id===a.userId)?.name || '—'; const typ = a.type==='abw'?'ABW':'OK';
    const details = a.type==='abw' ? `ABW${a.abwNo?(' #'+a.abwNo):''}${a.note?': '+escapeHTML(a.note):''}` : (a.note? escapeHTML(a.note) : '—');
    const info = `Geprüft von ${escapeHTML(pruefer)} am ${when}`;
    const comments = renderCommentHistoryChrono(a.activityId, a.dueDate);
    const cid = `ack-card-comments-${a.activityId}-${a.dueDate}`;
    return `<div class="task-card"><div class="task-head"><div class="task-title">${escapeHTML(act?act.title:'—')}</div><span class="comment-indicator" onclick="toggleAckCardComments('${a.activityId}','${a.dueDate}')"></span><span class="status-open">${escapeHTML(typ)}</span></div><div class="task-sub">${escapeHTML(room?room.name:'—')} • ${escapeHTML(a.dueDate)}</div><div class="ack-info">${info}</div><div id="${cid}" class="comment-section" style="display:none;">${comments}${details?`<div class=\"muted\" style=\"margin-top:6px;\"><small>${details}</small></div>`:''}</div></div>`;
  }).join('');
  host.innerHTML = cards || `<div class="muted">Keine Quittierungen vorhanden.</div>`;
}

function toggleAckCardComments(activityId, dueDate){
  const el = document.getElementById(`ack-card-comments-${activityId}-${dueDate}`);
  if (!el) return; const vis = el.style.display !== 'none'; el.style.display = vis ? 'none' : 'block';
}

function toggleOverdueComment(event, activityId, dueDate) {
    event.stopPropagation();
    const row = document.getElementById(`overdue-comment-row-${activityId}`);
    if (row) {
        const isVisible = row.style.display === 'table-row';
        row.style.display = isVisible ? 'none' : 'table-row';
        if (!isVisible) {
            const textarea = document.getElementById(`overdue-comment-${activityId}`);
            if (textarea) textarea.focus();
        }
    }
}

function saveOverdueComment(activityId, dueDate) {
    const commentText = document.getElementById(`overdue-comment-${activityId}`).value.trim();
    if (!commentText) return;
    
    const comment = {
        id: uuid(),
        activityId,
        dueDate,
        text: commentText,
        userId: state.userId,
        createdAt: new Date().toISOString()
    };
    
    DB.comments.push(comment);
    DB.save();
    
    document.getElementById(`overdue-comment-${activityId}`).value = '';
    renderOverdue();
}

function quitOverdue(activityId, dueDate) {
    if (state.role !== 'pruefer') {
        alert('Nur Prüfer darf quittieren.');
        return;
    }

    // Optional: aktuellen Text als Kommentar übernehmen
    const ta = document.getElementById(`overdue-comment-${activityId}`);
    const typed = ta ? ta.value.trim() : '';
    if (typed) {
        DB.comments.push({ id: uuid(), activityId, dueDate, text: typed, userId: state.userId, createdAt: new Date().toISOString() });
    }

    const commentsForItem = DB.comments.filter(c => c.activityId === activityId && c.dueDate === dueDate);
    if (!commentsForItem.length) {
        alert('Quittieren nur mit mindestens einem Kommentar möglich.');
        return;
    }

    if (!DB.acks) DB.acks = [];
    if (DB.acks.some(a => a.activityId === activityId && a.dueDate === dueDate)) {
        alert('Bereits quittiert.');
        return;
    }

    const lastComment = commentsForItem[commentsForItem.length - 1];
    const ack = { id: uuid(), activityId, dueDate, type: 'ok', note: lastComment?.text || '', userId: state.userId, ts: new Date().toISOString() };
    DB.acks.push(ack);
    DB.save();

    if (ta) ta.value = '';
    renderOverdue();
    renderAcks();
}

// ===== Overrides: Mobile cards for Logs/Acks with comments =====
renderLogsCards = function(){
  const host = document.getElementById('cardsLogs'); if (!host) return;
  const rfEl=document.getElementById('logRoom'); const qEl=document.getElementById('logSearch');
  const rf = rfEl? (rfEl.value||'') : ''; const q = (qEl? qEl.value : '').toLowerCase();
  const slice = DB.logs.slice(0,200).filter(l=>{ const a=DB.acts.find(x=>x.id===l.activityId); if (!a) return false; if (rf && a.roomId!==rf) return false; const r=DB.rooms.find(x=>x.id===a.roomId); const hay=`${a.title} ${r?r.name:''} ${l.dueDate}`.toLowerCase(); if (q && !hay.includes(q)) return false; return true; });
  const cards = slice.map(l=>{ const a=DB.acts.find(x=>x.id===l.activityId); const r=DB.rooms.find(x=>x.id===a.roomId); const dt=new Date(l.ts); const when=`${fmt(dt)} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`; const u=DB.users.find(x=>x.id===l.userId)?.name||'—'; const comments = renderCommentHistoryChrono(l.activityId, l.dueDate); return `<div class="task-card"><div class="task-head"><div class="task-title">${escapeHTML(a?a.title:'—')}</div><span class="status-done">Erledigt</span></div><div class="task-sub">${escapeHTML(r?r.name:'—')} • ${escapeHTML(l.dueDate)} • ${escapeHTML(u)} • ${escapeHTML(when)}</div>${comments}</div>`; }).join('');
  host.innerHTML = cards || `<div class="muted">Keine Protokolle.</div>`;
};

renderAcksCards = function(){
  const host = document.getElementById('cardsAcks'); if (!host) return;
  const rfEl = document.getElementById('ackRoom'); const qEl = document.getElementById('ackSearch');
  const rf = rfEl? (rfEl.value||'') : ''; const q=(qEl? qEl.value : '').toLowerCase();
  const items = (DB.acks||[]).slice(0,200).filter(a=>{ const act=DB.acts.find(x=>x.id===a.activityId); if (!act) return false; if (rf && act.roomId!==rf) return false; const room=DB.rooms.find(x=>x.id===act.roomId); const hay = `${act.title} ${room?room.name:''} ${a.dueDate} ${a.note||''}`.toLowerCase(); if (q && !hay.includes(q)) return false; return true; }).sort((a,b)=> new Date(b.ts)-new Date(a.ts));
  const cards = items.map(a=>{ const act=DB.acts.find(x=>x.id===a.activityId); const room=act?DB.rooms.find(r=>r.id===act.roomId):null; const dt=new Date(a.ts); const when=`${fmt(dt)} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`; const pruefer = DB.users.find(u=>u.id===a.userId)?.name || '—'; const typ = a.type==='abw'?'ABW':'OK'; const details = a.type==='abw' ? `ABW${a.abwNo?(' #'+a.abwNo):''}${a.note?': '+escapeHTML(a.note):''}` : (a.note? escapeHTML(a.note) : '—'); const info = `Geprüft von ${escapeHTML(pruefer)} am ${when}`; const comments = renderCommentHistoryChrono(a.activityId, a.dueDate); return `<div class="task-card"><div class="task-head"><div class="task-title">${escapeHTML(act?act.title:'—')}</div><span class="status-open">${escapeHTML(typ)}</span></div><div class="task-sub">${escapeHTML(room?room.name:'—')} • ${escapeHTML(a.dueDate)}</div><div class="ack-info">${info}</div>${comments}${details?`<div class="muted" style="margin-top:6px;"><small>${details}</small></div>`:''}</div>`; }).join('');
  host.innerHTML = cards || `<div class="muted">Keine Quittierungen vorhanden.</div>`;
};

// ===== Per-user card widths =====
function keyWidths(){ return `roomlog-v2-card-widths-${state.userId||'anon'}`; }
function applyCardWidths(){ const grid=document.getElementById('mainGrid'); if(!grid) return; let map={}; try{ map=JSON.parse(localStorage.getItem(keyWidths())||'{}'); }catch{} grid.querySelectorAll('.card[data-card]').forEach(el=>{ const id=el.getAttribute('data-card'); const basis=map[id]; if (basis) el.style.setProperty('--card-basis', basis); }); }
function saveCardWidth(id, basis){ if (!id) return; let map={}; try{ map=JSON.parse(localStorage.getItem(keyWidths())||'{}'); }catch{} map[id]=basis; localStorage.setItem(keyWidths(), JSON.stringify(map)); }
function attachResizers(){ const grid=document.getElementById('mainGrid'); if(!grid) return; grid.querySelectorAll('.card[data-card]').forEach(card=>{ if (card.querySelector('.resize-handle')) return; const h=document.createElement('div'); h.className='resize-handle'; card.appendChild(h); let startX=0; let startW=0; const id=card.getAttribute('data-card'); const onMove=(e)=>{ const contW=grid.getBoundingClientRect().width; const clientX=(e.touches&&e.touches[0]?e.touches[0].clientX:e.clientX); const dx=clientX - startX; let newW=Math.max(280, startW + dx); const basis=Math.min(100, Math.max(30, (newW/contW)*100)); card.style.setProperty('--card-basis', basis.toFixed(1)+'%'); }; const onUp=()=>{ document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onUp); const basis=getComputedStyle(card).getPropertyValue('--card-basis').trim()||'100%'; saveCardWidth(id, basis); }; const onDown=(e)=>{ if (window.matchMedia('(max-width: 640px)').matches) return; startX=(e.touches&&e.touches[0]?e.touches[0].clientX:e.clientX); const contW=grid.getBoundingClientRect().width; const cur=getComputedStyle(card).getPropertyValue('--card-basis').trim(); startW=(parseFloat(cur)||100)/100*contW; e.preventDefault(); document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); document.addEventListener('touchmove', onMove, {passive:false}); document.addEventListener('touchend', onUp); }; h.addEventListener('mousedown', onDown, {passive:false}); h.addEventListener('touchstart', onDown, {passive:false}); }); applyCardWidths(); }

// Klick-Logik für KPI-Kacheln
function bindKpiClicks(panel, host){
  const tiles = host.querySelectorAll('.kpi'); if (!tiles.length) return;
  const apply=(mode)=>{ state.analytics = state.analytics || {}; state.analytics[panel]=mode; renderAnalytics(); };
  tiles[0]?.addEventListener('click', ()=> apply('due'));
  tiles[1]?.addEventListener('click', ()=> apply('done'));
  tiles[2]?.addEventListener('click', ()=> apply('open'));
  tiles[3]?.addEventListener('click', ()=> apply('default'));
  tiles[4]?.addEventListener('click', ()=> apply('comments'));
  tiles[5]?.addEventListener('click', ()=> apply('acks'));
}

function highlightKpi(panel, host, mode){
  const tiles = host.querySelectorAll('.kpi'); tiles.forEach(t=> t.classList.remove('active'));
  const idx = {default:-1, due:0, done:1, open:2, comments:4, acks:5}[mode] ?? -1;
  if (idx>=0 && tiles[idx]) tiles[idx].classList.add('active');
}

function updateAnalyticsTabFiltered(){
  document.querySelectorAll('#anaTabs .tab').forEach(btn=>{
    const key=btn.getAttribute('data-ana'); const mode=(state.analytics?.[key])||'default';
    btn.classList.toggle('filtered', mode!=='default');
  });
}
