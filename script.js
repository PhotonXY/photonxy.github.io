/*
 * KAIZEN-Pizza-Day – Vollstaendige App-Logik mit Google Sheets Integration
 * - Admin-Uebersicht aus Google Sheet (Auto-Reload + JSONP-Fallback)
 * - Alphabetisch sortierte Pizzas
 * - Getraenke gruppiert & alphabetisch sortiert
 * - Toast nach Absenden, E-Mail-Buttons
 */

/* =========================================================================
   0) Google Sheets Anbindung
   ========================================================================= */
const GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbweTzSBND_MFpBHQru0KG1RAn5xElqvjMCbfvfSHwjwE0_JT2Er5DCoEt_tT5TxIXAX/exec';

const SECRET_LS_KEY = 'PizzaBestellung';
let GOOGLE_SHARED_SECRET_RUNTIME = '';

function getQueryParam(name){ const p=new URLSearchParams(window.location.search); return p.get(name); }
function setSharedSecret(secret){ GOOGLE_SHARED_SECRET_RUNTIME=(secret||'').trim(); try{localStorage.setItem(SECRET_LS_KEY,GOOGLE_SHARED_SECRET_RUNTIME);}catch{} }
function ensureSharedSecret({forcePrompt=false}={}){
  const fromUrl=getQueryParam('secret');
  if(fromUrl && !forcePrompt){ setSharedSecret(fromUrl); return GOOGLE_SHARED_SECRET_RUNTIME; }
  if(!forcePrompt){
    const fromStore=localStorage.getItem(SECRET_LS_KEY);
    if(fromStore){ GOOGLE_SHARED_SECRET_RUNTIME=fromStore; return GOOGLE_SHARED_SECRET_RUNTIME; }
  }
  const typed=window.prompt('Bitte Web-App Secret eingeben:', GOOGLE_SHARED_SECRET_RUNTIME||'');
  if(typed!==null) setSharedSecret(typed);
  return GOOGLE_SHARED_SECRET_RUNTIME;
}
function getSharedSecret(){ if(!GOOGLE_SHARED_SECRET_RUNTIME) ensureSharedSecret(); return GOOGLE_SHARED_SECRET_RUNTIME; }

/* =========================================================================
   1) Stammdaten
   ========================================================================= */
const pizzaMenu = [
  { id:'calzone', name:'Calzone', prices:{'30cm':22}},
  { id:'fior_di_margherita', name:'Fior di Margherita', prices:{'24cm':16,'30cm':19,'40cm':31}},
  { id:'frutti_di_mare', name:'Frutti di mare', prices:{'24cm':19,'30cm':22,'40cm':36}},
  { id:'funghi', name:'Funghi', prices:{'24cm':18,'30cm':21,'40cm':34}},
  { id:'giardino', name:'Giardino', prices:{'24cm':19,'30cm':22,'40cm':36}},
  { id:'gorgonzola', name:'Gorgonzola', prices:{'24cm':18,'30cm':21,'40cm':34}},
  { id:'hawaii', name:'Hawaii', prices:{'24cm':19,'30cm':22,'40cm':36}},
  { id:'kickiricki', name:'Kickiricki', prices:{'24cm':19,'30cm':22,'40cm':36}},
  { id:'margherita', name:'Margherita', prices:{'24cm':14.50,'30cm':17,'40cm':27.50}},
  { id:'napoli', name:'Napoli', prices:{'24cm':17,'30cm':20,'40cm':33}},
  { id:'occhio_di_bue', name:'Occhio di Bue Speciale', prices:{'24cm':19,'30cm':22,'40cm':36}},
  { id:'ortolana', name:'Ortolana', prices:{'24cm':19,'30cm':22,'40cm':36}},
  { id:'padrone', name:'Padrone', prices:{'24cm':20,'30cm':23,'40cm':38}},
  { id:'piccante', name:'Piccante', prices:{'24cm':19,'30cm':22,'40cm':36}},
  { id:'porcini', name:'Porcini', prices:{'24cm':19,'30cm':22,'40cm':36}},
  { id:'prosciutto', name:'Prosciutto', prices:{'24cm':19,'30cm':22,'40cm':36}},
  { id:'prosciutto_funghi', name:'Prosciutto e funghi', prices:{'24cm':19,'30cm':22,'40cm':36}},
  { id:'quattro_formaggi', name:'Quattro formaggi', prices:{'24cm':20,'30cm':23,'40cm':38}},
  { id:'quattro_stagioni', name:'Quattro stagioni', prices:{'24cm':19,'30cm':22,'40cm':36}},
  { id:'rucola', name:'Rucola', prices:{'24cm':18,'30cm':21,'40cm':34}},
  { id:'rustica', name:'Rustica', prices:{'24cm':19,'30cm':22,'40cm':36}},
  { id:'salame', name:'Salame', prices:{'24cm':19,'30cm':22,'40cm':36}},
  { id:'salsiccia_bianca', name:'Salsiccia Bianca', prices:{'24cm':19,'30cm':22,'40cm':36}},
  { id:'stromboli', name:'Stromboli', prices:{'24cm':16,'30cm':19,'40cm':31}},
  { id:'tonno', name:'Tonno', prices:{'24cm':19,'30cm':22,'40cm':36}},
  { id:'trenta', name:'Trenta', prices:{'24cm':19,'30cm':22,'40cm':36}},
  { id:'verde', name:'Verde', prices:{'24cm':18,'30cm':21,'40cm':34}},
  // vegan
  { id:'funghi_vegan', name:'Funghi vegan', prices:{'24cm':19.50,'30cm':22,'40cm':34.50}},
  { id:'giardino_vegan', name:'Giardino vegan', prices:{'24cm':20.50,'30cm':23,'40cm':36.50}},
  { id:'margherita_vegan', name:'Margherita vegan', prices:{'24cm':16,'30cm':18,'40cm':28}},
  { id:'ortolana_vegan', name:'Ortolana vegan', prices:{'24cm':20.50,'30cm':23,'40cm':36.50}},
  { id:'porcini_vegan', name:'Porcini vegan', prices:{'24cm':20.50,'30cm':23,'40cm':36.50}},
  { id:'stromboli_vegan', name:'Stromboli vegan', prices:{'24cm':17.50,'30cm':20,'40cm':31.50}},
  // Salate
  { id:'insalata_verde', name:'Insalata Verde', prices:{'24cm':6,'30cm':6}},
  { id:'insalata_mista', name:'Insalata Mista', prices:{'24cm':8,'30cm':8}},
  { id:'pomodoro_e_cipolla', name:'Pomodoro e cipolla', prices:{'24cm':9,'30cm':9}},
  { id:'insalata_caprese', name:'Insalata Caprese', prices:{'24cm':10,'30cm':10}},
  { id:'insalata_rucola', name:'Insalata Rucola', prices:{'24cm':10,'30cm':10}},
  { id:'nuesslisalat', name:'Nuesslisalat', prices:{'24cm':10,'30cm':10}},
  { id:'insalata_dieci', name:'Dieci Salad', prices:{'24cm':16,'30cm':16}},
  { id:'insalata_pollo', name:'Insalata Pollo', prices:{'24cm':16,'30cm':16}},
];

const saladIds = [
  'insalata_verde','insalata_mista','pomodoro_e_cipolla','insalata_caprese',
  'insalata_rucola','nuesslisalat','insalata_dieci','insalata_pollo'
];

// Zutaten-Liste: wird nur zur Anzeige im Dropdown verwendet (Bestellung speichert nur den Namen)
const ingredientsById = {
  // Pizzen
  margherita: 'Tomatensauce, Mozzarella (Italien), Oregano BIO',
  fior_di_margherita: 'Tomatensauce, Mozzarella fior di latte (Italien), Basilikum, Olivenöl extra vergine, Grana Padano DOP (Italien), Oregano BIO',
  stromboli: 'Tomatensauce, Mozzarella (Italien), Peperoncini, Oliven, Oregano BIO',
  napoli: 'Tomatensauce, Mozzarella (Italien), Sardellen MSC (Marokko), Kapern, Oregano BIO',
  funghi: 'Tomatensauce, Mozzarella (Italien), Champignons, Oregano BIO',
  gorgonzola: 'Tomatensauce, Mozzarella (Italien), Gorgonzola DOP (Italien), Oregano BIO',
  rucola: 'Tomatensauce, Mozzarella (Italien), Rucola, Grana Padano DOP, Cherrytomaten, Oregano BIO',
  verde: 'Tomatensauce, Mozzarella (Italien), Broccoli, Spinat, Grana Padano Splitter DOP, Oregano BIO',
  calzone: 'Tomatensauce, Mozzarella (Italien), Hinterschinken (Schweiz), Ei (Schweiz), Oregano',
  frutti_di_mare: 'Tomatensauce, Mozzarella (Italien), Meeresfrüchte (Spanien, Norwegen, Vietnam, China), Oregano BIO',
  giardino: 'Tomatensauce, Mozzarella (Italien), Artischocken, Champignons, Peperoni, Oliven, Oregano BIO',
  hawaii: 'Tomatensauce, Mozzarella (Italien), Hinterschinken (Schweiz), Ananas, Oregano BIO',
  kickiricki: 'Tomatensauce, Mozzarella (Italien), Curry-Pouletbrust (Schweiz), Oregano BIO',
  occhio_di_bue: 'Tomatensauce, Mozzarella (Italien), Ei (Schweiz), Speck (Schweiz), Spinat, Oregano BIO',
  ortolana: 'Tomatensauce, Mozzarella (Italien), Artischocken, Peperoni, Auberginen, Zucchetti, Oregano BIO',
  piccante: 'Tomatensauce, Mozzarella (Italien), scharfe Salami (Schweiz), Peperoncini, Oregano BIO',
  porcini: 'Tomatensauce, Mozzarella (Italien), Steinpilze, Zwiebeln, Knoblauch, Oregano BIO',
  prosciutto: 'Tomatensauce, Mozzarella (Italien), Hinterschinken (Schweiz), Oregano BIO',
  prosciutto_funghi: 'Tomatensauce, Mozzarella (Italien), Hinterschinken (Schweiz), Champignons, Oregano BIO',
  quattro_stagioni: 'Tomatensauce, Mozzarella (Italien), Hinterschinken (Schweiz), Artischocken, Champignons, Peperoni, Oregano BIO',
  rustica: 'Tomatensauce, Mozzarella (Italien), Hinterschinken (Schweiz), Speck (Schweiz), Zwiebeln, Knoblauch, Oregano BIO',
  salame: 'Tomatensauce, Mozzarella (Italien), Salami (Schweiz), Oregano BIO',
  salsiccia_bianca: 'Mozzarella (Italien), Salsiccia (Schweiz), Cime di Rapa, Peperoncini, Ricotta, Oregano BIO (ohne Tomatensauce)',
  tonno: 'Tomatensauce, Mozzarella (Italien), Thon MSC (Thailand), Kapern, Oregano BIO',
  trenta: 'Tomatensauce, Mozzarella (Italien), Cime di Rapa, Kartoffeln, Gorgonzola DOP (Italien), Grana Padano Splitter DOP, Oregano BIO',
  padrone: 'Tomatensauce, Mozzarella (Italien), Rindfleisch (Schweiz, Knoblauch-Marinade), Oliven, Oregano BIO',
  quattro_formaggi: 'Tomatensauce, Mozzarella (Italien), Grana Padano DOP, Gorgonzola DOP (Italien), Mascarpone, Oregano BIO',
  // Vegan-Varianten
  margherita_vegan: 'Tomatensauce, veganer Käse, Oregano BIO',
  stromboli_vegan: 'Tomatensauce, veganer Käse, Peperoncini, Oliven, Oregano BIO',
  funghi_vegan: 'Tomatensauce, veganer Käse, Champignons, Oregano BIO',
  giardino_vegan: 'Tomatensauce, veganer Käse, Artischocken, Champignons, Peperoni, Oliven, Oregano BIO',
  ortolana_vegan: 'Tomatensauce, veganer Käse, Artischocken, Peperoni, Auberginen, Zucchetti, Oregano BIO',
  porcini_vegan: 'Tomatensauce, veganer Käse, Steinpilze, Zwiebeln, Knoblauch, Oregano BIO',

  // Salate
  insalata_verde: 'Grüner Salat',
  insalata_mista: 'Gemischter Salat',
  pomodoro_e_cipolla: 'Cherrytomaten, Zwiebelringe, Oliven',
  insalata_caprese: 'Tomaten, Mozzarella, Basilikum',
  insalata_rucola: 'Grana Padano DOP, Cherrytomaten',
  nuesslisalat: 'Nüsslisalat, Ei (saisonal)',
  insalata_dieci: 'Gemischter Salat, Thon MSC, Mozzarelline, Cherrytomaten, Oliven',
  insalata_pollo: 'Gemischter Salat, Pouletbrust, Cherrytomaten',
};

const dressingMenu = [
  { id:'italian',  name:'Italienisches Dressing', price:0.5 },
  { id:'french',   name:'French Dressing',        price:0.5 },
  { id:'balsamico',name:'Balsamico Dressing',     price:0.5 }
];

const drinkMenu = [
  // Softdrinks & Eistee
  { id:'coca_cola',                name:'Coca Cola',                      price:4, group:'Softdrinks & Eistee' },
  { id:'coca_cola_zero',           name:'Coca Cola Zero',                 price:4, group:'Softdrinks & Eistee' },
  { id:'san_benedetto_pfirsich',   name:'San Benedetto Eistee Pfirsich',  price:4, group:'Softdrinks & Eistee' },
  { id:'san_benedetto_zitrone',    name:'San Benedetto Eistee Zitrone',   price:4, group:'Softdrinks & Eistee' },
  { id:'san_pellegrino_aranciata', name:'San Pellegrino Aranciata',       price:4, group:'Softdrinks & Eistee' },
  { id:'san_pellegrino_chinotto',  name:'San Pellegrino Chinotto',        price:4, group:'Softdrinks & Eistee' },
  { id:'san_pellegrino_limonata',  name:'San Pellegrino Limonata',        price:4, group:'Softdrinks & Eistee' },
  { id:'rivella_rot',              name:'Rivella Rot',                    price:4, group:'Softdrinks & Eistee' },
  { id:'moehl_shorley',            name:'Moehl Shorley',                  price:4, group:'Softdrinks & Eistee' },
  // Mineral
  { id:'acqua_panna',              name:'Acqua Panna',                    price:4, group:'Mineralwasser' },
  { id:'san_pellegrino',           name:'San Pellegrino',                 price:4, group:'Mineralwasser' },
  // Energy & Mate
  { id:'redbull',                  name:'RedBull',                        price:4, group:'Energy & Mate' },
  { id:'el_tony_mate',             name:'El Tony Mate',                   price:4, group:'Energy & Mate' }
];

const menuPizzaIds = [
  'calzone','frutti_di_mare','funghi','gamberetti','giardino','gorgonzola','hawaii','kickiricki',
  'margherita','napoli','occhio_di_bue','ortolana','padrone','piccante','porcini','prosciutto_funghi',
  'prosciutto','quattro_formaggi','quattro_stagioni','rucola','rustica','salame','salsiccia_bianca',
  'stromboli','tonno','verde','fior_di_margherita','trenta'
];

const MENU_PRICE_BASE = 23;
const GLUTENFREE_SURCHARGE = 1;

/* =========================================================================
   2) DOM-Refs
   ========================================================================= */
const $ = sel => document.querySelector(sel);

const pizzaSelect=$('#pizza-select'), saladSelect=$('#salad-select'), sizeSelect=$('#pizza-size');
const sizeGroup=$('#size-group'), pizzaSelectionDiv=$('#pizza-selection'), saladSelectionDiv=$('#salad-selection');
const dressingSelect=$('#dressing-select'), drinkSelect=$('#drink-select'), dressingSelectionDiv=$('#dressing-selection'), drinkSelectionDiv=$('#drink-selection');
const glutenFreeCheckbox=$('#gluten-free'), glutenFreeGroup=$('#gluten-free-group');
const toggleAdminBtn=$('#toggle-admin'), adminSection=$('#admin-section'), orderForm=$('#pizza-form'), ordersTableBody=$('#orders-table tbody');
const generateSummaryBtn=$('#generate-summary'), downloadCsvBtn=$('#download-csv'), summaryOutputSection=$('#summary-output'), summaryTextArea=$('#summary-text'), copySummaryBtn=$('#copy-summary');
const ordersSummaryDiv=$('#orders-summary'), displayDateSpan=$('#display-date'), displayTimeSpan=$('#display-time');

// Adminfelder
const deliveryAddressInput=$('#delivery-address'), ordererNameInput=$('#orderer-name'), ordererPhoneInput=$('#orderer-phone');
const supplierNameInput=$('#supplier-name'), supplierPhoneInput=$('#supplier-phone'), supplierEmailInput=$('#supplier-email');
const mapsApiKeyInput=$('#maps-api-key'), mapsZoomInput=$('#maps-zoom');
const deliveryMapWrap=$('#delivery-map'), deliveryMapFrame=$('#delivery-map-frame');
// Zutaten-UI (Pizza)
const pizzaIngredientsBox=$('#pizza-ingredients');
// Zutaten-UI (Salat)
const saladIngredientsBox=$('#salad-ingredients');
// Header / Texte
const headerImageElement=$('#header-image'), headerImageInput=$('#header-image-input'), resetHeaderImageBtn=$('#reset-header-image'), pageTitleElement=$('#page-title'), pageTitleInputField=$('#page-title-input'), pageDescriptionElement=$('#page-description'), pageDescriptionInputField=$('#page-description-input');
// Pixabay
const pixabayApiKeyInput=$('#pixabay-api-key'), pixabaySearchInput=$('#pixabay-search'), pixabaySearchBtn=$('#pixabay-search-btn'), pixabayResults=$('#pixabay-results');
// Datum/Uhrzeit/Deadline
const orderDateInput=$('#order-date'), orderTimeInput=$('#order-time');
const deadlineDateInput=$('#deadline-date'), deadlineTimeInput=$('#deadline-time'), deadlineDisplay=$('#deadline-display'), deadlineWarningDiv=$('#deadline-warning');

/* =========================================================================
   3) State & Helpers
   ========================================================================= */
const orders=[];
function saveOrdersToStorage(){ try{ localStorage.setItem('ordersData', JSON.stringify(orders)); }catch(e){} }
function loadOrdersFromStorage(){ try{ const raw=localStorage.getItem('ordersData'); if(raw){ const list=JSON.parse(raw); if(Array.isArray(list)) orders.splice(0,orders.length,...list); } }catch(e){} }

function updateSelectPlaceholderState(sel){
  if(!sel) return;
  const isPh = !sel.value || sel.selectedIndex===0 && sel.options[0]?.disabled;
  sel.classList.toggle('is-placeholder', !!isPh);
}

function showToast(msg='Deine Bestellung wurde übermittelt. Vielen Dank.', durationMs=4500){
  const el=document.getElementById('toast'); if(!el) return;
  el.textContent=msg; el.style.display='block'; el.style.opacity='1';
  setTimeout(()=>{ el.style.transition='opacity 400ms'; el.style.opacity='0'; setTimeout(()=>{ el.style.display='none'; el.style.transition=''; },450); }, durationMs);
}
function setBtnLoading(btn, loading=true, loadingLabel='Lade…'){
  if(!btn) return;
  if(loading){ if(!btn.dataset.orig){ btn.dataset.orig=btn.innerHTML; } btn.disabled=true; btn.innerHTML=`<span class="spinner" aria-hidden="true"></span>${loadingLabel}`; }
  else { btn.disabled=false; if(btn.dataset.orig){ btn.innerHTML=btn.dataset.orig; delete btn.dataset.orig; } }
}
async function searchPixabay(term){
  const btn=pixabaySearchBtn; const grid=pixabayResults; if(!grid) return;
  const key=(pixabayApiKeyInput?.value||'').trim(); if(!key){ alert('Bitte zuerst den Pixabay API Key eingeben.'); return; }
  const q=encodeURIComponent(String(term||'').trim()); if(!q){ alert('Bitte Suchbegriff eingeben.'); return; }
  try{
    setBtnLoading(btn,true,'Suche…');
    grid.innerHTML='';
    const url=`https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${q}&image_type=photo&orientation=horizontal&per_page=12&safesearch=true`;
    const res=await fetch(url);
    if(!res.ok){ throw new Error('Pixabay Anfrage fehlgeschlagen'); }
    const data=await res.json();
    const hits=Array.isArray(data?.hits)?data.hits:[];
    if(!hits.length){ grid.innerHTML='<p>Keine Treffer.</p>'; return; }
    hits.forEach(h=>{
      const div=document.createElement('div'); div.className='pixabay-item';
      div.innerHTML=`<img src="${h.webformatURL}" alt="${(h.tags||'').replace(/"/g,'')}"><span class="pixabay-item__credit">Pixabay</span>`;
      div.addEventListener('click',()=>{
        if(headerImageElement){ headerImageElement.src=h.largeImageURL||h.webformatURL; try{ localStorage.setItem('headerImage', h.largeImageURL||h.webformatURL); }catch(e){} }
        showToast('Header-Bild übernommen.');
      });
      grid.appendChild(div);
    });
  }catch(e){ console.warn(e); alert('Suche fehlgeschlagen. Bitte Key/Netzwerk prüfen.'); }
  finally{ setBtnLoading(btn,false); }
}
function renderRemoteSkeletonRows(n=6){
  const tbody=document.querySelector('#remote-orders-table tbody'); if(!tbody) return;
  tbody.innerHTML='';
  const cols=document.querySelectorAll('#remote-orders-table thead th').length||6;
  for(let i=0;i<n;i++){
    const tr=document.createElement('tr'); tr.className='skeleton-row';
    for(let c=0;c<cols;c++){ const td=document.createElement('td'); td.innerHTML='<span class="skeleton-box"></span>'; tr.appendChild(td); }
    tbody.appendChild(tr);
  }
}
function startRemoteLoading(){
  renderRemoteSkeletonRows();
  setBtnLoading(document.getElementById('load-remote-btn'), true, 'Lade…');
  setBtnLoading(document.getElementById('refresh-remote-summary'), true, 'Aktualisiere…');
}
function endRemoteLoading(){
  setBtnLoading(document.getElementById('load-remote-btn'), false);
  setBtnLoading(document.getElementById('refresh-remote-summary'), false);
}
function showUndoToast(msg, {undoLabel='Rückgängig', onUndo, onExpire, durationMs=7000}={}){
  const el=document.getElementById('toast'); if(!el) return;
  el.innerHTML = `${msg} <button id="toast-undo-btn" class="btn btn--secondary" style="margin-left:8px">${undoLabel}</button>`;
  el.style.display='block'; el.style.opacity='1';
  let done=false;
  const end=()=>{ if(done) return; done=true; el.style.transition='opacity 400ms'; el.style.opacity='0'; setTimeout(()=>{ el.style.display='none'; el.style.transition=''; el.innerHTML=''; },450); };
  const t = setTimeout(()=>{ try{ onExpire&&onExpire(); }finally{ end(); } }, durationMs);
  const btn=document.getElementById('toast-undo-btn');
  btn?.addEventListener('click',()=>{ clearTimeout(t); try{ onUndo&&onUndo(); }finally{ end(); } });
}
function autoResizeTextarea(el){
  if(!el) return;
  // Ensure width is handled via CSS; auto-fit height to content
  el.style.height='auto';
  el.style.overflowY='hidden';
  // Add small padding to avoid scrollbars flicker
  const newH = Math.min(el.scrollHeight + 2, 3000);
  el.style.height = newH + 'px';
}
function formatDateCH(s){ try{ if(!s) return ''; const parts=String(s).split('-'); if(parts.length===3){ const [y,m,d]=parts; if(y&&m&&d) return `${d}.${m}.${y}`; } return s; }catch(e){ return s; } }
function buildMapsLink(addr){ const a=(addr||'').trim(); if(!a) return ''; return `https://maps.google.com/?q=${encodeURIComponent(a)}`; }
function debounce(fn, wait=300){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(null,args), wait); } }

// Admin – Lieferadresse Karten-Vorschau (optional Static API)
function buildMapSrcFromAddress(addr){ const q=encodeURIComponent(String(addr||'')); return `https://www.google.com/maps?q=${q}&output=embed`; }
function isDarkTheme(){ try{ return document.documentElement.getAttribute('data-theme')==='dark'; }catch(e){ return false; } }
function buildStaticMapUrl(addr){
  const key=(mapsApiKeyInput?.value||'').trim(); if(!key) return '';
  const zoom=15;
  const q=encodeURIComponent(String(addr||''));
  let url=`https://maps.googleapis.com/maps/api/staticmap?center=${q}&zoom=${zoom}&size=640x300&scale=2&maptype=roadmap&markers=color:red|${q}&key=${encodeURIComponent(key)}`;
  if(isDarkTheme()){
    const styles=[
      'element:geometry|color:0x1f1f1f',
      'element:labels.text.stroke|color:0x1f1f1f',
      'element:labels.text.fill|color:0xb3b3b3',
      'feature:poi|element:geometry|color:0x2a2a2a',
      'feature:road|element:geometry|color:0x2a2a2a',
      'feature:road|element:labels.text.fill|color:0xb3b3b3',
      'feature:transit|element:geometry|color:0x2a2a2a',
      'feature:water|element:geometry|color:0x111111'
    ];
    url += styles.map(s=>`&style=${encodeURIComponent(s)}`).join('');
  }
  return url;
}
function updateDeliveryMap(){
  const addr=(deliveryAddressInput?.value||'').trim();
  if(!deliveryMapWrap) return;
  const img=document.getElementById('delivery-map-img');
  if(addr.length<4){ deliveryMapWrap.style.display='none'; deliveryMapWrap.setAttribute('aria-hidden','true'); deliveryMapFrame?.removeAttribute('src'); if(img){img.style.display='none'; img.removeAttribute('src');} return; }
  deliveryMapWrap.style.display='block'; deliveryMapWrap.setAttribute('aria-hidden','false');
  const staticUrl=buildStaticMapUrl(addr);
  if(staticUrl && img){ img.style.display='block'; img.setAttribute('src', staticUrl); if(deliveryMapFrame){ deliveryMapFrame.style.display='none'; deliveryMapFrame.removeAttribute('src'); } }
  else{ if(img){ img.style.display='none'; img.removeAttribute('src'); } if(deliveryMapFrame){ deliveryMapFrame.style.display='block'; const nextSrc=buildMapSrcFromAddress(addr); if(deliveryMapFrame.getAttribute('data-src')!==nextSrc){ deliveryMapFrame.setAttribute('src', nextSrc); deliveryMapFrame.setAttribute('data-src', nextSrc); } } }
}
function debounce(fn, wait=300){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(null,args), wait); } }

// Admin – Lieferadresse Karten-Vorschau (ohne API-Key)
function buildMapSrcFromAddress(addr){ const q=encodeURIComponent(String(addr||'')); return `https://www.google.com/maps?q=${q}&output=embed&hl=de`; }
function updateDeliveryMap(){
  const addr=(deliveryAddressInput?.value||'').trim();
  if(!deliveryMapWrap) return;
  const img=document.getElementById('delivery-map-img');
  if(addr.length<4){
    deliveryMapWrap.style.display='none'; deliveryMapWrap.setAttribute('aria-hidden','true');
    if(deliveryMapFrame){ deliveryMapFrame.removeAttribute('src'); deliveryMapFrame.removeAttribute('data-src'); }
    if(img){ img.style.display='none'; img.removeAttribute('src'); }
    return;
  }
  deliveryMapWrap.style.display='block'; deliveryMapWrap.setAttribute('aria-hidden','false');
  const staticUrl=buildStaticMapUrl(addr);
  if(staticUrl && img){
    img.style.display='block'; img.setAttribute('src', staticUrl);
    if(deliveryMapFrame){ deliveryMapFrame.style.display='none'; deliveryMapFrame.removeAttribute('src'); deliveryMapFrame.removeAttribute('data-src'); }
  } else if(deliveryMapFrame){
    if(img){ img.style.display='none'; img.removeAttribute('src'); }
    deliveryMapFrame.style.display='block';
    const nextSrc=buildMapSrcFromAddress(addr);
    if(deliveryMapFrame.getAttribute('data-src')!==nextSrc){ deliveryMapFrame.setAttribute('src', nextSrc); deliveryMapFrame.setAttribute('data-src', nextSrc); }
  }
}
function printContent(title, text){
  const content = String(text||'');
  if(!content.trim()){ alert('Kein Inhalt zum Drucken.'); return; }
  const win = window.open('', '_blank', 'width=900,height=1000');
  if(!win){ alert('Popup blockiert. Bitte Popups erlauben.'); return; }
  const safeTitle = String(title||'Bestellübersicht');
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${safeTitle}</title>
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Arial,sans-serif;line-height:1.4;padding:24px;}
      h1{font-size:18px;margin:0 0 12px}
      pre{white-space:pre-wrap;word-wrap:break-word;border:1px solid #ddd;border-radius:10px;padding:12px;background:#fff}
      @media print{button{display:none}}
    </style></head><body>
    <h1>${safeTitle}</h1>
    <pre>${content.replace(/[&<>]/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[m]))}</pre>
    <button onclick="window.print()">Drucken</button>
  </body></html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
}
function normalizeSwissPhone(input){ const d=(input||'').replace(/\D+/g,''); if(d.length===10) return `${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6,8)} ${d.slice(8,10)}`; return input; }

/* =========================================================================
   4) Deadline
   ========================================================================= */
function updateDateTimeDisplay(){ if(displayDateSpan) displayDateSpan.textContent=formatDateCH(orderDateInput?.value||'')||'–'; if(displayTimeSpan) displayTimeSpan.textContent=orderTimeInput?.value||'–'; }
function saveOrderDateTimeToStorage(){ try{ localStorage.setItem('orderDate', orderDateInput?.value||''); localStorage.setItem('orderTime', orderTimeInput?.value||''); updateDateTimeDisplay(); }catch(e){} }
function loadOrderDateTimeFromStorage(){ try{ const d=localStorage.getItem('orderDate'); const t=localStorage.getItem('orderTime'); if(d && orderDateInput) orderDateInput.value=d; if(t && orderTimeInput) orderTimeInput.value=t; updateDateTimeDisplay(); }catch(e){} }
function saveDeadlineToStorage(){ try{ localStorage.setItem('orderDeadlineDate', deadlineDateInput?.value||''); localStorage.setItem('orderDeadlineTime', deadlineTimeInput?.value||''); updateDeadlineDisplay(); }catch(e){} }
function loadDeadlineFromStorage(){ try{ const d=localStorage.getItem('orderDeadlineDate'); const t=localStorage.getItem('orderDeadlineTime'); if(d && deadlineDateInput) deadlineDateInput.value=d; if(t && deadlineTimeInput) deadlineTimeInput.value=t; updateDeadlineDisplay(); }catch(e){} }
function updateDeadlineDisplay(){ const d=deadlineDateInput?.value||''; const t=deadlineTimeInput?.value||''; if(deadlineDisplay){ if(d&&t){ deadlineDisplay.textContent=`Bestellschluss: ${formatDateCH(d)} um ${t} Uhr`; deadlineDisplay.style.display='block'; } else { deadlineDisplay.textContent=''; deadlineDisplay.style.display='none'; } } }
function disableOrdering(){ const btn=orderForm?.querySelector('button[type="submit"]'); if(btn) btn.disabled=true; if(deadlineWarningDiv) deadlineWarningDiv.style.display='block'; }
function enableOrdering(){ const btn=orderForm?.querySelector('button[type="submit"]'); if(btn) btn.disabled=false; if(deadlineWarningDiv) deadlineWarningDiv.style.display='none'; }
function checkOrderDeadline(){ const d=deadlineDateInput?.value, t=deadlineTimeInput?.value; if(!d){ enableOrdering(); return; } const deadline=new Date(`${d}T${t? t: '23:59'}`); const now=new Date(); if(now>deadline) disableOrdering(); else enableOrdering(); }

/* =========================================================================
   5b) Preisvorschau
   ========================================================================= */
function calcCurrentPrice(){
  const type=getSelectedOrderType();
  if(type==='pizza'){
    const pizzaId=pizzaSelect?.value||''; const size=sizeSelect?.value||''; if(!pizzaId||!size) return null;
    const isGF=!!glutenFreeCheckbox?.checked; let price=getPrice(pizzaId,size); if(isGF) price+=GLUTENFREE_SURCHARGE;
    return {price,label:`Pizza`,details:`${size}${isGF?' · glutenfrei':''}`};
  }else if(type==='salad'){
    const saladId=saladSelect?.value||''; const dressingId=dressingSelect?.value||''; if(!saladId||!dressingId) return null;
    const price=getSaladPrice(saladId); return {price,label:'Salat',details:''};
  }else if(type==='menu'){
    const pizzaId=pizzaSelect?.value||''; const dressingId=dressingSelect?.value||''; const drinkId=drinkSelect?.value||''; if(!pizzaId||!dressingId||!drinkId) return null;
    const isGF=!!glutenFreeCheckbox?.checked; let price=MENU_PRICE_BASE+(isGF?GLUTENFREE_SURCHARGE:0);
    return {price,label:'Menü',details:`${isGF?'glutenfrei':''}`};
  }
  return null;
}
function updatePricePreview(){
  const el=document.getElementById('price-preview'); if(!el) return; const info=calcCurrentPrice();
  if(!info){ el.style.display='none'; el.textContent=''; return; }
  el.style.display='block'; el.textContent=`Preis: CHF ${Number(info.price).toFixed(2)}`;
}

/* =========================================================================
   5) Bestellart & Dropdowns
   ========================================================================= */
function normalizeOrderType(v){ const x=String(v||'').toLowerCase().trim(); if(x==='menü'||x==='menue') return 'menu'; if(x==='salat'||x==='salad') return 'salad'; return x||'pizza'; }
function getSelectedOrderType(){ const r=Array.from(document.querySelectorAll('input[type="radio"][name="order-type"]')).find(x=>x.checked); return normalizeOrderType(r? r.value: 'pizza'); }
function applyOrderTypeAccent(){ try{ document.documentElement.setAttribute('data-order-type', getSelectedOrderType()); }catch(e){} }
function initOrderTypeRadios(){ const radios=document.querySelectorAll('input[type="radio"][name="order-type"]'); if(!radios.length) return; if(!Array.from(radios).some(r=>r.checked)){ const p=Array.from(radios).find(r=>normalizeOrderType(r.value)==='pizza'); if(p) p.checked=true; } radios.forEach(r=>r.addEventListener('change',()=>{ r.value=normalizeOrderType(r.value); updateSelectionVisibility(); applyOrderTypeAccent(); })); applyOrderTypeAccent(); }

function resetSelect(sel, placeholder){ if(!sel) return; sel.innerHTML=''; const opt=document.createElement('option'); opt.value=''; opt.disabled=true; opt.selected=true; opt.textContent=placeholder; sel.appendChild(opt); }

function populatePizzaDropdown(){
  if(!pizzaSelect) return;
  resetSelect(pizzaSelect,'Bitte Pizza wählen…');
  const onlyPizzas = pizzaMenu.filter(it=>!saladIds.includes(it.id));
  const normal = onlyPizzas.filter(p=>!/vegan/i.test(p.name)).sort((a,b)=>a.name.localeCompare(b.name,'de'));
  const vegan  = onlyPizzas.filter(p=>/vegan/i.test(p.name)).sort((a,b)=>a.name.localeCompare(b.name,'de'));
  const addGroup=(label,items)=>{
    if(!items.length) return;
    const og=document.createElement('optgroup'); og.label=label;
    items.forEach(i=>{
      const opt=document.createElement('option');
      opt.value=i.id;
      // Nur Name anzeigen, Zutaten in Tooltip
      opt.textContent = i.name;
      const ing=ingredientsById[i.id]; if(ing) opt.title=ing;
      opt.dataset.name=i.name;
      og.appendChild(opt);
    });
    pizzaSelect.appendChild(og);
  };
  addGroup('Pizza', normal);
  addGroup('Pizza vegan', vegan);
  updateSelectPlaceholderState(pizzaSelect);
}
function populateSaladDropdown(){
  if(!saladSelect) return;
  resetSelect(saladSelect,'Bitte Salat wählen…');
  pizzaMenu.filter(i=>saladIds.includes(i.id))
    .sort((a,b)=>a.name.localeCompare(b.name,'de'))
    .forEach(i=>{
      const opt=document.createElement('option');
      opt.value=i.id;
      opt.textContent = i.name;
      const ing=ingredientsById[i.id]; if(ing) opt.title=ing;
      opt.dataset.name=i.name;
      saladSelect.appendChild(opt);
    });
  updateSelectPlaceholderState(saladSelect);
}
function populateDressingDropdown(){
  if(!dressingSelect) return;
  resetSelect(dressingSelect,'Bitte Dressing wählen…');
  dressingMenu.sort((a,b)=>a.name.localeCompare(b.name,'de')).forEach(d=>{ const opt=document.createElement('option'); opt.value=d.id; opt.textContent=d.name; dressingSelect.appendChild(opt); });
  updateSelectPlaceholderState(dressingSelect);
}
function populateDrinkDropdown(){
  if(!drinkSelect) return;
  resetSelect(drinkSelect,'Bitte Getränk wählen…');
  const groups={}; drinkMenu.forEach(d=>{ const g=d.group||'Andere'; (groups[g]=groups[g]||[]).push(d); });
  Object.keys(groups).sort((a,b)=>a.localeCompare(b,'de')).forEach(group=>{
    const og=document.createElement('optgroup'); og.label=group;
    groups[group].sort((a,b)=>a.name.localeCompare(b.name,'de')).forEach(d=>{ const opt=document.createElement('option'); opt.value=d.id; opt.textContent=d.name; og.appendChild(opt); });
    drinkSelect.appendChild(og);
  });
  updateSelectPlaceholderState(drinkSelect);
}
function populateMenuPizzaDropdown(){
  if(!pizzaSelect) return;
  resetSelect(pizzaSelect,'Bitte Pizza wählen…');
  const items=menuPizzaIds
    .map(id=>pizzaMenu.find(x=>x.id===id))
    .filter(Boolean)
    .sort((a,b)=>a.name.localeCompare(b.name,'de'));
  items.forEach(i=>{
    const opt=document.createElement('option');
    opt.value=i.id;
    opt.textContent = i.name;
    const ing=ingredientsById[i.id]; if(ing) opt.title=ing;
    opt.dataset.name=i.name;
    pizzaSelect.appendChild(opt);
  });
  updateSelectPlaceholderState(pizzaSelect);
}
function populateMenuSaladDropdown(){ if(!saladSelect) return; saladSelect.innerHTML=''; const item=pizzaMenu.find(x=>x.id==='insalata_verde'); const opt=document.createElement('option'); opt.value=item? item.id:'insalata_verde'; opt.textContent=item? item.name:'Insalata Verde'; opt.selected=true; saladSelect.appendChild(opt); }

function getPrice(id,size){ const it=pizzaMenu.find(x=>x.id===id); if(!it) return 0; const p=it.prices[size]; return (p===undefined? (it.prices['30cm']||0): p); }
function getSaladPrice(id){ const base=getPrice(id,'24cm'); return base+0.5; }

/* =========================================================================
   6) Google Sheets – POST/GET (+ JSONP)
   ========================================================================= */
async function sendOrderToGoogle(order){
  const payload={
    Secret:getSharedSecret(),
    Action:'create',
    ClientId:order.clientId||'',
    Person:order.name||'',
    Bestellart:order.orderType||'',
    Pizza:order.pizzaName||'',
    Groesse:order.size||'',
    Glutenfrei:!!order.isGlutenFree,
    Salat:order.saladName||'',
    Dressing:order.dressingName||'',
    Getraenk:order.drinkName||'',
    Preis:Number(order.price||0),
    Bemerkungen:order.comments||''
  };
  try{
    // Versuch 1: CORS-Response mit JSON lesen (empfohlen, wenn Apps Script CORS sendet)
    const res = await fetch(GOOGLE_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const ct = res.headers.get('content-type')||'';
    if(res.ok && ct.includes('application/json')){
      const data=await res.json();
      if(data && data.BestellNr){ order.bestellNr=String(data.BestellNr); saveOrdersToStorage(); }
      console.log('An Google gesendet (JSON):',payload,data);
      return;
    }
    // Fallback: still send without reading response
    await fetch(GOOGLE_SCRIPT_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    console.log('An Google gesendet (fallback no-cors):',payload);
  }catch(err){
    try{
      await fetch(GOOGLE_SCRIPT_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      console.log('An Google gesendet (catch no-cors):',payload);
    }catch(e){ console.error('Fehler beim Senden an Google Sheets:',e); }
  }
}

// Remote: Eintrag löschen – bevorzugt per BestellNr, sonst clientId/Details
async function deleteOrderInGoogle(order){
  if(!order) return;
  try{
    // 1) Delete by BestellNr (falls vorhanden und Server unterstützt action=deleteByNr)
    if(order.bestellNr){
      const url1 = `${GOOGLE_SCRIPT_URL}?action=deleteByNr&secret=${encodeURIComponent(getSharedSecret())}&orderNr=${encodeURIComponent(order.bestellNr)}`;
      await fetch(url1,{method:'GET',mode:'no-cors'});
      console.log('Löschanfrage (BestellNr) gesendet:', order.bestellNr);
      return;
    }
    // 2) Fallback: delete mit clientId + Feldern
    const params=new URLSearchParams();
    params.set('action','delete');
    params.set('secret', getSharedSecret());
    if(order.clientId) params.set('clientId', order.clientId);
    params.set('person', order.name||'');
    params.set('orderType', order.orderType||'');
    params.set('pizza', order.pizzaName||'');
    params.set('size', order.size||'');
    params.set('isGF', String(!!order.isGlutenFree));
    params.set('salad', order.saladName||'');
    params.set('dressing', order.dressingName||'');
    params.set('drink', order.drinkName||'');
    params.set('price', String(order.price||0));
    params.set('comments', order.comments||'');
    const url2=`${GOOGLE_SCRIPT_URL}?${params.toString()}`;
    await fetch(url2,{method:'GET',mode:'no-cors'});
    console.log('Löschanfrage (Fallback) gesendet:', Object.fromEntries(params));
  }catch(err){ console.warn('Konnte Remote-Loeschung nicht senden:', err); }
}

// Remote: Alle Eintraege loeschen (benoetigt Server-Unterstuetzung fuer action=clearAll)
async function clearAllOrdersInGoogle(){
  try{
    const url=`${GOOGLE_SCRIPT_URL}?action=clearAll&secret=${encodeURIComponent(getSharedSecret())}`;
    await fetch(url,{method:'GET',mode:'no-cors'});
    console.log('Anfrage zum Leeren des Sheets gesendet');
  }catch(err){ console.warn('Konnte Remote-Clear nicht senden:', err); }
}

// Fallback: Wenn clearAll nicht greift, alle Eintraege einzeln loeschen
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function showProgress(total){
  const wrap=document.getElementById('remote-progress');
  const bar=document.getElementById('remote-progress-bar');
  if(!wrap||!bar) return; wrap.style.display='block'; wrap.setAttribute('aria-hidden','false');
  wrap.classList.remove('remote-progress--success','remote-progress--error');
  wrap.classList.add('remote-progress--running');
  bar.style.width='0%'; bar.setAttribute('aria-valuenow','0'); bar.setAttribute('aria-valuemax', String(total||100)); bar.setAttribute('aria-label','Loeschfortschritt');
}
function updateProgress(done,total){
  const bar=document.getElementById('remote-progress-bar'); if(!bar||!total) return;
  const pct=Math.max(0,Math.min(100, Math.round((done/total)*100)));
  bar.style.width=pct+'%'; bar.setAttribute('aria-valuenow', String(pct));
}
function markProgressSuccess(){ const wrap=document.getElementById('remote-progress'); if(wrap){ wrap.classList.remove('remote-progress--running','remote-progress--error'); wrap.classList.add('remote-progress--success'); } }
function markProgressError(){ const wrap=document.getElementById('remote-progress'); if(wrap){ wrap.classList.remove('remote-progress--running','remote-progress--success'); wrap.classList.add('remote-progress--error'); } }
function hideProgress(){ const wrap=document.getElementById('remote-progress'); if(wrap){ wrap.style.display='none'; wrap.setAttribute('aria-hidden','true'); wrap.classList.remove('remote-progress--running','remote-progress--success','remote-progress--error'); } }
async function deleteRemoteRecord(rec){
  if(!rec) return;
  // Bevorzugt per BestellNr löschen, falls vorhanden
  if(rec.BestellNr){
    try{
      const url1 = `${GOOGLE_SCRIPT_URL}?action=deleteByNr&secret=${encodeURIComponent(getSharedSecret())}&orderNr=${encodeURIComponent(String(rec.BestellNr))}`;
      await fetch(url1,{method:'GET',mode:'no-cors'});
      // Fahre trotzdem mit Fallback fort, da no-cors keine Erfolgskontrolle erlaubt
    }catch(e){ console.warn('Delete by BestellNr fehlgeschlagen, versuche Fallback…', e); }
  }
  try{
    const params=new URLSearchParams();
    params.set('action','delete');
    params.set('secret', getSharedSecret());
    if(rec.ClientId) params.set('clientId', String(rec.ClientId));
    params.set('person', String(rec.Person||''));
    params.set('orderType', String(rec.Bestellart||''));
    params.set('pizza', String(rec.Pizza||''));
    params.set('size', String(rec.Groesse||''));
    params.set('isGF', String(!!rec.Glutenfrei));
    params.set('salad', String(rec.Salat||''));
    params.set('dressing', String(rec.Dressing||''));
    params.set('drink', String(rec.Getraenk||''));
    params.set('price', String(Number(rec.Preis||0)));
    params.set('comments', String(rec.Bemerkungen||''));
    const url=`${GOOGLE_SCRIPT_URL}?${params.toString()}`;
    await fetch(url,{method:'GET',mode:'no-cors'});
  }catch(e){ console.warn('Delete (Fallback) fehlgeschlagen:', e); }
}
async function clearRemoteByIteration(){
  try{
    await loadOrdersFromGoogle();
    const list = Array.isArray(window.__REMOTE_DATA__)? window.__REMOTE_DATA__: [];
    const total = list.length;
    const statusEl = document.getElementById('remote-status');
    if(total>0) showProgress(total); else hideProgress();
    if(statusEl) statusEl.textContent = total ? `Lösche alle Einträge… 0/${total}` : 'Keine Einträge zum Löschen gefunden.';
    let done = 0;
    for(const rec of list){
      await deleteRemoteRecord(rec);
      done++;
      if(statusEl) statusEl.textContent = `Lösche alle Einträge… ${done}/${total}`;
      updateProgress(done,total);
      await sleep(120);
    }
    if(statusEl) statusEl.textContent = `Sheet bereinigt: ${done} Einträge gelöscht.`;
    updateProgress(total,total);
    markProgressSuccess();
    setTimeout(hideProgress, 1200);
    return done;
  }catch(e){ console.warn('Iteratives Loeschen fehlgeschlagen:', e); markProgressError(); return 0; }
}

function renderRemoteTable(data){
  const tbody=document.querySelector('#remote-orders-table tbody'); if(!tbody) return;
  tbody.innerHTML='';
  const list = Array.isArray(data)? data: [];
  // Sortieren vorbereiten
  const collator = new Intl.Collator('de',{numeric:true,sensitivity:'base'});
  const state = window.__REMOTE_SORT__ || {col:0,dir:1};
  const artikelStr = (r)=>{
    const art=String(r.Bestellart||'').toLowerCase(); const gf=!!r.Glutenfrei;
    if(art==='salad') return `Salat: ${r.Salat||''}, ${r.Dressing||''}`;
    if(art==='menu') return `Menü: ${(r.Pizza||'')}${gf?' (glutenfrei)':''}, ${(r.Salat||'')} (${r.Dressing||''}), ${(r.Getraenk||'')}`;
    return `${r.Pizza||''}${gf?' (glutenfrei)':''}`;
  };
  const getter = [
    r=>parseInt(String(r.BestellNr||0).toString().replace(/\D/g,''))||0,
    r=>String(r.Person||''),
    r=>artikelStr(r),
    r=>String(r.Groesse||''),
    r=>Number(r.Preis||0)||0
  ][state.col] || (()=>0);
  const sorted = list.slice().sort((a,b)=>{
    const va=getter(a), vb=getter(b);
    if(typeof va==='number' && typeof vb==='number') return (va-vb)*state.dir;
    return collator.compare(String(va),String(vb))*state.dir;
  });
  let total=0;
  sorted.forEach((r, idx)=>{
    const nrShort=(r.BestellNr??'').toString().slice(-5) || String(idx+1);
    const art=String(r.Bestellart||'').toLowerCase();
    const gf=!!r.Glutenfrei;
    const size=r.Groesse||'';
    const priceNum = Number(r.Preis||0) || 0;
    total += priceNum;
    let artikel='';
    if(art==='salad'){
      artikel = `Salat: ${r.Salat||''}, ${r.Dressing||''}`;
    }else if(art==='menu'){
      artikel = `Menü: ${(r.Pizza||'')}${gf?' (glutenfrei)':''}, ${(r.Salat||'')} (${r.Dressing||''}), ${(r.Getraenk||'')}`;
    }else{
      artikel = `${r.Pizza||''}${gf?' (glutenfrei)':''}`;
    }
    const tr=document.createElement('tr');
    tr.classList.add('row-add');
    const initials=String(r.Person||'').trim().split(/\s+/).slice(0,2).map(s=>s[0]?.toUpperCase()||'').join('');
    tr.innerHTML=`
      <td class="col-nr">${nrShort}</td>
      <td><span class="avatar">${initials}</span>${r.Person||''}</td>
      <td>${artikel}${r.Bemerkungen?`\n<div class=\"subtext\">${String(r.Bemerkungen).replace(/</g,'&lt;')}</div>`:``}</td>
      <td>${size}</td>
      <td>${priceNum.toFixed(2)}</td>
      <td class="actions-cell"><div class="actions"><button class="btn btn--secondary btn-icon btn-remove-remote" data-index="${idx}" aria-label="Entfernen" title="Entfernen">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button></div></td>`;
    tbody.appendChild(tr);
  });
  const totalEl=document.getElementById('remote-total');
  if(totalEl) totalEl.textContent = `Anzahl Positionen: ${list.length} | Total: CHF ${total.toFixed(2)}`;
  Array.from(document.querySelectorAll('.btn-remove-remote')).forEach(btn=>{
    btn.addEventListener('click', async (e)=>{
      const i = Number(e.currentTarget.getAttribute('data-index'));
      const rec = sorted[i];
      const nameLabel = rec?.Person ? `von ${rec.Person}` : '';
      if(!confirm(`Möchtest du die Bestellung ${nameLabel||''} wirklich löschen?`)) return;
      try{
        await deleteRemoteRecord(rec);
        showToast('Eintrag gelöscht.');
      }catch(err){ console.warn(err); showToast('Fehler beim Löschen.'); }
      await loadOrdersFromGoogle();
    });
  });
  // Header-Sortierung (einmalig binden)
  const thead=document.querySelector('#remote-orders-table thead');
  if(thead && !thead.dataset.sortInit){
    thead.dataset.sortInit='1';
    const ths=Array.from(thead.querySelectorAll('th'));
    ths.forEach((th,i)=>{
      // Spalten 0..4 sortierbar (ohne Aktion)
      if(i<=4){
        th.style.cursor='pointer'; th.title='Zum Sortieren klicken';
        th.addEventListener('click',()=>{
          const cur=window.__REMOTE_SORT__||{col:0,dir:1};
          window.__REMOTE_SORT__ = cur.col===i? {col:i,dir:cur.dir*-1}: {col:i,dir:1};
          renderRemoteTable(window.__REMOTE_DATA__||[]);
        });
      }
    });
  }
}

function renderRemoteSummary(data){
  const list=Array.isArray(data)? data: [];
  let total=0; const cP={}, cS={}, cD={};
  list.forEach(r=>{
    total+=Number(r.Preis||0)||0;
    const art=String(r.Bestellart||'').toLowerCase();
    if(art==='pizza'){
      const key=`${r.Pizza||''}${r.Groesse?` (${r.Groesse})`:''}${r.Glutenfrei?' (glutenfrei)':''}`.trim();
      cP[key]=(cP[key]||0)+1;
    }else if(art==='salad'){
      const key=`${r.Salat||''} mit ${r.Dressing||''}`.trim();
      cS[key]=(cS[key]||0)+1;
    }else if(art==='menu'){
      const pKey=`${r.Pizza||''}${r.Glutenfrei?' (glutenfrei)':''}`.trim();
      const sKey=`${r.Salat||''} mit ${r.Dressing||''}`.trim();
      const dKey=(r.Getraenk||'').trim();
      cP[pKey]=(cP[pKey]||0)+1;
      cS[sKey]=(cS[sKey]||0)+1;
      if(dKey) cD[dKey]=(cD[dKey]||0)+1;
    }
  });
  const totalEl=$('#remote-total'); if(totalEl) totalEl.textContent=`Anzahl Positionen: ${list.length} | Total: CHF ${total.toFixed(2)}`;
  const fill=(obj,ulId)=>{}; // (optional: eigene Mengenliste)
}

function buildRemoteSummaryText(data){
  const list=Array.isArray(data)? data: [];
  const d=formatDateCH($('#order-date')?.value||''); const t=$('#order-time')?.value||'';
  const ordererName=$('#orderer-name')?.value?.trim()||'';
  const ordererPhone=normalizeSwissPhone($('#orderer-phone')?.value?.trim()||'');
  const deliveryAddress=$('#delivery-address')?.value?.trim()||'';
  const supplierName=supplierNameInput?.value?.trim()||'';
  const supplierPhone=(supplierPhoneInput?.value?.trim()||'');
  const supplierEmail=(supplierEmailInput?.value?.trim()||'');

  let s='';
  s+=`Besteller: ${ordererName||'-'} | Tel.: ${ordererPhone||'-'}\n`;
  s+=`Lieferadresse: ${deliveryAddress||'-'}\n`;
  s+=`Lieferant: ${supplierName||'-'} | Tel.: ${supplierPhone||'-'} | Mail: ${supplierEmail||'-'}\n`;
  s+=`Termin: ${d||'-'}, ${t||'-'} Uhr\n`;
  const mapLink=buildMapsLink(deliveryAddress); if(mapLink) s+=`Karte: ${mapLink}\n`;

  s+='\nBestell-Liste (nach Nummer):\n';
  list.forEach((r,i)=>{
    const gf=r.Glutenfrei?', glutenfrei':'';
    const size=r.Groesse?`, Grösse: ${r.Groesse}`:'';
    const item = r.Bestellart==='salad'
      ? `Salat: ${r.Salat||''}, ${r.Dressing||''}`
      : (r.Bestellart==='menu'
          ? `Menü: ${r.Pizza||''}${gf}, ${r.Salat||''} (${r.Dressing||''}), ${r.Getraenk||''}`
          : `${r.Pizza||''}${size}${gf}`);
    s+=`${String(i+1).padStart(2,'0')}. ${r.Person||''} – ${item} | CHF ${(Number(r.Preis||0)).toFixed(2)}\n`;
  });

  const cP={},cS={},cD={};
  list.forEach(r=>{
    if(r.Bestellart==='pizza'){
      const k=`${r.Pizza||''}${r.Groesse?` (${r.Groesse})`:''}${r.Glutenfrei?' (glutenfrei)':''}`.trim(); cP[k]=(cP[k]||0)+1;
    }else if(r.Bestellart==='salad'){
      const k=`${r.Salat||''} mit ${r.Dressing||''}`.trim(); cS[k]=(cS[k]||0)+1;
    }else if(r.Bestellart==='menu'){
      const p=`${r.Pizza||''}${r.Glutenfrei?' (glutenfrei)':''}`.trim(); cP[p]=(cP[p]||0)+1;
      const sKey=`${r.Salat||''} mit ${r.Dressing||''}`.trim(); cS[sKey]=(cS[sKey]||0)+1;
      const dKey=(r.Getraenk||'').trim(); if(dKey) cD[dKey]=(cD[dKey]||0)+1;
    }
  });
  const sorted=o=>Object.entries(o).sort((a,b)=>a[0].localeCompare(b[0],'de'));
  s+='\nMengenübersicht:\n— Pizzas —\n'; sorted(cP).forEach(([k,v])=>s+=`  ${v}× ${k}\n`);
  s+='— Salate (inkl. Dressing) —\n'; sorted(cS).forEach(([k,v])=>s+=`  ${v}× ${k}\n`);
  s+='— Getränke —\n'; sorted(cD).forEach(([k,v])=>s+=`  ${v}× ${k}\n`);
  const total=list.reduce((sum,r)=>sum+(Number(r.Preis||0)||0),0);
  s+=`\nSumme:\nAnzahl Positionen: ${list.length} | Total: CHF ${total.toFixed(2)}\n`;
  return s;
}

/* JSONP Fallback */
function loadJsonp(src){
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script'); s.src=src;
    s.onerror=()=>{ alert('Konnte nicht vom Google Sheet laden. Prüfe Secret/Bereitstellung.'); reject(new Error('JSONP error')); };
    document.head.appendChild(s);
    window.__jsonpResolve=resolve;
  });
}
function handleRemoteOrders(data){
  renderRemoteTable(data||[]);
  const status=$('#remote-status'); if(status) status.textContent=`Geladen: ${(data||[]).length} Einträge.`;
  window.__REMOTE_DATA__=data||[];
  const box=document.getElementById('remote-summary-text'); if(box){ box.value=buildRemoteSummaryText(window.__REMOTE_DATA__); autoResizeTextarea(box); }
  endRemoteLoading();
  if(window.__jsonpResolve){ window.__jsonpResolve(); window.__jsonpResolve=null; }
}
async function loadOrdersFromGoogle(){
  const status=$('#remote-status'); if(status) status.textContent='Lade vom Server...';
  startRemoteLoading();
  const base=`${GOOGLE_SCRIPT_URL}?action=list&secret=${encodeURIComponent(getSharedSecret())}`;
  try{
    const res=await fetch(base,{method:'GET'});
    if(res.ok && (res.headers.get('content-type')||'').includes('application/json')){
      const data=await res.json();
      renderRemoteTable(data);
      if(status) status.textContent=`Geladen: ${data.length} Einträge.`; 
      window.__REMOTE_DATA__=data;
      const box=document.getElementById('remote-summary-text'); if(box){ box.value=buildRemoteSummaryText(data); autoResizeTextarea(box); }
      endRemoteLoading();
      return;
    }
  }catch(e){ console.warn('Fetch JSON gescheitert, weiche auf JSONP aus:',e); }
  await loadJsonp(base+`&callback=handleRemoteOrders`);
}
function downloadRemoteCsv(){
  const data=window.__REMOTE_DATA__||[];
  const rows=[['BestellNr','Person','Bestellart','Pizza','Groesse','Glutenfrei','Salat','Dressing','Getraenk','Preis','Bemerkungen','Bestelldatum'],
    ...data.map(r=>[r.BestellNr||'',r.Person||'',r.Bestellart||'',r.Pizza||'',r.Groesse||'',r.Glutenfrei?'ja':'',r.Salat||'',r.Dressing||'',r.Getraenk||'',(typeof r.Preis==='number'? r.Preis.toFixed(2):(r.Preis||'')),r.Bemerkungen||'',r.Bestelldatum||''])];
  const csv=rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='pizza-bestellungen_sheet.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

/* =========================================================================
   7) Bestelllogik (lokal)
   ========================================================================= */
function updateSelectionVisibility(){
  const type=getSelectedOrderType();
  if(pizzaSelectionDiv) pizzaSelectionDiv.style.display='none';
  if(saladSelectionDiv) saladSelectionDiv.style.display='none';
  if(dressingSelectionDiv) dressingSelectionDiv.style.display='none';
  if(drinkSelectionDiv) drinkSelectionDiv.style.display='none';
  if(sizeGroup) sizeGroup.style.display='none';
  if(glutenFreeGroup) glutenFreeGroup.style.display='none';

  if(type==='pizza'){
    pizzaSelectionDiv.style.display='block';
    sizeGroup.style.display='block';
    glutenFreeGroup.style.display='block';
    populatePizzaDropdown();
    updatePricePreview();
    updatePizzaDetails();
  }else if(type==='salad'){
    saladSelectionDiv.style.display='block';
    dressingSelectionDiv.style.display='block';
    populateSaladDropdown(); populateDressingDropdown();
    updatePricePreview();
    updateSaladDetails();
  }else if(type==='menu'){
    pizzaSelectionDiv.style.display='block';
    saladSelectionDiv.style.display='block';
    dressingSelectionDiv.style.display='block';
    drinkSelectionDiv.style.display='block';
    glutenFreeGroup.style.display='block';
    populateMenuPizzaDropdown(); populateMenuSaladDropdown(); populateDressingDropdown(); populateDrinkDropdown();
    updatePricePreview();
    updatePizzaDetails();
    updateSaladDetails();
  }
}

function updatePizzaDetails(){
  try{
    const id=pizzaSelect?.value||'';
    const ing=ingredientsById[id];
    if(pizzaIngredientsBox){ if(ing){ pizzaIngredientsBox.textContent=ing; pizzaIngredientsBox.style.display='block'; } else { pizzaIngredientsBox.textContent=''; pizzaIngredientsBox.style.display='none'; } }
  }catch(e){}
}

function updateSaladDetails(){
  try{
    const id=saladSelect?.value||'';
    const ing=ingredientsById[id];
    if(saladIngredientsBox){ if(ing){ saladIngredientsBox.textContent=ing; saladIngredientsBox.style.display='block'; } else { saladIngredientsBox.textContent=''; saladIngredientsBox.style.display='none'; } }
  }catch(e){}
}

async function addOrder(e){
  e.preventDefault();
checkOrderDeadline(); const btn=orderForm?.querySelector('button[type="submit"]'); if(btn && btn.disabled){ alert('Der Bestellschluss ist erreicht. Keine neuen Bestellungen möglich.'); return; }

  const name=($('#person-name')?.value||'').trim();
  const comments=($('#comments')?.value||'').trim();
  const orderType=getSelectedOrderType();
  if(!name){ alert('Bitte Namen eingeben.'); return; }

  let orderObj=null;
  if(orderType==='pizza'){
    const pizzaId=pizzaSelect?.value||''; if(!pizzaId){ alert('Bitte Pizza wählen.'); return; }
    const size=sizeSelect?.value||'30cm';
    const pizzaItem=pizzaMenu.find(x=>x.id===pizzaId);
    const isGF=!!glutenFreeCheckbox?.checked;
    let price=getPrice(pizzaId,size); if(isGF) price+=GLUTENFREE_SURCHARGE;
    const pizzaName=(pizzaItem? pizzaItem.name: pizzaId)+(isGF?' (glutenfrei)':'');
    orderObj={name,orderType:'pizza',itemId:pizzaId,itemName:pizzaName,pizzaName,size,isGlutenFree:isGF,price,comments};
  }else if(orderType==='salad'){
    const saladId=saladSelect?.value||''; const dressingId=dressingSelect?.value||'';
    if(!saladId){ alert('Bitte Salat wählen.'); return; }
    if(!dressingId){ alert('Bitte Dressing wählen.'); return; }
    const saladItem=pizzaMenu.find(x=>x.id===saladId);
    const dressingItem=dressingMenu.find(x=>x.id===dressingId);
    const saladName=saladItem?saladItem.name:saladId;
    const dressingName=dressingItem?dressingItem.name:dressingId;
    const price=getSaladPrice(saladId);
    orderObj={name,orderType:'salad',itemId:`${saladId}_${dressingId}`,itemName:`Salat: ${saladName}, ${dressingName}`,saladName,dressingName,size:'',isGlutenFree:false,price,comments};
  }else if(orderType==='menu'){
    const pizzaId=pizzaSelect?.value||''; const saladId='insalata_verde'; const dressingId=dressingSelect?.value||''; const drinkId=drinkSelect?.value||'';
    if(!pizzaId||!dressingId||!drinkId){ alert('Bitte Pizza, Dressing und Getränk wählen (Salat ist grün).'); return; }
    const pizzaItem=pizzaMenu.find(x=>x.id===pizzaId);
    const dressingItem=dressingMenu.find(x=>x.id===dressingId);
    const drinkItem=drinkMenu.find(x=>x.id===drinkId);
    const isGF=!!glutenFreeCheckbox?.checked;
    let price=MENU_PRICE_BASE+(isGF?GLUTENFREE_SURCHARGE:0);
    const pizzaName=(pizzaItem?pizzaItem.name:pizzaId)+(isGF?' (glutenfrei)':'');
    const saladName='Insalata Verde';
    const dressingName=dressingItem?dressingItem.name:dressingId;
    const drinkName=drinkItem?drinkItem.name:drinkId;
  orderObj={name,orderType:'menu',itemId:`menu_${pizzaId}_${saladId}_${dressingId}_${drinkId}`,itemName:`Menü: ${pizzaName}, ${saladName} (${dressingName}), ${drinkName}`,pizzaName,saladName,dressingName,drinkName,size:'30cm',isGlutenFree:isGF,price,comments};
  }
  // Eindeutige Client-ID fuer spaetere Referenz (Remote-Loeschung)
  orderObj.clientId = orderObj.clientId || (`c_${Date.now()}_${Math.random().toString(36).slice(2,8)}`);
  orders.push(orderObj); saveOrdersToStorage(); updateOrdersTable();
  ensureSharedSecret();
  if(btn) setBtnLoading(btn,true,'Sende…');
  if(orderForm) orderForm.setAttribute('aria-busy','true');
  try{
    // kurze künstliche Verzögerung für sichtbare Aktivitätsanzeige
    if(typeof sleep==='function') await sleep(600);
    await sendOrderToGoogle(orderObj);
  }catch(e){
    console.warn('Senden fehlgeschlagen (lokal gespeichert):', e);
  }finally{
    if(btn) setBtnLoading(btn,false);
    if(orderForm) orderForm.removeAttribute('aria-busy');
  }
  showToast('Deine Bestellung wurde übermittelt. Vielen Dank.');
  orderForm?.reset(); const pizzaRadio=document.querySelector('input[name="order-type"][value="pizza"]'); if(pizzaRadio) pizzaRadio.checked=true; updateSelectionVisibility();
  updatePricePreview();
}

function updateOrdersTable(){
  if(!ordersTableBody) return; ordersTableBody.innerHTML='';
  orders.forEach((o,idx)=>{ const tr=document.createElement('tr'); tr.classList.add('row-add'); const initials=(o.name||'').trim().split(/\s+/).slice(0,2).map(s=>s[0]?.toUpperCase()||'').join(''); const articleHtml=`${o.itemName||o.pizzaName||''}${o.comments?`<div class="subtext">${(''+o.comments).replace(/</g,'&lt;')}</div>`:''}`; tr.innerHTML=`
    <td>${idx+1}</td><td><span class="avatar">${initials}</span>${o.name}</td><td>${articleHtml}</td><td>${o.size||''}</td>
    <td>${o.price.toFixed(2)}</td>
    <td class="actions-cell"><div class="actions">
      <button class="btn btn--secondary btn-icon btn-edit" data-index="${idx}" aria-label="Bearbeiten" title="Bearbeiten">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
        </svg>
      </button>
      <button class="btn btn--secondary btn-icon btn-remove" data-index="${idx}" aria-label="Entfernen" title="Entfernen">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div></td>`; ordersTableBody.appendChild(tr); });
  const total=orders.reduce((s,o)=>s+(o.price||0),0);
  if(ordersSummaryDiv) ordersSummaryDiv.textContent=orders.length?`Total: CHF ${total.toFixed(2)}`:'';
  document.querySelectorAll('.btn-remove').forEach(btn=>btn.addEventListener('click',async e=>{
    const idx=Number(e.currentTarget.getAttribute('data-index'));
    const removed=orders[idx];
    const tr = e.currentTarget.closest('tr');
    const nameLabel = removed?.name ? `von ${removed.name}` : '';
    const confirmMsg = `Möchtest du die Bestellung ${nameLabel||''} wirklich löschen?`;
    if(!confirm(confirmMsg.trim())) return;
    if(tr){ tr.classList.add('row-remove'); }
    setTimeout(()=>{
      orders.splice(idx,1);
      saveOrdersToStorage();
      updateOrdersTable();
      // Undo-Toast mit 7s Zeitfenster. Remote-Löschung erst nach Ablauf.
      const t = setTimeout(async ()=>{ try{ await deleteOrderInGoogle(removed); }catch{} }, 7000);
      showUndoToast('Bestellung gelöscht.',{
        undoLabel:'Rückgängig',
        onUndo:()=>{
          clearTimeout(t);
          // Füge an ursprünglicher Position wieder ein
          orders.splice(idx,0,removed);
          saveOrdersToStorage();
          updateOrdersTable();
        },
        onExpire:()=>{}
      });
    }, 180);
  }));
  // Edit-Handler (Name, Bemerkungen)
  document.querySelectorAll('.btn-edit').forEach(btn=>btn.addEventListener('click',async e=>{
    const idx=Number(e.currentTarget.getAttribute('data-index'));
    const original=orders[idx]; if(!original) return;
    const newName = prompt('Name bearbeiten:', original.name||''); if(newName===null) return;
    const newComments = prompt('Bemerkungen bearbeiten:', original.comments||''); if(newComments===null) return;
    const updated = { ...original, name:newName.trim(), comments:(newComments||'').trim() };
    orders[idx]=updated; saveOrdersToStorage(); updateOrdersTable(); showToast('Bestellung aktualisiert.');
    try{
      await deleteOrderInGoogle(original);
      await sendOrderToGoogle(updated);
    }catch(err){ console.warn('Remote-Update fehlgeschlagen:', err); }
  }));
}

/* =========================================================================
   8) Admin: Auto-Reload & UI
   ========================================================================= */
let adminAccessGranted=false; const ADMIN_PASSWORD='kaizen'; let remoteAutoTimer=null;
// Admin login modal refs
const adminLoginModal = document.getElementById('admin-login');
const adminPasswordInput = document.getElementById('admin-password-input');
const adminPasswordToggle = document.getElementById('admin-password-toggle');
const adminLoginConfirm = document.getElementById('admin-login-confirm');
const adminLoginCancel = document.getElementById('admin-login-cancel');

function showAdminLogin(){ if(!adminLoginModal) return; adminLoginModal.style.display='flex'; setTimeout(()=>adminPasswordInput?.focus(), 0); }
function hideAdminLogin(){ if(!adminLoginModal) return; adminLoginModal.style.display='none'; if(adminPasswordInput) adminPasswordInput.value=''; }
function startRemoteAutoReload(){ clearInterval(remoteAutoTimer); remoteAutoTimer=setInterval(loadOrdersFromGoogle, 60000); }
function stopRemoteAutoReload(){ clearInterval(remoteAutoTimer); remoteAutoTimer=null; }

function toggleAdminSection(){
  const hidden=adminSection?.style.display==='none'||!adminSection?.style.display;
  if(hidden){
    if(!adminAccessGranted){ showAdminLogin(); return; }
    adminSection.style.display='block';
    if(toggleAdminBtn){ toggleAdminBtn.setAttribute('aria-expanded','true'); }
    pageTitleInputField.value=pageTitleElement?.textContent||'';
    pageDescriptionInputField.value=pageDescriptionElement?.textContent||'';
    updateDeliveryMap();
    ensureSharedSecret(); loadOrdersFromGoogle(); startRemoteAutoReload();
  }else{
    adminSection.style.display='none'; adminAccessGranted=false; stopRemoteAutoReload();
    if(toggleAdminBtn){ toggleAdminBtn.setAttribute('aria-expanded','false'); }
  }
}

function ensureRemoteUI(){
  $('#load-remote-btn')?.addEventListener('click', loadOrdersFromGoogle);
  $('#download-remote-csv-btn')?.addEventListener('click', downloadRemoteCsv);
  $('#change-secret')?.addEventListener('click', ()=>{ ensureSharedSecret({forcePrompt:true}); alert('Secret aktualisiert.'); });
  $('#refresh-remote-summary')?.addEventListener('click', ()=>{ loadOrdersFromGoogle(); });
}

/* =========================================================================
   9) Zusammenfassungen & CSV (lokal)
   ========================================================================= */
function generateSummary(){
  if(orders.length){
    const d=formatDateCH(orderDateInput?.value||''); const t=orderTimeInput?.value||'';
    const ordererName=ordererNameInput?.value?.trim()||'';
    const ordererPhone=normalizeSwissPhone(ordererPhoneInput?.value?.trim()||'');
    const deliveryAddress=deliveryAddressInput?.value?.trim()||'';
    const supplierName=supplierNameInput?.value?.trim()||'';
    const supplierPhone=supplierPhoneInput?.value?.trim()||'';
    const supplierEmail=supplierEmailInput?.value?.trim()||'';

    let s='';
    s+=`Besteller: ${ordererName||'-'} | Tel.: ${ordererPhone||'-'}\n`;
    s+=`Lieferadresse: ${deliveryAddress||'-'}\n`;
    s+=`Lieferant: ${supplierName||'-'} | Tel.: ${supplierPhone||'-'} | Mail: ${supplierEmail||'-'}\n`;
    s+=`Termin: ${d||'-'}, ${t||'-'} Uhr\n`;
    const mapLink=buildMapsLink(deliveryAddress); if(mapLink) s+=`Karte: ${mapLink}\n`;
    s+='\nBestell-Liste (nach Nummer):\n';
    orders.forEach((o,i)=>{ s+=`${String(i+1).padStart(2,'0')}. ${o.name} – ${o.itemName||o.pizzaName||''}`; if(o.size) s+=`, Grösse: ${o.size}`; if(o.isGlutenFree) s+=`, glutenfrei`; if(o.comments) s+=`, Bemerkung: ${o.comments}`; s+=` | CHF ${o.price.toFixed(2)}\n`; });
    const countsPizza={},countsSalad={},countsDrinks={};
    orders.forEach(o=>{ if(o.orderType==='pizza'){ const k=`${o.pizzaName}${o.size?` (${o.size})`:''}`.trim(); countsPizza[k]=(countsPizza[k]||0)+1; }
      else if(o.orderType==='salad'){ const k=`${o.saladName} mit ${o.dressingName}`; countsSalad[k]=(countsSalad[k]||0)+1; }
      else if(o.orderType==='menu'){ const p=`${o.pizzaName}`; countsPizza[p]=(countsPizza[p]||0)+1; const sKey=`${o.saladName} mit ${o.dressingName}`; countsSalad[sKey]=(countsSalad[sKey]||0)+1; const dKey=o.drinkName; countsDrinks[dKey]=(countsDrinks[dKey]||0)+1; }});
    const sorted=o=>Object.entries(o).sort((a,b)=>a[0].localeCompare(b[0],'de'));
    s+='\nMengenübersicht:\n— Pizzas —\n'; sorted(countsPizza).forEach(([k,v])=>s+=`  ${v}× ${k}\n`);
    s+='— Salate (inkl. Dressing) —\n'; sorted(countsSalad).forEach(([k,v])=>s+=`  ${v}× ${k}\n`);
    s+='— Getränke —\n'; sorted(countsDrinks).forEach(([k,v])=>s+=`  ${v}× ${k}\n`);
    const totalPrice = orders.reduce((sum,o)=>sum+(o.price||0),0);
    s+=`\nSumme:\nAnzahl Positionen: ${orders.length} | Total: CHF ${totalPrice.toFixed(2)}\n`;

    summaryTextArea.value=s; summaryOutputSection.style.display='block'; autoResizeTextarea(summaryTextArea);
    return;
  }
  const remote=window.__REMOTE_DATA__;
  if(Array.isArray(remote)&&remote.length){
    const s=buildRemoteSummaryText(remote);
    summaryTextArea.value=s; summaryOutputSection.style.display='block'; autoResizeTextarea(summaryTextArea);
    return;
  }
  alert('Keine Bestellungen vorhanden (weder lokal noch vom Google Sheet). Bitte zuerst laden oder erfassen.');
}
function downloadCsv(){
  if(!orders.length) return;
  const rows=[['Nr','Name','Artikel','Groesse','Preis','Bemerkungen']];
  orders.forEach((o,i)=>rows.push([String(i+1),o.name,o.itemName||o.pizzaName||'',o.size||'',String(o.price.toFixed(2)),o.comments||'']));
  const csv=rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='pizza-bestellungen_local.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

/* =========================================================================
   10) Init
   ========================================================================= */
document.addEventListener('DOMContentLoaded',()=>{
  ensureSharedSecret();
  // Theme init
  try{
    const savedTheme=localStorage.getItem('theme');
    const prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme=(savedTheme==='dark'||savedTheme==='light')? savedTheme: (prefersDark? 'dark':'light');
    document.documentElement.setAttribute('data-theme', theme);
    const tgl=document.getElementById('theme-toggle');
    if(tgl){
      const apply=(th)=>{ document.documentElement.setAttribute('data-theme', th); localStorage.setItem('theme', th); tgl.setAttribute('aria-pressed', String(th==='dark')); tgl.textContent = th==='dark' ? '☀️' : '🌙'; tgl.title = th==='dark' ? 'Heller Modus' : 'Dunkler Modus'; try{ updateDeliveryMap(); }catch(e){} };
      apply(theme);
      tgl.addEventListener('click',()=>{ const cur=document.documentElement.getAttribute('data-theme')==='dark'?'dark':'light'; apply(cur==='dark'?'light':'dark'); });
    }
  }catch(e){}
  initOrderTypeRadios();
  populatePizzaDropdown(); populateSaladDropdown(); populateDressingDropdown(); populateDrinkDropdown();
  updateSelectionVisibility();
  updatePricePreview();
  // Zutaten-Details initial und bei Auswahlwechsel aktualisieren
  pizzaSelect?.addEventListener('change', updatePizzaDetails);
  updatePizzaDetails();
  saladSelect?.addEventListener('change', updateSaladDetails);
  updateSaladDetails();
  // Placeholder-Färbung für Selects
  pizzaSelect?.addEventListener('change', ()=>updateSelectPlaceholderState(pizzaSelect));
  saladSelect?.addEventListener('change', ()=>updateSelectPlaceholderState(saladSelect));
  dressingSelect?.addEventListener('change', ()=>updateSelectPlaceholderState(dressingSelect));
  drinkSelect?.addEventListener('change', ()=>updateSelectPlaceholderState(drinkSelect));
  updateSelectPlaceholderState(pizzaSelect);
  updateSelectPlaceholderState(saladSelect);
  updateSelectPlaceholderState(dressingSelect);
  updateSelectPlaceholderState(drinkSelect);
  adminSection.style.display='none'; if(toggleAdminBtn){ toggleAdminBtn.setAttribute('aria-expanded','false'); }
  updateDateTimeDisplay();

  try{
    const savedAddress=localStorage.getItem('deliveryAddress');
    const savedOrderer=localStorage.getItem('ordererName');
    const savedPhone=localStorage.getItem('ordererPhone');
    const savedHeader=localStorage.getItem('headerImage');
    const savedSupplierName=localStorage.getItem('supplierName');
    const savedSupplierPhone=localStorage.getItem('supplierPhone');
    const savedSupplierEmail=localStorage.getItem('supplierEmail');
    const savedMapsKey=localStorage.getItem('mapsApiKey');
    if(deliveryAddressInput&&savedAddress) deliveryAddressInput.value=savedAddress;
    if(ordererNameInput&&savedOrderer) ordererNameInput.value=savedOrderer;
    if(ordererPhoneInput&&savedPhone) ordererPhoneInput.value=savedPhone;
    if(headerImageElement&&savedHeader) headerImageElement.src=savedHeader;
    if(supplierNameInput&&savedSupplierName) supplierNameInput.value=savedSupplierName;
    if(supplierPhoneInput&&savedSupplierPhone) supplierPhoneInput.value=savedSupplierPhone;
    if(supplierEmailInput&&savedSupplierEmail) supplierEmailInput.value=savedSupplierEmail;
    if(mapsApiKeyInput&&savedMapsKey) mapsApiKeyInput.value=savedMapsKey;
    loadOrdersFromStorage(); if(orders.length) updateOrdersTable();
  }catch(e){}
  updateDeliveryMap();

  if(ordererPhoneInput){
    ordererPhoneInput.addEventListener('blur',()=>{
      const raw=ordererPhoneInput.value||''; const d=raw.replace(/\D/g,'');
      if(d.length===10){ ordererPhoneInput.value=`${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6,8)} ${d.slice(8,10)}`; }
      else if(raw.trim()!=='' && !/^0\d{2}\s\d{3}\s\d{2}\s\d{2}$/.test(raw.trim())){ alert('Bitte Telefonnummer im Format 077 400 40 40 eingeben.'); }
    });
  }

  $('#save-admin-data')?.addEventListener('click',()=>{
    if(deliveryAddressInput) localStorage.setItem('deliveryAddress',deliveryAddressInput.value.trim());
    if(ordererNameInput)     localStorage.setItem('ordererName',ordererNameInput.value.trim());
    if(ordererPhoneInput)    localStorage.setItem('ordererPhone',ordererPhoneInput.value.trim());
    if(supplierNameInput)    localStorage.setItem('supplierName',supplierNameInput.value.trim());
    if(supplierPhoneInput)   localStorage.setItem('supplierPhone',supplierPhoneInput.value.trim());
    if(supplierEmailInput)   localStorage.setItem('supplierEmail',supplierEmailInput.value.trim());
    if(mapsApiKeyInput)      localStorage.setItem('mapsApiKey',mapsApiKeyInput.value.trim());
    if(orderDateInput)       localStorage.setItem('orderDate',orderDateInput.value||'');
    if(orderTimeInput)       localStorage.setItem('orderTime',orderTimeInput.value||'');
    saveDeadlineToStorage();
    alert('Admin-Daten gespeichert.');
  });
  $('#clear-admin-data')?.addEventListener('click',()=>{
    localStorage.removeItem('deliveryAddress');
    localStorage.removeItem('ordererName');
    localStorage.removeItem('ordererPhone');
    localStorage.removeItem('supplierName');
    localStorage.removeItem('supplierPhone');
    localStorage.removeItem('supplierEmail');
    localStorage.removeItem('mapsApiKey');
    localStorage.removeItem('orderDeadlineDate');
    localStorage.removeItem('orderDeadlineTime');
    alert('Gespeicherte Admin-Daten gelöscht.');
  });

  // Alle lokalen Bestellungen löschen (und remote, falls unterstützt)
  document.getElementById('clear-orders-btn')?.addEventListener('click', async ()=>{
    if(!confirm('Alle lokalen Bestellungen löschen? (Remote wird, falls konfiguriert, ebenfalls geleert)')) return;
    const btn = document.getElementById('clear-orders-btn');
    if(btn){ btn.disabled=true; btn.textContent='Lösche…'; }
    try{
      orders.splice(0,orders.length);
      saveOrdersToStorage();
      updateOrdersTable();
      const statusEl = document.getElementById('remote-status');
      if(statusEl) statusEl.textContent = 'Remote: versuche ClearAll…';
      await clearAllOrdersInGoogle();
      // Fallback: Wenn clearAll nicht greift, per Einzel-Löschung arbeiten
      if(statusEl) statusEl.textContent = 'Remote: prüfe und lösche einzeln…';
      await sleep(500);
      const removed = await clearRemoteByIteration();
      // Tabelle am Ende aktualisieren
      await loadOrdersFromGoogle();
      showToast(`Alle Bestellungen gelöscht${removed?` (${removed} remote)`:''}.`);
    }catch(e){ console.warn(e); showToast('Fehler beim Löschen. Bitte erneut versuchen.'); }
    finally{
      if(btn){ btn.disabled=false; btn.textContent='Alle Bestellungen löschen'; }
    }
  });

  // Datum/Uhrzeit zurücksetzen
  document.getElementById('reset-order-datetime')?.addEventListener('click',()=>{
    if(orderDateInput) orderDateInput.value='';
    if(orderTimeInput) orderTimeInput.value='';
    try{ localStorage.removeItem('orderDate'); localStorage.removeItem('orderTime'); }catch(e){}
    updateDateTimeDisplay();
    showToast('Datum/Uhrzeit zurückgesetzt.');
  });

  // Order-Datum/Uhrzeit laden und anzeigen
  loadOrderDateTimeFromStorage();
  loadDeadlineFromStorage(); checkOrderDeadline(); setInterval(checkOrderDeadline,60*1000);
  deadlineDateInput?.addEventListener('change',()=>{ saveDeadlineToStorage(); checkOrderDeadline(); });
  deadlineTimeInput?.addEventListener('change',()=>{ saveDeadlineToStorage(); checkOrderDeadline(); });

  // Preisvorschau Trigger
  document.querySelectorAll('input[name="order-type"]').forEach(r=>r.addEventListener('change',updatePricePreview));
  pizzaSelect?.addEventListener('change',updatePricePreview);
  saladSelect?.addEventListener('change',updatePricePreview);
  dressingSelect?.addEventListener('change',updatePricePreview);
  drinkSelect?.addEventListener('change',updatePricePreview);
  sizeSelect?.addEventListener('change',updatePricePreview);
  glutenFreeCheckbox?.addEventListener('change',updatePricePreview);
  // (Pizza-Suche entfernt)

  orderForm?.addEventListener('submit', addOrder);
  generateSummaryBtn?.addEventListener('click', generateSummary);
  downloadCsvBtn?.addEventListener('click', downloadCsv);
  copySummaryBtn?.addEventListener('click', ()=>{ summaryTextArea?.select(); document.execCommand('copy'); showToast('Übersicht kopiert.'); });

  // Auto-Resize initialisieren
  if(summaryTextArea){ autoResizeTextarea(summaryTextArea); }
  const remoteBoxInit=document.getElementById('remote-summary-text');
  if(remoteBoxInit){ autoResizeTextarea(remoteBoxInit); remoteBoxInit.addEventListener('input', (e)=>autoResizeTextarea(e.target)); }

  // E-Mail Buttons
  document.getElementById('email-summary')?.addEventListener('click',()=>{
    const body=encodeURIComponent(summaryTextArea?.value||'');
    if(!body){ alert('Bitte zuerst die Übersicht generieren.'); return; }
    const to=(document.getElementById('supplier-email')?.value||'').trim()||'info@dieci.ch';
    const subj=encodeURIComponent('Pizza-Bestellung (KAIZEN)');
    window.location.href=`mailto:${to}?subject=${subj}&body=${body}`;
  });
  document.getElementById('email-summary-2')?.addEventListener('click',()=>{
    const body=encodeURIComponent(summaryTextArea?.value||'');
    if(!body){ alert('Bitte zuerst die Übersicht generieren.'); return; }
    const to=(document.getElementById('supplier-email')?.value||'').trim()||'info@dieci.ch';
    const subj=encodeURIComponent('Pizza-Bestellung (KAIZEN)');
    window.location.href=`mailto:${to}?subject=${subj}&body=${body}`;
  });
  // Drucken (lokale Zusammenfassung)
  document.getElementById('print-summary')?.addEventListener('click',()=>{
    const text=summaryTextArea?.value||'';
    if(!text){ alert('Bitte zuerst die Übersicht generieren.'); return; }
    printContent('Pizza-Bestellung – Übersicht', text);
  });
  document.getElementById('print-summary-2')?.addEventListener('click',()=>{
    const text=summaryTextArea?.value||'';
    if(!text){ alert('Bitte zuerst die Übersicht generieren.'); return; }
    printContent('Pizza-Bestellung – Übersicht', text);
  });
  document.getElementById('copy-remote-summary')?.addEventListener('click',()=>{
    const box=document.getElementById('remote-summary-text'); if(!box) return; box.select(); document.execCommand('copy'); showToast('Übersicht kopiert.'); autoResizeTextarea(box);
  });
  document.getElementById('email-remote-summary')?.addEventListener('click',()=>{
    const body=encodeURIComponent(document.getElementById('remote-summary-text')?.value||'');
    if(!body){ alert('Bitte zuerst vom Sheet laden oder Übersicht aktualisieren.'); return; }
    const to=(document.getElementById('supplier-email')?.value||'').trim()||'info@dieci.ch';
    const subj=encodeURIComponent('Pizza-Bestellung (KAIZEN)');
    window.location.href=`mailto:${to}?subject=${subj}&body=${body}`;
  });
  // Drucken (Remote-Zusammenfassung)
  document.getElementById('print-remote-summary')?.addEventListener('click',()=>{
    const box=document.getElementById('remote-summary-text');
    const text=box?.value||'';
    if(!text){ alert('Bitte zuerst vom Sheet laden oder Übersicht aktualisieren.'); return; }
    printContent('Pizza-Bestellung – Übersicht (Sheet)', text);
  });

  toggleAdminBtn?.addEventListener('click', toggleAdminSection);

  // Admin login modal behavior
  adminPasswordToggle?.addEventListener('click', ()=>{
    if(!adminPasswordInput) return;
    const isPw = adminPasswordInput.type==='password';
    adminPasswordInput.type = isPw? 'text':'password';
  });
  const tryLogin=()=>{
    const val=(adminPasswordInput?.value||'');
    if(val!==ADMIN_PASSWORD){ alert('Falsches Passwort.'); return; }
    adminAccessGranted=true; hideAdminLogin();
    // Open admin section now
    adminSection.style.display='block';
    pageTitleInputField.value=pageTitleElement?.textContent||'';
    pageDescriptionInputField.value=pageDescriptionElement?.textContent||'';
    ensureSharedSecret(); loadOrdersFromGoogle(); startRemoteAutoReload();
  };
  adminLoginConfirm?.addEventListener('click', tryLogin);
  adminLoginCancel?.addEventListener('click', ()=>{ hideAdminLogin(); adminAccessGranted=false; });
  adminPasswordInput?.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); tryLogin(); }});

  headerImageInput?.addEventListener('change',(e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{ const dataUrl=reader.result; if(headerImageElement) headerImageElement.src=dataUrl; try{localStorage.setItem('headerImage',dataUrl);}catch(e){} };
    reader.readAsDataURL(file);
  });
  resetHeaderImageBtn?.addEventListener('click',()=>{
    try{localStorage.removeItem('headerImage');}catch(e){}
    const def=headerImageElement?.getAttribute('data-default');
    if(headerImageElement) headerImageElement.src=def||'pizza-illustration.png';
    if(headerImageInput) headerImageInput.value='';
    alert('Header-Bild wurde zurückgesetzt.');
  });

  orderDateInput?.addEventListener('change', ()=>{ saveOrderDateTimeToStorage(); });
  orderTimeInput?.addEventListener('change', ()=>{ saveOrderDateTimeToStorage(); });
  // Map preview bind
  deliveryAddressInput?.addEventListener('input', debounce(updateDeliveryMap, 400));
  mapsApiKeyInput?.addEventListener('input', debounce(updateDeliveryMap, 400));
  // Pixabay bindings
  try{ const savedPixabayKey=localStorage.getItem('pixabayApiKey'); if(pixabayApiKeyInput && savedPixabayKey) pixabayApiKeyInput.value=savedPixabayKey; }catch(e){}
  pixabayApiKeyInput?.addEventListener('blur',()=>{ try{ localStorage.setItem('pixabayApiKey', (pixabayApiKeyInput.value||'').trim()); }catch(e){} });
  pixabaySearchBtn?.addEventListener('click',()=>{ searchPixabay(pixabaySearchInput?.value||''); });
  pixabaySearchInput?.addEventListener('keydown',(e)=>{ if(e.key==='Enter'){ e.preventDefault(); searchPixabay(pixabaySearchInput?.value||''); }});

  ensureRemoteUI();
});
