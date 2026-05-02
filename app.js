/* AMPM — Checklist Operativo GZ (v3)
   Offline/Online (PWA). 1=Cumple, 0=No cumple.
   Autor: generado para AMPM
*/

/* =========================
   CONFIGURACIÓN
========================= */

// Pegá aquí el Web App URL de Apps Script (el que termina en /exec)
// Ej: https://script.google.com/macros/s/XXXX/exec
const SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzJQwiOq1xRUN1_kHvXBf5POr10jKfTtEmQguQm2UpoLNIPWn4lbtfT_ulvlYCcX74u1Q/exec";
// Alias usado en partes viejas del código (NO borrar)
const SCRIPT_URL = SCRIPT_WEB_APP_URL;
const FRONTEND_VERSION = "GZ-login-v4.2.9";
const STRICT_VERSION_MODE = true;
let backendVersionDetected = "";
let versionAlignmentState = "checking";
let evidences = [];
let usersCache = [];
let editingUser = null;
let isNewUserMode = true;

// Storage local
const LS_KEY = "ampm_checklist_gz_v3_evals";
const LS_SESSION_KEY = "ampm_checklist_gz_v3_session";
const LS_PENDING_KEY = "ampm_checklist_gz_pending_sync";
const LS_USERS_KEY = "ampm_checklist_gz_users_cache";
const LS_USERS_SYNC_KEY = "ampm_checklist_gz_users_cache_at";

// Umbrales de nivel
const THRESH_OP = 85;
const THRESH_RISK = 70;

/* =========================
   HELPERS UI
========================= */
const $ = (id) => document.getElementById(id);
function toast(msg, ms=2600){
  const el = $("toast");
  if(!el){ alert(msg); return; }
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"), ms);
}

function nowISO(){
  return new Date().toISOString();
}

function showPerfLoading(msg = "Cargando desempeño..."){
  const box = $("perfLoading");
  const txt = $("perfLoadingText");
  if(txt) txt.textContent = msg;
  if(box) box.classList.remove("hidden");
}

function hidePerfLoading(){
  const box = $("perfLoading");
  if(box) box.classList.add("hidden");
}

function setVersionStatus(appVersion, backendVersion, statusText, state = "unknown"){
  const box = $("versionBox");
  if(!box) return;

  backendVersionDetected = String(backendVersion || "").trim();
  versionAlignmentState = String(state || "unknown").trim().toLowerCase();

  box.textContent = `App: ${appVersion || "—"} | Backend: ${backendVersion || "—"} | Estado: ${statusText || "—"}`;
  box.style.fontWeight = "700";
  box.style.padding = "6px 10px";
  box.style.borderRadius = "10px";
  box.style.display = "inline-block";
  box.style.border = "1px solid rgba(255,255,255,0.12)";

  if(versionAlignmentState === "aligned"){
    box.style.background = "rgba(15,157,88,0.18)";
    box.style.color = "#b7f7cd";
  }else if(versionAlignmentState === "misaligned"){
    box.style.background = "rgba(217,48,37,0.22)";
    box.style.color = "#ffd5d1";
  }else{
    box.style.background = "rgba(245,124,0,0.18)";
    box.style.color = "#ffe1b3";
  }
}

async function checkVersionAlignment(showToastOnMismatch = true){
  if(!SCRIPT_URL){
    setVersionStatus(FRONTEND_VERSION, "—", "Sin backend", "unavailable");
    return false;
  }

  try{
    const sep = SCRIPT_URL.includes("?") ? "&" : "?";
    const url = `${SCRIPT_URL}${sep}version=1&_ts=${Date.now()}`;

    const resp = await fetch(url, { method: "GET", cache: "no-store" });
    if(!resp.ok){
      setVersionStatus(FRONTEND_VERSION, "—", "Backend no disponible", "unavailable");
      return false;
    }

    const data = await resp.json();
    const backendVersion = String(data?.version || "").trim();

    if(!backendVersion){
      setVersionStatus(FRONTEND_VERSION, "—", "Sin versión backend", "unavailable");
      return false;
    }

    const aligned = backendVersion === FRONTEND_VERSION;

    setVersionStatus(
      FRONTEND_VERSION,
      backendVersion,
      aligned ? "Alineado ✅" : "Desalineado ⚠️",
      aligned ? "aligned" : "misaligned"
    );

    if(!aligned && showToastOnMismatch){
      toast(`Versión desalineada: App ${FRONTEND_VERSION} / Backend ${backendVersion}`, 5000);
    }

    return aligned;
  }catch(e){
    console.error("Error consultando versión:", e);
    setVersionStatus(FRONTEND_VERSION, "—", "No disponible", "unavailable");
    return false;
  }
}

function isVersionBlocked(actionLabel = "usar la app"){
  if(!STRICT_VERSION_MODE) return false;

  if(versionAlignmentState === "misaligned"){
    toast(`Bloqueado: la app está desalineada. No se puede ${actionLabel}.`, 4500);
    return true;
  }

  return false;
}

function escapeCSV(value){
  const s = (value ?? "").toString().replaceAll('"', '""');
  return `"${s}"`;
}

function handleMailReturn(){
  const params = new URLSearchParams(window.location.search);
  const status = params.get("mailStatus");
  const msg = params.get("mailMsg") || "";
  const syncId = params.get("syncId") || "";

  if(!status) return;

  if(status === "ok" && syncId){
    const list = loadEvals();
    const idx = list.findIndex(x => x.id === syncId);

    if(idx >= 0){
      list[idx].synced = true;
      list[idx].syncedAt = nowISO();
      list[idx].updatedAt = nowISO();
      list[idx].result = list[idx].result || computeResult(list[idx]);
      list[idx].evidences = [];
      saveEvals(list);
    }

    current = null;
    qIdx = 0;
    evidences = [];
    show("screenStart");
    toast("Correo enviado ✅ Listo para nueva evaluación", 3200);
  } else {
    toast("Error al enviar correo: " + msg, 4200);
  }

  const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
  window.history.replaceState({}, document.title, cleanUrl);
}
function handleMailMessage(event){
  const data = event && event.data ? event.data : null;
  if(!data || data.type !== "ampm-mail-result") return;

  const ok = !!data.ok;
  const msg = String(data.msg || "");
  const syncId = String(data.syncId || "");

  if(ok && syncId){
    const list = loadEvals();
    const idx = list.findIndex(x => x.id === syncId);

    if(idx >= 0){
  list[idx].synced = true;
  list[idx].syncedAt = nowISO();
  list[idx].updatedAt = nowISO();
  list[idx].result = list[idx].result || computeResult(list[idx]);
  list[idx].evidences = [];
  saveEvals(list);
}

    current = null;
    qIdx = 0;
    show("screenStart");

    try { window.focus(); } catch(e) {}

    toast("Correo enviado ✅ Listo para nueva evaluación", 3200);
  } else {
    toast("Error al enviar correo: " + msg, 4200);
  }
}

async function loginUser(){
  const user = ($("loginUser")?.value || "").trim();
  const pass = ($("loginPass")?.value || "").trim();
  const msgEl = $("loginMsg");

  if(msgEl) msgEl.textContent = "";

  if(!user){
    if(msgEl) msgEl.textContent = "Ingresá el usuario";
    return;
  }

  if(!pass){
    if(msgEl) msgEl.textContent = "Ingresá la contraseña";
    return;
  }

  if (!navigator.onLine) {
  const localUsers = loadUsersCache();
  const found = localUsers.find(x =>
    String(x.username || "").trim().toLowerCase() === user.toLowerCase()
  );

  if (!found) {
    if (msgEl) msgEl.textContent = "Usuario no disponible sin internet";
    return;
  }

  if (String(found.active || "SI").toUpperCase() !== "SI") {
    if (msgEl) msgEl.textContent = "Usuario inactivo";
    return;
  }

  const savedHash = String(found.passwordHash || "");
  const inputHash = btoa(pass);

  if (!savedHash || savedHash !== inputHash) {
    if (msgEl) msgEl.textContent = "Contraseña inválida";
    return;
  }

  saveSession(found);
  updateSessionUI();
  applySessionToForm();
  applyRoleUI();
  if (msgEl) msgEl.textContent = "";
  toast(`Bienvenido ${found.name} ✅ (offline)`, 2500);
  show("screenStart");
  return;
}

  try{
    const data = await jsonpRequest(
      `${SCRIPT_URL}?login=1&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}`,
      8000
    );

    if(!data || !data.ok || !data.user){
      if(msgEl) msgEl.textContent = (data && data.error) ? data.error : "No se pudo iniciar sesión";
      return;
    }

    if(data.user.mustChangePassword){
      pendingPasswordUser = data.user.username;

      const newPassEl = $("changePassNew");
      const confirmEl = $("changePassConfirm");
      const changeMsgEl = $("changePassMsg");

      if(newPassEl) newPassEl.value = "";
      if(confirmEl) confirmEl.value = "";
      if(changeMsgEl) changeMsgEl.textContent = "";

      show("screenChangePassword");
      return;
    }

    saveSession(data.user);
    const localUsers = loadUsersCache();
const idx = localUsers.findIndex(x => String(x.username || "").toLowerCase() === String(data.user.username || "").toLowerCase());

const offlineUser = {
  username: data.user.username || "",
  name: data.user.name || "",
  role: data.user.role || "",
  district: data.user.district || "",
  zone: data.user.zone || "",
  active: data.user.active || "SI",
  mustChangePassword: data.user.mustChangePassword || "NO",
  passwordHash: btoa(pass)
};

if (idx >= 0) {
  localUsers[idx] = { ...localUsers[idx], ...offlineUser };
} else {
  localUsers.push(offlineUser);
}

    saveUsersCache(localUsers);
    updateSessionUI();
    applySessionToForm();
    applyRoleUI();
    if(msgEl) msgEl.textContent = "";
    toast(`Bienvenido ${data.user.name} ✅`, 2500);
    show("screenStart");

  }catch(e){
  console.error("Error login:", e);
  if(msgEl) msgEl.textContent = "Error validando acceso: " + (e?.message || e);
}
}

async function saveNewPassword(){
  const newPass = ($("changePassNew")?.value || "").trim();
  const confirmPass = ($("changePassConfirm")?.value || "").trim();
  const msgEl = $("changePassMsg");

  if(msgEl) msgEl.textContent = "";

  if(!pendingPasswordUser){
    if(msgEl) msgEl.textContent = "No hay usuario pendiente para actualizar contraseña";
    return;
  }

  if(!newPass){
    if(msgEl) msgEl.textContent = "Ingresá la nueva contraseña";
    return;
  }

  if(newPass.length < 4){
    if(msgEl) msgEl.textContent = "La contraseña debe tener al menos 4 caracteres";
    return;
  }

  if(!confirmPass){
    if(msgEl) msgEl.textContent = "Confirmá la nueva contraseña";
    return;
  }

  if(newPass !== confirmPass){
    if(msgEl) msgEl.textContent = "Las contraseñas no coinciden";
    return;
  }

  try{
    const changeData = await jsonpRequest(
      `${SCRIPT_URL}?changePass=1&user=${encodeURIComponent(pendingPasswordUser)}&newPass=${encodeURIComponent(newPass)}`,
      8000
    );

    if(!changeData || !changeData.ok){
      if(msgEl) msgEl.textContent = (changeData && changeData.error) ? changeData.error : "No se pudo cambiar la contraseña";
      return;
    }

    const changedUser = pendingPasswordUser;

pendingPasswordUser = null;

const newPassEl = $("changePassNew");
const confirmEl = $("changePassConfirm");
const loginUserEl = $("loginUser");
const loginPassEl = $("loginPass");

if(newPassEl) newPassEl.value = "";
if(confirmEl) confirmEl.value = "";
if(msgEl) msgEl.textContent = "";

clearSession();
updateSessionUI();
applySessionToForm();

if(loginUserEl) loginUserEl.value = changedUser || "";
if(loginPassEl) loginPassEl.value = "";

show("screenLogin");
toast("Contraseña actualizada ✅ Ingresá con tu nueva clave", 3500);
return;

  }catch(e){
    console.error("Error cambiando contraseña:", e);
    if(msgEl) msgEl.textContent = "Error actualizando contraseña";
  }
}

function cancelPasswordChange(){
  pendingPasswordUser = null;

  const newPassEl = $("changePassNew");
  const confirmEl = $("changePassConfirm");
  const msgEl = $("changePassMsg");

  if(newPassEl) newPassEl.value = "";
  if(confirmEl) confirmEl.value = "";
  if(msgEl) msgEl.textContent = "";

  clearSession();
  updateSessionUI();
  applyRoleUI();
  show("screenLogin");
}

function logoutUser(){
  clearSession();
  updateSessionUI();
  applyRoleUI();

  const userEl = $("loginUser");
  const passEl = $("loginPass");
  const msgEl = $("loginMsg");

  if(userEl) userEl.value = "";
  if(passEl) passEl.value = "";
  if(msgEl) msgEl.textContent = "";

applySessionToForm();

current = null;
qIdx = 0;

toast("Sesión cerrada", 2000);
show("screenLogin");
}
/* =========================
   DATA (local)
========================= */
function loadEvals(){
  try{
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  }catch(e){
    return [];
  }
}

function saveEvals(list){
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

function saveSession(user){
  localStorage.setItem(LS_SESSION_KEY, JSON.stringify(user || {}));
}

function loadSession(){
  try{
    return JSON.parse(localStorage.getItem(LS_SESSION_KEY) || "null");
  }catch(e){
    return null;
  }
}

function saveUsersCache(list) {
  localStorage.setItem(LS_USERS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  localStorage.setItem(LS_USERS_SYNC_KEY, nowISO());
}

function loadUsersCache() {
  try {
    return JSON.parse(localStorage.getItem(LS_USERS_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

function getUsersCacheDate() {
  return localStorage.getItem(LS_USERS_SYNC_KEY) || "";
}

function loadPendingQueue() {
  try {
    return JSON.parse(localStorage.getItem(LS_PENDING_KEY) || "[]");
  } catch {
    return [];
  }
}

function savePendingQueue(queue) {
  localStorage.setItem(LS_PENDING_KEY, JSON.stringify(queue));
}

function addToPendingQueue(payload) {
  const queue = loadPendingQueue();
  queue.push({
  id: Date.now(),
  createdAt: new Date().toISOString(),
  payload: {
    ...payload,
    audit: {
      ...(payload.audit || {}),
      origenEnvio: "PENDIENTE_OFFLINE"
    }
  }
});
  savePendingQueue(queue);
  updatePendingSyncBadge();
}

function updatePendingSyncBadge() {
  const queue = loadPendingQueue();
  console.log("Pendientes por sincronizar:", queue.length);
}

async function sendEvaluationToBackend(payload) {
  const res = await fetch(SCRIPT_WEB_APP_URL, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    }
  });

  if (!res.ok) {
    throw new Error("No se pudo enviar la evaluación");
  }

  return await res.json();
}

function sendPendingPayloadWithPopup(payload) {
  return new Promise((resolve, reject) => {
    const popup = window.open("", "ampmMailSync", "width=720,height=760");

    if (!popup) {
      reject(new Error("El navegador bloqueó la ventana emergente"));
      return;
    }

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (form) form.remove();
    };

    const onMessage = (event) => {
      const data = event && event.data ? event.data : null;
      if (!data || data.type !== "ampm-mail-result") return;

      const sameSync = String(data.syncId || "") === String(payload.syncId || "");
      if (!sameSync) return;

      cleanup();

      if (data.ok) {
        resolve(data);
      } else {
        reject(new Error(data.msg || "Error enviando pendiente"));
      }
    };

    window.addEventListener("message", onMessage);

    const form = document.createElement("form");
    form.method = "POST";
    form.action = SCRIPT_URL;
    form.target = "ampmMailSync";
    form.style.display = "none";

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "payload";
    input.value = JSON.stringify(payload);
    form.appendChild(input);

    document.body.appendChild(form);
    form.submit();
  });
}

async function flushPendingQueue() {
  const queue = loadPendingQueue();
  if (!queue.length) return;

  if (!navigator.onLine) return;

  const remaining = [];

  for (const item of queue) {
    try {
      await sendPendingPayloadWithPopup(item.payload);

      const syncId = String(item?.payload?.syncId || "");
      if (syncId) {
        const list = loadEvals();
        const idx = list.findIndex(x => String(x.id) === syncId);

        if (idx >= 0) {
        list[idx].synced = true;
        list[idx].syncedAt = nowISO();
        list[idx].updatedAt = nowISO();
        list[idx].result = list[idx].result || computeResult(list[idx]);
        list[idx].evidences = [];
        saveEvals(list);
      }
      }
    } catch (err) {
      remaining.push(item);
      console.error("Pendiente no enviado:", err);
    }
  }

  savePendingQueue(remaining);
  updatePendingSyncBadge();

  if (!remaining.length) {
    toast("Pendientes sincronizados ✅", 3000);
  }
}

function clearSession(){
  localStorage.removeItem(LS_SESSION_KEY);
}

function updateSessionUI(){
  const session = loadSession();
  const userLbl = $("sessionUser");
  const btnLogout = $("btnLogout");

  if(userLbl){
    userLbl.textContent = session?.name
      ? `Sesión: ${session.name}`
      : "";
  }

  if(btnLogout){
    btnLogout.classList.toggle("hidden", !session?.username);
  }
}

function applySessionToForm(){
  const session = loadSession();
  const inGZ = $("inGZ");
  const inZone = $("inZone");

  if(inGZ){
    inGZ.value = session?.name || "";
  }

  if(inZone){
    inZone.value = session?.zone || "";
  }
}

function upsertEval(ev){
  const safeEv = {
    ...ev,
    evidences: [],
    _tempEvidences: [] // NUNCA guardar fotos temporales en localStorage
  };

  const list = loadEvals();
  const idx = list.findIndex(x=>x.id===safeEv.id);

  if(idx>=0) list[idx]=safeEv;
  else list.unshift(safeEv);

  saveEvals(list);
}

function deleteEval(id){
  const list = loadEvals().filter(x=>x.id!==id);
  saveEvals(list);
}

function matchesHistorySearch(ev, term){
  if(!term) return true;

  const r = ev.result || {
    pct: Number(ev.pct || 0),
    level: String(ev.level || "Crítica"),
    ok: Number(ev.okCount ?? ev.ok ?? 0),
    total: Number(ev.total || 0)
  };

  const q = term.toLowerCase();

  const fields = [
   ev.id,
   ev.store,
   ev.gz,
   ev.zone || "",
   ev.dateISO,
    formatDateTime(ev.dateISO),
    r.level,
    String(r.pct),
    String(r.ok),
    String(r.total),
    ev.generalNote || ""
  ].map(x => (x ?? "").toString().toLowerCase());

  return fields.some(x => x.includes(q));
}

function jsonpRequest(url, timeoutMs = 8000){
  return new Promise((resolve, reject) => {
    const cbName = "jsonp_cb_" + Math.random().toString(36).slice(2);
    const sep = url.includes("?") ? "&" : "?";
    const fullUrl = `${url}${sep}callback=${cbName}&_ts=${Date.now()}`;

    let finished = false;
    let script = document.createElement("script");

    const cleanup = () => {
      if (script && script.parentNode) script.parentNode.removeChild(script);
      try { delete window[cbName]; } catch(e) {}
    };

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error("Tiempo agotado al cargar historial remoto"));
    }, timeoutMs);

    window[cbName] = (data) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      cleanup();
      resolve(data);
    };

    script.src = fullUrl;
    script.async = true;

    script.onerror = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      cleanup();
      reject(new Error("No se pudo cargar JSONP"));
    };

    document.body.appendChild(script);
  });
}

async function loadRemoteHistory(){
  if(!SCRIPT_URL) return [];

  try{
    const session = loadSession();
const username = encodeURIComponent(session?.username || "");
const role = encodeURIComponent(session?.role || "");
const district = encodeURIComponent(session?.district || "");

const data = await jsonpRequest(
  `${SCRIPT_URL}?history=1&username=${username}&role=${role}&district=${district}`,
  8000
);

    if(!data){
      console.error("Historial remoto vacío");
      remoteHistory = [];
      return [];
    }

    if(!data.ok){
      console.error("Error backend historial:", data.error || data);
      remoteHistory = [];
      return [];
    }

    if(!Array.isArray(data.items)){
      console.error("Formato inesperado en historial remoto:", data);
      remoteHistory = [];
      return [];
    }

    remoteHistory = data.items;
    return remoteHistory;
  }catch(e){
    console.error("Error cargando historial remoto:", e);
    remoteHistory = [];
    return [];
  }
}

async function loadRemoteEvaluation(id){
  if(!SCRIPT_URL || !id) return null;

  const cacheKey = String(id || "").trim();
  if(!cacheKey) return null;

  if(performanceDetailCache.has(cacheKey)){
    return performanceDetailCache.get(cacheKey);
  }

  try{
    const session = loadSession();
    const username = encodeURIComponent(session?.username || "");
    const role = encodeURIComponent(session?.role || "");
    const district = encodeURIComponent(session?.district || "");

    const data = await jsonpRequest(
      `${SCRIPT_URL}?detail=1&id=${encodeURIComponent(cacheKey)}&username=${username}&role=${role}&district=${district}`
    );

    if(!data || !data.ok || !data.item) return null;

    const ev = data.item;
    ev.result = computeResult(ev);

    performanceDetailCache.set(cacheKey, ev);
    return ev;
  }catch(e){
    console.error("Error cargando detalle remoto:", e);
    return null;
  }
}

function mergeHistoryLists(localList, remoteList){
  const map = new Map();

  remoteList.forEach(ev => {
    map.set(ev.id, {
      ...ev,
      source: "sheet",
      synced: true
    });
  });

  localList.forEach(ev => {
    if(map.has(ev.id)){
      const remoteEv = map.get(ev.id);
      map.set(ev.id, {
        ...remoteEv,
        ...ev,
        source: "local+sheet",
        synced: true,
        syncedAt: remoteEv.syncedAt || ev.syncedAt || null
      });
    } else {
      map.set(ev.id, { ...ev, source: "local" });
    }
  });

  return Array.from(map.values()).sort((a,b)=>
    String(b.dateISO || "").localeCompare(String(a.dateISO || ""))
  );
}
/* =========================
   QUESTIONS / SESSION
========================= */
let current = null; // evaluación actual
let qIdx = 0;       // índice de pregunta
let remoteHistory = [];
let areaChartInstance = null;
let pendingPasswordUser = null;
let performanceChartInstance = null;
let performanceAreaChartInstance = null;
let performanceStoreChartInstance = null;
let performanceDataCache = [];
let performanceDetailCache = new Map();
let selectedPerformanceWeek = "";
let performanceWeekLoadCache = new Set();
let selectedPerformanceArea = "";
let selectedPerformanceStore = "";

function populateStores(){
  const input = $("inStore");
  if(!input) return;
  input.value = "";
  updateStorePreview();
}

function updateStorePreview(){
  const input = $("inStore");
  const preview = $("storePreview");
  if(!preview) return;

  const value = (input?.value || "").trim();

  if(!value){
    preview.textContent = "Tienda final: —";
    return;
  }

  preview.textContent = `Tienda final: AMPM ${value}`;
}
function validateStart(){
  const storeNumber = ($("inStore").value || "").trim();
  const gz = $("inGZ").value?.trim();
  const zone = $("inZone")?.value?.trim() || "";
  const date = $("inDate").value;
  const time = $("inTime").value;

  if(!storeNumber){
    toast("Falta número de tienda");
    return null;
  }

  if(!/^\d+$/.test(storeNumber)){
    toast("La tienda debe ser solo número");
    return null;
  }

  if(!gz){
    toast("Falta GZ");
    return null;
  }

  if(!date){
    toast("Falta Fecha");
    return null;
  }

  if(!time){
    toast("Falta Hora");
    return null;
  }

  const store = `AMPM ${storeNumber}`;
 const emailRaw = ($("inEmailTo")?.value || "").trim();
const emails = parseEmails(emailRaw);

if(!emails.length){
  toast("Falta correo destino");
  return null;
}

const invalidEmails = emails.filter(x => !isValidEmail(x));
if(invalidEmails.length){
  toast("Correo(s) no válido(s): " + invalidEmails.join(", "));
  return null;
}

const uniqueEmails = [...new Set(emails.map(x => x.toLowerCase()))];
const emailTo = uniqueEmails.join(",");
  return { store, gz, zone, date, time, emailTo };
}

function parseEmails(value){
  return String(value || "")
    .split(/[;,]+/)
    .map(x => x.trim())
    .filter(Boolean);
}

function isValidEmail(email){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function startEval(){
    if(isVersionBlocked("iniciar una evaluación")) return;

   if(!canEvaluate()){
    toast("Este usuario no tiene permiso para evaluar");
    return;
  }

  const meta = validateStart();
  if(!meta) return;

  const id = crypto.randomUUID ? crypto.randomUUID() : ("id_"+Math.random().toString(16).slice(2));
  
  const session = loadSession();

current = {
  id,
  store: meta.store,
  gz: meta.gz,
  zone: meta.zone || session?.zone || "",
  username: session?.username || "",
  role: session?.role || "",
  district: session?.district || "",
  dateISO: meta.date + "T" + meta.time + ":00",
  createdAt: nowISO(),
  updatedAt: nowISO(),
  emailTo: meta.emailTo,
  answers: [],
  generalNote: "",
  maintenanceNote: "",
  marketingNote: "",
  evidences: [],
  synced: false,
  syncedAt: null
};

  qIdx = 0;
  current.answers = (window.QUESTIONS || []).map(q=>({
  qid: q.id,
  area: q.area,
  text: (q.text || q.texto || q.pregunta || q.question || "").trim(),
  val: null,
  note: ""
}));

  upsertEval(current);
  renderQuestion();
  show("screenCheck");
  evidences = [];
  updatePhotoCounter();
  renderPhotoList();
}

function renderQuestion(){
  if(!current) return;
  const a = current.answers[qIdx];
  if(!a){ finishEval(); return; }

  $("kArea").textContent = a.area;
  $("kQuestion").textContent = `Pregunta ${qIdx + 1}`;
  const qt = document.getElementById("kQuestionText");
  if(qt) qt.textContent = a.text || "—";
  const notes = $("kNotes");
  if(notes) notes.value = a.note || "";
  $("kMeta").textContent = `Pregunta ${qIdx + 1} de ${current.answers.length}`;
  $("kProgress").textContent = `${qIdx + 1}/${current.answers.length}`;

  $("btnYes").classList.toggle("active", a.val===1);
  $("btnNo").classList.toggle("active", a.val===0);
}

function setAnswer(val){
  if(!current) return;
  saveCurrentNote();
  current.answers[qIdx].val = val;
  current.updatedAt = nowISO();
  upsertEval(current);

  qIdx++;
  renderQuestion();
}
function saveGeneralNotes(){
  if(!current) return;

  const generalEl = $("rGeneralNote");
  const maintenanceEl = $("rMaintenanceNote");
  const marketingEl = $("rMarketingNote");

  current.generalNote = generalEl ? (generalEl.value || "").trim() : "";
  current.maintenanceNote = maintenanceEl ? (maintenanceEl.value || "").trim() : "";
  current.marketingNote = marketingEl ? (marketingEl.value || "").trim() : "";
  current.updatedAt = nowISO();

  upsertEval(current);
}

function saveCurrentNote(){
  if(!current) return;
  const a = current.answers[qIdx];
  if(!a) return;

  const notes = $("kNotes");
  a.note = notes ? (notes.value || "").trim() : "";
  current.updatedAt = nowISO();
  upsertEval(current);
}

function goBack(){
  if(!current) return;
  if(qIdx<=0){ toast("Ya estás en la primera"); return; }
  saveCurrentNote();
  qIdx--;
  renderQuestion();
}

function cancelEval(){
  if(!current) return;
  saveCurrentNote();
  show("screenStart");
  toast("Evaluación en borrador guardada");
}

function finishEval(){
  if(!current) return;

  saveCurrentNote();

  current.answers.forEach(a=>{
    if(a.val===null) a.val = 0;
  });

  saveGeneralNotes();

  current._tempEvidences = evidences.map(ev => ({
  image: ev.image || "",
  note: ev.note || "",
  type: ev.type || "Operativo",
  sizeKB: Number(ev.sizeKB || 0)
}));

  current.result = computeResult(current);
current.updatedAt = nowISO();

// Guardamos la evaluación local SIN fotos pesadas
upsertEval({
  ...current,
  evidences: []
});

  renderResult(current);
  show("screenResult");
  toast("Evaluación cerrada ✅");
}

/* =========================
   RESULTADOS
========================= */
function computeResult(ev){
  const answers = Array.isArray(ev.answers) ? ev.answers : [];
  const total = answers.length;
  const ok = answers.reduce((acc,a)=>acc + (a.val===1 ? 1 : 0), 0);
  const pct = total ? Math.round((ok/total)*100) : 0;

  let level = "Crítica";
  if(pct >= THRESH_OP) level = "Operativa";
  else if(pct >= THRESH_RISK) level = "En riesgo";

  const byArea = {};
  answers.forEach(a=>{
    if(!byArea[a.area]) byArea[a.area] = { area:a.area, total:0, ok:0 };
    byArea[a.area].total += 1;
    byArea[a.area].ok += (a.val===1 ? 1 : 0);
  });

  const areaList = Object.values(byArea).map(x=>({
    area: x.area,
    ok: x.ok,
    total: x.total,
    pct: x.total ? Math.round((x.ok/x.total)*100) : 0
  })).sort((a,b)=>a.area.localeCompare(b.area));

  const fails = answers.filter(a=>a.val===0).map(a=>({
    area: a.area,
    text: a.text,
    note: (a.note || "").trim()
  }));

  return { total, ok, pct, level, areaList, fails };
}

function getAreaBreakdown(ev){
  const answers = Array.isArray(ev.answers) ? ev.answers : [];
  const map = {};

  answers.forEach(a => {
    if(!map[a.area]) map[a.area] = [];
    map[a.area].push({
      text: a.text || "",
      val: Number(a.val || 0),
      note: a.note || ""
    });
  });

  return map;
}

function renderAreaDetail(ev, areaName){
  const title = $("areaDetailTitle");
  const wrap = $("areaDetailList");

  if(!title || !wrap) return;

  const grouped = getAreaBreakdown(ev);
  const items = (grouped[areaName] || []).filter(item => Number(item.val) === 0);

  title.textContent = `Detalle del área: ${areaName}`;
  wrap.innerHTML = "";

  if(items.length === 0){
    wrap.innerHTML = `<div class="pill">Sin fallas en esta área 🎉</div>`;
    return;
  }

  items.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = "areaPoint fail";
    div.innerHTML = `
      <div class="areaPointTop">
        <div>${idx + 1}. ${escapeHTML(item.text)}</div>
        <div>No cumple</div>
      </div>
      ${item.note ? `<div class="areaPointNote"><strong>Observación:</strong> ${escapeHTML(item.note)}</div>` : ""}
    `;
    wrap.appendChild(div);
  });
}

function renderAreaChart(ev){
  const canvas = $("areaChart");
  if(!canvas) return;

  const r = ev.result || computeResult(ev);
  const labels = (r.areaList || []).map(x => x.area);
  const values = (r.areaList || []).map(x => x.pct);

  const bgColors = values.map(v => {
    if (v >= 85) return "rgba(15, 157, 88, 0.75)";   // verde
    if (v >= 70) return "rgba(245, 124, 0, 0.75)";   // naranja
    return "rgba(217, 48, 37, 0.75)";                // rojo
  });

  const borderColors = values.map(v => {
    if (v >= 85) return "rgba(15, 157, 88, 1)";
    if (v >= 70) return "rgba(245, 124, 0, 1)";
    return "rgba(217, 48, 37, 1)";
  });

  if(areaChartInstance){
    areaChartInstance.destroy();
    areaChartInstance = null;
  }

  const valueLabelPlugin = {
    id: "valueLabelPlugin",
    afterDatasetsDraw(chart){
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);

      ctx.save();
     ctx.font = "bold 11px Arial";
     ctx.fillStyle = "#dfe7f5";
     ctx.textAlign = "center";
     ctx.textBaseline = "middle";

     meta.data.forEach((bar, index) => {
     const value = chart.data.datasets[0].data[index];
     ctx.fillText(`${value}%`, bar.x, bar.y - 12);
     });

      ctx.restore();
    }
  };

  areaChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "% por área",
        data: values,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
    padding: {
      top: 28
    }
    },
  onClick: (evt, elements) => {
        if(!elements || !elements.length) return;
        const idx = elements[0].index;
        const areaName = labels[idx];
        renderAreaDetail(ev, areaName);
      },
      scales: {
        x: {
          ticks: {
          color: "#b8c3d6",
          maxRotation: 0,
          minRotation: 0,
          font: {
          size: 11
         }
         },
          grid: {
            color: "rgba(255,255,255,0.04)"
          }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            color: "#b8c3d6",
            callback: (value) => value + "%"
          },
          grid: {
            color: "rgba(255,255,255,0.06)"
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.raw}%`
          }
        }
      }
    },
    plugins: [valueLabelPlugin]
  });

  if(labels.length > 0){
    renderAreaDetail(ev, labels[0]);
  } else {
    const title = $("areaDetailTitle");
    const wrap = $("areaDetailList");
    if(title) title.textContent = "Detalle del área";
    if(wrap) wrap.innerHTML = `<div class="muted">No hay datos para graficar.</div>`;
  }
}

function renderResult(ev){
const r = ev.result || {
  pct: Number(ev.pct || 0),
  level: String(ev.level || "Crítica"),
  ok: Number(ev.okCount ?? ev.ok ?? 0),
  total: Number(ev.total || 0),
  areaList: [],
  fails: []
};
  $("rPct").textContent = r.pct + "%";
  $("rLevel").textContent = r.level;
  $("rMeta").textContent = `Tienda ${ev.store} • ${formatDateTime(ev.dateISO)} • ${r.ok}/${r.total} OK • ${ev.synced ? "Correo enviado" : "Pendiente"}`;
  const generalNoteEl = $("rGeneralNote");
  const maintenanceNoteEl = $("rMaintenanceNote");
  const marketingNoteEl = $("rMarketingNote");
  evidences = Array.isArray(ev._tempEvidences) && ev._tempEvidences.length
  ? ev._tempEvidences.map(x => ({
      image: x.image || "",
      note: x.note || "",
      type: x.type || "Operativo",
      sizeKB: Number(x.sizeKB || 0)
    }))
  : [];

updatePhotoCounter();
renderPhotoList();

if(generalNoteEl) generalNoteEl.value = ev.generalNote || "";
if(maintenanceNoteEl) maintenanceNoteEl.value = ev.maintenanceNote || "";
if(marketingNoteEl) marketingNoteEl.value = ev.marketingNote || "";

  const wrap = $("areaTable");
wrap.innerHTML = "";
const table = document.createElement("table");
table.className = "t";
table.innerHTML = `<thead><tr><th>Área</th><th>OK</th><th>%</th></tr></thead>`;
const tb = document.createElement("tbody");
r.areaList.forEach(x=>{
  const tr = document.createElement("tr");
  tr.innerHTML = `<td>${x.area}</td><td>${x.ok}/${x.total}</td><td>${x.pct}%</td>`;
  tb.appendChild(tr);
});
table.appendChild(tb);
wrap.appendChild(table);

renderAreaChart(ev);

  const failsList = $("failsList");
  failsList.innerHTML = "";
  $("failsTitle").textContent = `Preguntas en 0 (${r.fails.length})`;
  if(r.fails.length===0){
    const p = document.createElement("div");
    p.className = "pill";
    p.textContent = "Sin fallas 🎉";
    failsList.appendChild(p);
  }else{
    r.fails.forEach((f)=>{
      const div = document.createElement("div");
      div.className = "fail";
      div.innerHTML = `
        <div class="failArea">${escapeHTML(f.area)}</div>
        <div class="failText">${escapeHTML(f.text)}</div>
        ${f.note ? `<div class="failNote"><strong>Observación:</strong> ${escapeHTML(f.note)}</div>` : ""}
      `;
      failsList.appendChild(div);
    });
  }
}

function formatDateTime(iso){
  try{
    const d = new Date(iso);
    return d.toLocaleString();
  }catch(e){
    return iso;
  }
}

function escapeHTML(s){
  return (s ?? "").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* =========================
   DESEMPEÑO
========================= */
function getISOWeekInfo(dateInput){
  const d = new Date(dateInput);
  if (isNaN(d)) return null;

  const utcDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);

  return {
    year: utcDate.getUTCFullYear(),
    week: weekNo,
    key: `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`,
    label: `Sem ${weekNo}`
  };
}

function getPerformanceBaseData() {
  const role = getCurrentRole();
  const district = getCurrentDistrict();
  const username = getCurrentUsername();
  const session = loadSession();
  const zone = String(session?.zone || "").trim().toUpperCase();

  let list = mergeHistoryLists(loadEvals(), remoteHistory);

  list = list.map(ev => {
    const weekInfo = getISOWeekInfo(ev.dateISO);
    const pctValue = Number(ev?.result?.pct ?? ev?.pct ?? 0);

    return {
      ...ev,
      pct: isNaN(pctValue) ? 0 : pctValue,
      district: String(ev?.district || "").trim().toUpperCase(),
      zone: String(ev?.zone || "").trim().toUpperCase(),
      username: String(ev?.username || "").trim().toLowerCase(),
      store: String(ev?.store || "").trim(),
      weekKey: weekInfo?.key || "",
      weekLabel: weekInfo?.label || "",
      weekYear: Number(weekInfo?.year || 0),
      weekNum: Number(weekInfo?.week || 0)
    };
  }).filter(ev => ev.weekKey && ev.store);

  if (role === "supervisor") {
    list = list.filter(ev => ev.district === district);
  }

  if (role === "evaluador") {
    list = list.filter(ev =>
      ev.username === username &&
      ev.zone === zone
    );
  }

  return list;
}

function getLatestWeekKeys(list, maxWeeks = 10) {
  const safeList = Array.isArray(list) ? list : [];
  const safeMaxWeeks = Math.max(1, Number(maxWeeks || 10));

  const unique = Array.from(
    new Set(
      safeList
        .map(x => String(x?.weekKey || "").trim())
        .filter(Boolean)
    )
  ).sort();

  return unique.slice(-safeMaxWeeks);
}

function fillSelectOptions(selectId, items, firstLabel = "Todos"){
  const el = $(selectId);
  if(!el) return;

  const currentValue = el.value || "";
  const unique = Array.from(new Set(items.filter(Boolean))).sort();

  el.innerHTML = `<option value="">${firstLabel}</option>` +
    unique.map(x => `<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`).join("");

  if(unique.includes(currentValue)){
    el.value = currentValue;
  } else {
    el.value = "";
  }
}

function applyPerformanceRoleUI(baseList){
  const role = getCurrentRole();
  const districtWrap = $("filterDistrictWrap");
  const districtEl = $("filterDistrict");
  const zoneEl = $("filterZone");

  if(role === "admin"){
    districtWrap?.classList.remove("hidden");
    if(districtEl) districtEl.disabled = false;
    if(zoneEl) zoneEl.disabled = false;
    return;
  }

  if(role === "supervisor"){
    districtWrap?.classList.add("hidden");
    if(districtEl){
      const district = getCurrentDistrict();
      districtEl.innerHTML = `<option value="${escapeHTML(district)}">${escapeHTML(district)}</option>`;
      districtEl.value = district;
      districtEl.disabled = true;
    }
    if(zoneEl) zoneEl.disabled = false;
    return;
  }

  if(role === "evaluador"){
    districtWrap?.classList.add("hidden");

    if(districtEl){
      const district = getCurrentDistrict();
      districtEl.innerHTML = `<option value="${escapeHTML(district)}">${escapeHTML(district)}</option>`;
      districtEl.value = district;
      districtEl.disabled = true;
    }

    if(zoneEl){
      const zone = String(loadSession()?.zone || "").trim().toUpperCase();
      zoneEl.innerHTML = `<option value="${escapeHTML(zone)}">${escapeHTML(zone)}</option>`;
      zoneEl.value = zone;
      zoneEl.disabled = true;
    }
  }
}

function renderPerformancePlaceholder(msg = "Sin datos para mostrar"){
  const detail = $("performanceDetail");
  if(detail){
    detail.innerHTML = `<div class="muted">${escapeHTML(msg)}</div>`;
  }

  const canvas = $("performanceChart");
  if(canvas && performanceChartInstance){
    performanceChartInstance.destroy();
    performanceChartInstance = null;
  }

  destroyPerformanceDrillCharts();
}

function buildWeeklyPerformance(list) {
  const safeList = Array.isArray(list) ? list : [];
  const map = new Map();

  safeList.forEach(ev => {
    const weekKey = String(ev?.weekKey || "").trim();
    const weekLabel = String(ev?.weekLabel || "").trim();
    const pct = Number(ev?.pct || 0);

    if (!weekKey) return;

    if (!map.has(weekKey)) {
      map.set(weekKey, {
        weekKey,
        weekLabel: weekLabel || weekKey,
        values: []
      });
    }

    map.get(weekKey).values.push(isNaN(pct) ? 0 : pct);
  });

  return Array.from(map.values())
    .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
    .map(x => ({
      weekKey: x.weekKey,
      weekLabel: x.weekLabel,
      pct: x.values.length
        ? Math.round(x.values.reduce((acc, v) => acc + v, 0) / x.values.length)
        : 0,
      count: x.values.length
    }));
}

function getWeeksSelectionCount(){
  const mode = String($("filterWeeks")?.value || "10").trim();

  if(mode === "custom"){
    const customVal = Number($("filterWeeksCustom")?.value || 10);
    return Math.max(1, customVal || 10);
  }

  return Math.max(1, Number(mode || 10));
}

function toggleCustomWeeksInput(){
  const mode = String($("filterWeeks")?.value || "").trim();
  const input = $("filterWeeksCustom");
  if(!input) return;

  input.classList.toggle("hidden", mode !== "custom");
}

function buildAreaPerformanceForWeek(list, weekKey){
  const safeList = Array.isArray(list) ? list : [];
  const safeWeekKey = String(weekKey || "").trim();
  if(!safeWeekKey) return [];

  const areaMap = new Map();

  safeList
    .filter(ev => String(ev?.weekKey || "").trim() === safeWeekKey)
    .forEach(ev => {
      const answers = Array.isArray(ev?.answers) ? ev.answers : [];

      answers.forEach(a => {
        const area = String(a?.area || "").trim() || "Sin área";

        if(!areaMap.has(area)){
          areaMap.set(area, {
            area,
            total: 0,
            ok: 0,
            fails: 0,
            stores: new Set()
          });
        }

        const row = areaMap.get(area);
        row.total += 1;
        if(Number(a?.val || 0) === 1){
          row.ok += 1;
        } else {
          row.fails += 1;
        }
        row.stores.add(String(ev?.store || "").trim());
      });
    });

  return Array.from(areaMap.values())
    .map(x => ({
      area: x.area,
      total: x.total,
      ok: x.ok,
      fails: x.fails,
      stores: x.stores.size,
      pct: x.total ? Math.round((x.ok / x.total) * 100) : 0
    }))
    .sort((a,b) => a.pct - b.pct || b.fails - a.fails || a.area.localeCompare(b.area));
}

function buildStorePerformanceForWeekArea(list, weekKey, areaName){
  const safeList = Array.isArray(list) ? list : [];
  const safeWeekKey = String(weekKey || "").trim();
  const safeArea = String(areaName || "").trim();
  if(!safeWeekKey || !safeArea) return [];

  const storeMap = new Map();

  safeList
    .filter(ev => String(ev?.weekKey || "").trim() === safeWeekKey)
    .forEach(ev => {
      const store = String(ev?.store || "").trim() || "Sin tienda";
      const answers = (Array.isArray(ev?.answers) ? ev.answers : [])
        .filter(a => String(a?.area || "").trim() === safeArea);

      if(!answers.length) return;

      if(!storeMap.has(store)){
        storeMap.set(store, {
          store,
          total: 0,
          ok: 0,
          fails: 0
        });
      }

      const row = storeMap.get(store);
      answers.forEach(a => {
        row.total += 1;
        if(Number(a?.val || 0) === 1){
          row.ok += 1;
        } else {
          row.fails += 1;
        }
      });
    });

  return Array.from(storeMap.values())
    .map(x => ({
      ...x,
      pct: x.total ? Math.round((x.ok / x.total) * 100) : 0
    }))
    .sort((a,b) => a.pct - b.pct || b.fails - a.fails || a.store.localeCompare(b.store));
}

function buildPointFailuresForWeekAreaStore(list, weekKey, areaName, storeName){
  const safeList = Array.isArray(list) ? list : [];
  const safeWeekKey = String(weekKey || "").trim();
  const safeArea = String(areaName || "").trim();
  const safeStore = String(storeName || "").trim();

  if(!safeWeekKey || !safeArea || !safeStore) return [];

  const rows = [];

  safeList
    .filter(ev =>
      String(ev?.weekKey || "").trim() === safeWeekKey &&
      String(ev?.store || "").trim() === safeStore
    )
    .forEach(ev => {
      const answers = Array.isArray(ev?.answers) ? ev.answers : [];

      answers
        .filter(a =>
          String(a?.area || "").trim() === safeArea &&
          Number(a?.val || 0) === 0
        )
        .forEach(a => {
          rows.push({
            qid: String(a?.qid || "").trim(),
            text: String(a?.text || "").trim(),
            note: String(a?.note || "").trim()
          });
        });
    });

  return rows;
}

async function ensurePerformanceAnswersForWeek(weekKey){
  const safeWeekKey = String(weekKey || "").trim();
  if(!safeWeekKey) return;

  if(performanceWeekLoadCache.has(safeWeekKey)){
    return;
  }

  const base = performanceDataCache.filter(
    x => String(x.weekKey || "").trim() === safeWeekKey
  );

  if(!base.length){
    performanceWeekLoadCache.add(safeWeekKey);
    return;
  }

  const idsToLoad = base
    .filter(ev => !ev.answers || !ev.answers.length)
    .map(ev => ev.id);

  if(!idsToLoad.length){
    performanceWeekLoadCache.add(safeWeekKey);
    return;
  }

  try{
    const batchSize = 5;
    let results = [];

    for(let i = 0; i < idsToLoad.length; i += batchSize){
      const batch = idsToLoad.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(id => loadRemoteEvaluation(id)));
      results = results.concat(batchResults);
    }

    const map = new Map();
    results.forEach(ev => {
      if(ev && ev.id) map.set(ev.id, ev);
    });

    performanceDataCache = performanceDataCache.map(ev => {
      if(map.has(ev.id)){
        const remote = map.get(ev.id);
        return {
          ...ev,
          answers: remote.answers,
          result: remote.result
        };
      }
      return ev;
    });

    performanceWeekLoadCache.add(safeWeekKey);

  }catch(e){
    console.error("Error cargando evaluaciones en paralelo:", e);
    performanceWeekLoadCache.add(safeWeekKey);
  }
}

async function renderPerformanceAreaDetail(filteredList){
  const title = $("performanceAreaDetailTitle");
  const storeTitle = $("performanceStoreDetailTitle");

  if(!title || !storeTitle) return;

  if(!selectedPerformanceWeek){
    title.textContent = "Desempeño por área";
    storeTitle.textContent = "Tiendas con oportunidad";
    destroyPerformanceDrillCharts();
    return;
  }

  title.textContent = "Desempeño por área";
  storeTitle.textContent = "Tiendas con oportunidad";

  await ensurePerformanceAnswersForWeek(selectedPerformanceWeek);
  const enrichedList = filteredList;

  const weeklyRows = buildWeeklyPerformance(enrichedList);
  const selectedWeekObj = weeklyRows.find(x => x.weekKey === selectedPerformanceWeek);
  const areaRows = buildAreaPerformanceForWeek(enrichedList, selectedPerformanceWeek);

  if(!areaRows.length){
    destroyPerformanceDrillCharts();
    return;
  }

 if(!selectedPerformanceArea || !areaRows.some(x => x.area === selectedPerformanceArea)){
  selectedPerformanceArea = areaRows[0].area;
}
selectedPerformanceStore = "";

  renderPerformanceAreaChart(areaRows, selectedWeekObj?.weekLabel || selectedPerformanceWeek);
  await renderPerformanceStoreDetail(enrichedList);
}

async function renderPerformanceStoreDetail(filteredList){
  const title = $("performanceStoreDetailTitle");
  const pointTitle = $("performancePointDetailTitle");
  const pointWrap = $("performancePointDetailList");

  if(!title) return;

  if(!selectedPerformanceWeek || !selectedPerformanceArea){
    title.textContent = "Tiendas con oportunidad";
    if(performanceStoreChartInstance){
      performanceStoreChartInstance.destroy();
      performanceStoreChartInstance = null;
    }
    if(pointTitle) pointTitle.textContent = "Detalle de puntos con falla";
    if(pointWrap) pointWrap.innerHTML = `<div class="muted">Dale clic a una tienda para ver los puntos específicos con falla.</div>`;
    return;
  }

   await ensurePerformanceAnswersForWeek(selectedPerformanceWeek);
   const enrichedList = filteredList;

  const weeklyRows = buildWeeklyPerformance(enrichedList);
  const selectedWeekObj = weeklyRows.find(x => x.weekKey === selectedPerformanceWeek);
  const storeRows = buildStorePerformanceForWeekArea(
    enrichedList,
    selectedPerformanceWeek,
    selectedPerformanceArea
  );

  if(!selectedPerformanceStore || !storeRows.some(x => x.store === selectedPerformanceStore)){
    selectedPerformanceStore = storeRows.length ? storeRows[0].store : "";
  }

  renderPerformanceStoreChart(
    storeRows,
    selectedPerformanceArea,
    selectedWeekObj?.weekLabel || selectedPerformanceWeek
  );

  await renderPerformancePointDetail(enrichedList);
}

function renderPerformanceChart(weeklyRows){
  const canvas = $("performanceChart");
  if(!canvas) return;

  if(performanceChartInstance){
    performanceChartInstance.destroy();
    performanceChartInstance = null;
  }

  const labels = weeklyRows.map(x => x.weekLabel);
  const values = weeklyRows.map(x => x.pct);

  const bgColors = weeklyRows.map(x => {
    const v = Number(x.pct || 0);
    const isSelected = x.weekKey === selectedPerformanceWeek;

    if(isSelected){
      if(v >= 85) return "rgba(15, 157, 88, 0.95)";
      if(v >= 70) return "rgba(245, 124, 0, 0.95)";
      return "rgba(217, 48, 37, 0.95)";
    }

    if(v >= 85) return "rgba(15, 157, 88, 0.75)";
    if(v >= 70) return "rgba(245, 124, 0, 0.75)";
    return "rgba(217, 48, 37, 0.75)";
  });

  const borderColors = weeklyRows.map(x => {
    const v = Number(x.pct || 0);
    if(v >= 85) return "rgba(15, 157, 88, 1)";
    if(v >= 70) return "rgba(245, 124, 0, 1)";
    return "rgba(217, 48, 37, 1)";
  });

  performanceChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
      label: "% desempeño",
      data: values,
      backgroundColor: bgColors,
      borderColor: borderColors,
      borderWidth: weeklyRows.map(x => x.weekKey === selectedPerformanceWeek ? 4 : 2),
      borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: async (evt, elements) => {
      if(!elements || !elements.length) return;

      const idx = elements[0].index;
      const row = weeklyRows[idx];

      selectedPerformanceWeek = row.weekKey;
      selectedPerformanceArea = "";
      selectedPerformanceStore = "";

      showPerfLoading(`Cargando detalle de ${row.weekLabel}...`);
      try{
      await renderPerformance();
      } finally {
      hidePerfLoading();
      }
      },
      scales: {
        x: {
          ticks: {
            color: "#b8c3d6"
          },
          grid: {
            color: "rgba(255,255,255,0.04)"
          }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            color: "#b8c3d6",
            callback: (value) => value + "%"
          },
          grid: {
            color: "rgba(255,255,255,0.06)"
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.raw}%`
          }
        }
      }
    }
  });
}

function destroyPerformanceDrillCharts(){
  if(performanceAreaChartInstance){
    performanceAreaChartInstance.destroy();
    performanceAreaChartInstance = null;
  }
  if(performanceStoreChartInstance){
    performanceStoreChartInstance.destroy();
    performanceStoreChartInstance = null;
  }
}

function renderPerformanceAreaChart(areaRows, weekLabel){
  const canvas = $("performanceAreaChart");
  const title = $("performanceAreaDetailTitle");

  if(title){
    title.textContent = `Desempeño por área • ${weekLabel || ""}`.trim();
  }

  if(!canvas) return;

  if(performanceAreaChartInstance){
    performanceAreaChartInstance.destroy();
    performanceAreaChartInstance = null;
  }

  if(!areaRows.length){
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const labels = areaRows.map(x => x.area);
  const values = areaRows.map(x => x.pct);

  const bgColors = values.map(v => {
    if (v >= 85) return "rgba(15, 157, 88, 0.75)";
    if (v >= 70) return "rgba(245, 124, 0, 0.75)";
    return "rgba(217, 48, 37, 0.75)";
  });

  const borderColors = values.map(v => {
    if (v >= 85) return "rgba(15, 157, 88, 1)";
    if (v >= 70) return "rgba(245, 124, 0, 1)";
    return "rgba(217, 48, 37, 1)";
  });

  const valueLabelPlugin = {
    id: "performanceAreaValueLabelPlugin",
    afterDatasetsDraw(chart){
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);

      ctx.save();
      ctx.font = "bold 11px Arial";
      ctx.fillStyle = "#dfe7f5";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      meta.data.forEach((bar, index) => {
        const value = chart.data.datasets[0].data[index];
        ctx.fillText(`${value}%`, bar.x, bar.y - 12);
      });

      ctx.restore();
    }
  };

  performanceAreaChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "% por área",
        data: values,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 28 }
      },
      onClick: async (evt, elements) => {
      if(!elements || !elements.length) return;

      const idx = elements[0].index;
      selectedPerformanceArea = areaRows[idx].area;
      selectedPerformanceStore = "";

      showPerfLoading(`Cargando tiendas de ${selectedPerformanceArea}...`);
      try{
      await renderPerformance();
      } finally {
      hidePerfLoading();
      }
      },
      scales: {
        x: {
          ticks: {
            color: "#b8c3d6",
            maxRotation: 0,
            minRotation: 0,
            font: { size: 11 }
          },
          grid: {
            color: "rgba(255,255,255,0.04)"
          }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            color: "#b8c3d6",
            callback: (value) => value + "%"
          },
          grid: {
            color: "rgba(255,255,255,0.06)"
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.raw}%`
          }
        }
      }
    },
    plugins: [valueLabelPlugin]
  });
}

function renderPerformanceStoreChart(storeRows, areaName, weekLabel){
  const canvas = $("performanceStoreChart");
  const title = $("performanceStoreDetailTitle");

  if(title){
    title.textContent = `Tiendas con oportunidad en ${areaName || "el área"} • ${weekLabel || ""}`.trim();
  }

  if(!canvas) return;

  if(performanceStoreChartInstance){
    performanceStoreChartInstance.destroy();
    performanceStoreChartInstance = null;
  }

  if(!storeRows.length){
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const labels = storeRows.map(x => x.store);
  const values = storeRows.map(x => x.pct);

  const bgColors = values.map(v => {
    if (v >= 85) return "rgba(15, 157, 88, 0.75)";
    if (v >= 70) return "rgba(245, 124, 0, 0.75)";
    return "rgba(217, 48, 37, 0.75)";
  });

  const borderColors = values.map(v => {
    if (v >= 85) return "rgba(15, 157, 88, 1)";
    if (v >= 70) return "rgba(245, 124, 0, 1)";
    return "rgba(217, 48, 37, 1)";
  });

  const valueLabelPlugin = {
    id: "performanceStoreValueLabelPlugin",
    afterDatasetsDraw(chart){
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);

      ctx.save();
      ctx.font = "bold 11px Arial";
      ctx.fillStyle = "#dfe7f5";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      meta.data.forEach((bar, index) => {
        const value = chart.data.datasets[0].data[index];
        ctx.fillText(`${value}%`, bar.x, bar.y - 12);
      });

      ctx.restore();
    }
  };

  performanceStoreChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "% por tienda",
        data: values,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 2,
        borderRadius: 8
      }]
    },
     options: {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 28 }
    },
    onClick: async (evt, elements) => {
    if(!elements || !elements.length) return;

    const idx = elements[0].index;
    selectedPerformanceStore = storeRows[idx].store;

    showPerfLoading(`Cargando fallas de ${selectedPerformanceStore}...`);
    try{
    await renderPerformancePointDetail(getFilteredPerformanceData());
    } finally {
    hidePerfLoading();
    }
    },
      scales: {
        x: {
          ticks: {
            color: "#b8c3d6",
            maxRotation: 0,
            minRotation: 0,
            font: { size: 11 }
          },
          grid: {
            color: "rgba(255,255,255,0.04)"
          }
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            color: "#b8c3d6",
            callback: (value) => value + "%"
          },
          grid: {
            color: "rgba(255,255,255,0.06)"
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.raw}%`
          }
        }
      }
    },
    plugins: [valueLabelPlugin]
  });
}

async function renderPerformancePointDetail(filteredList){
  const title = $("performancePointDetailTitle");
  const wrap = $("performancePointDetailList");

  if(!title || !wrap) return;

  if(!selectedPerformanceWeek || !selectedPerformanceArea || !selectedPerformanceStore){
    title.textContent = "Detalle de puntos con falla";
    wrap.innerHTML = `<div class="muted">Dale clic a una tienda para ver los puntos específicos con falla.</div>`;
    return;
  }

  await ensurePerformanceAnswersForWeek(selectedPerformanceWeek);
  const enrichedList = filteredList;
  const weeklyRows = buildWeeklyPerformance(enrichedList);
  const selectedWeekObj = weeklyRows.find(x => x.weekKey === selectedPerformanceWeek);

  const points = buildPointFailuresForWeekAreaStore(
    enrichedList,
    selectedPerformanceWeek,
    selectedPerformanceArea,
    selectedPerformanceStore
  );

  title.textContent = `Puntos con falla en ${selectedPerformanceStore} • ${selectedPerformanceArea} • ${selectedWeekObj?.weekLabel || selectedPerformanceWeek}`;
  wrap.innerHTML = "";

  if(!points.length){
    wrap.innerHTML = `<div class="pill">Sin fallas en esta tienda para esa área 🎉</div>`;
    return;
  }

  points.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = "fail";
    div.innerHTML = `
      <div class="failText"><strong>${idx + 1}.</strong> ${escapeHTML(item.text || "Sin descripción")}</div>
      ${item.note ? `<div class="failNote"><strong>Observación:</strong> ${escapeHTML(item.note)}</div>` : ""}
    `;
    wrap.appendChild(div);
  });
}

function renderPerformanceDetail(filteredList, weeklyRows){
  const detail = $("performanceDetail");
  if(!detail) return;

  if(!weeklyRows.length){
    detail.innerHTML = `<div class="muted">No hay semanas para mostrar.</div>`;
    return;
  }

  detail.innerHTML = weeklyRows.map(week => {
    const stores = new Set(
      filteredList
        .filter(x => x.weekKey === week.weekKey)
        .map(x => x.store)
    );

    return `
      <div class="histRow">
        <div class="histTop">
          <div class="histTitle">${escapeHTML(week.weekLabel)} • ${week.pct}%</div>
          <div class="histBadge ok">${week.count} eval.</div>
        </div>
        <div class="histMeta">Tiendas evaluadas: ${stores.size}</div>
      </div>
    `;
  }).join("");
}

function getFilteredPerformanceData() {
  const district = String($("filterDistrict")?.value || "").trim().toUpperCase();
  const zone = String($("filterZone")?.value || "").trim().toUpperCase();
  const store = String($("filterStore")?.value || "").trim();
  const weeksCount = getWeeksSelectionCount();

  let list = Array.isArray(performanceDataCache) ? [...performanceDataCache] : [];

  if (district) {
    list = list.filter(x => String(x?.district || "").trim().toUpperCase() === district);
  }

  if (zone) {
    list = list.filter(x => String(x?.zone || "").trim().toUpperCase() === zone);
  }

  if (store) {
    list = list.filter(x => String(x?.store || "").trim() === store);
  }

  const latestWeeks = getLatestWeekKeys(list, weeksCount);

  if (!latestWeeks.length) {
    return [];
  }

  return list.filter(x => latestWeeks.includes(String(x?.weekKey || "").trim()));
}

function refreshPerformanceFilters(){
  const role = getCurrentRole();
  const baseList = performanceDataCache;

  if(role === "admin"){
    fillSelectOptions("filterDistrict", baseList.map(x => x.district), "Todos");
  }

  const selectedDistrict = String($("filterDistrict")?.value || "").trim().toUpperCase();

  let zoneSource = [...baseList];
  if(selectedDistrict){
    zoneSource = zoneSource.filter(x => x.district === selectedDistrict);
  }

  if(role === "evaluador"){
    const zone = String(loadSession()?.zone || "").trim().toUpperCase();
    const zoneEl = $("filterZone");
    if(zoneEl){
      zoneEl.innerHTML = `<option value="${escapeHTML(zone)}">${escapeHTML(zone)}</option>`;
      zoneEl.value = zone;
    }
  } else {
    fillSelectOptions("filterZone", zoneSource.map(x => x.zone), "Todas");
  }

  const selectedZone = String($("filterZone")?.value || "").trim().toUpperCase();

  let storeSource = [...zoneSource];
  if(selectedZone){
    storeSource = storeSource.filter(x => x.zone === selectedZone);
  }

  fillSelectOptions("filterStore", storeSource.map(x => x.store), "Todas");
}

async function renderPerformance() {
  const filtered = getFilteredPerformanceData();

  if (!filtered.length) {
    renderPerformancePlaceholder("No hay evaluaciones para esos filtros.");

    const areaTitle = $("performanceAreaDetailTitle");
    const storeTitle = $("performanceStoreDetailTitle");
    const pointTitle = $("performancePointDetailTitle");
    const pointWrap = $("performancePointDetailList");

    if(areaTitle) areaTitle.textContent = "Desempeño por área";
    if(storeTitle) storeTitle.textContent = "Tiendas con oportunidad";
    if(pointTitle) pointTitle.textContent = "Detalle de puntos con falla";
    if(pointWrap) pointWrap.innerHTML = `<div class="muted">Sin datos para mostrar.</div>`;
    return;
  }

  const weeklyRows = buildWeeklyPerformance(filtered);

  if (!weeklyRows.length) {
    renderPerformancePlaceholder("No hay semanas válidas para mostrar.");
    return;
  }

  // SOLO asignar semana si el usuario ya interactuó
if(selectedPerformanceWeek && !weeklyRows.some(x => x.weekKey === selectedPerformanceWeek)){
  selectedPerformanceWeek = "";
}

  renderPerformanceChart(weeklyRows);
  renderPerformanceDetail(filtered, weeklyRows);
  if(selectedPerformanceWeek){
  await renderPerformanceAreaDetail(filtered);
} else {
  const areaTitle = $("performanceAreaDetailTitle");
  const storeTitle = $("performanceStoreDetailTitle");

  if(areaTitle) areaTitle.textContent = "Desempeño por área";
  if(storeTitle) storeTitle.textContent = "Tiendas con oportunidad";

  destroyPerformanceDrillCharts();
}
}

async function openPerformanceScreen(){
  if(isVersionBlocked("abrir desempeño")) return;

  show("screenPerformance");
  $("performanceDetail").innerHTML = `<div class="muted">Cargando desempeño...</div>`;

  const areaWrap = $("performanceAreaDetailList");
  const storeWrap = $("performanceStoreDetailList");
  if(areaWrap) areaWrap.innerHTML = `<div class="muted">Cargando categorías...</div>`;
  if(storeWrap) storeWrap.innerHTML = `<div class="muted">Cargando tiendas...</div>`;

  showPerfLoading("Cargando desempeño...");
  try{
    await loadRemoteHistory();

    performanceDataCache = getPerformanceBaseData();
    performanceDetailCache = new Map();
    performanceWeekLoadCache = new Set();
    selectedPerformanceWeek = "";
    selectedPerformanceArea = "";
    selectedPerformanceStore = "";

    applyPerformanceRoleUI(performanceDataCache);
    refreshPerformanceFilters();
    toggleCustomWeeksInput();
    await renderPerformance();
  } finally {
    hidePerfLoading();
  }
}

/* =========================
   HISTORIAL
========================= */
function populateHistoryUserFilter(list){
  const wrap = $("historyUserFilterWrap");
  const select = $("historyUserFilter");
  const role = getCurrentRole();

  if(!wrap || !select) return;

  if(role !== "admin" && role !== "supervisor"){
    wrap.classList.add("hidden");
    select.innerHTML = `<option value="">Todos</option>`;
    return;
  }

  wrap.classList.remove("hidden");

  const usersMap = new Map();

  list.forEach(ev => {
    const username = String(ev.username || "").trim();
    const gz = String(ev.gz || username).trim();

    if(username){
      usersMap.set(username, gz);
    }
  });

  const currentValue = select.value || "";
  const options = [`<option value="">Todos</option>`];

  Array.from(usersMap.entries())
    .sort((a,b) => a[1].localeCompare(b[1]))
    .forEach(([username, name]) => {
      options.push(
        `<option value="${escapeHTML(username)}">${escapeHTML(name)}</option>`
      );
    });

  select.innerHTML = options.join("");
  select.value = currentValue;
  wrap.classList.remove("hidden");
}

async function renderHistory(){
    if(isVersionBlocked("abrir historial")) return;
  const role = getCurrentRole();
  const username = getCurrentUsername();
  const district = getCurrentDistrict();

  let localList = loadEvals();
  const wrap = $("historyList");
  const searchTerm = ($("historySearch")?.value || "").trim();
  const selectedLevel = ($("historyLevelFilter")?.value || "").trim();

  if(role === "evaluador"){
    localList = localList.filter(ev =>
      String(ev.username || "").trim().toLowerCase() === username
    );
  } else if(role === "supervisor"){
    localList = localList.filter(ev =>
      String(ev.district || "").trim().toUpperCase() === district
    );
  }

  wrap.innerHTML = `<div class="muted">Cargando historial...</div>`;

  await loadRemoteHistory();

  const merged = mergeHistoryLists(localList, remoteHistory);

  populateHistoryUserFilter(merged);

  const selectedUser = ($("historyUserFilter")?.value || "").trim().toLowerCase();

  let filtered = merged;

if((role === "admin" || role === "supervisor") && selectedUser){
  filtered = filtered.filter(ev =>
    String(ev.username || "").trim().toLowerCase() === selectedUser
  );
}

if(selectedLevel){
  filtered = filtered.filter(ev => {
    const r = ev.result || {
      pct: Number(ev.pct || 0),
      level: String(ev.level || "Crítica")
    };
    return String(r.level || "").trim() === selectedLevel;
  });
}

filtered = filtered.filter(ev => matchesHistorySearch(ev, searchTerm));

  wrap.innerHTML = "";

  if(filtered.length===0){
    wrap.innerHTML = `<div class="muted">No se encontraron evaluaciones con ese criterio.</div>`;
    return;
  }

  filtered.forEach(ev=>{
    const r = ev.result || {
      pct: Number(ev.pct || 0),
      level: String(ev.level || "Crítica"),
      ok: Number(ev.okCount ?? ev.ok ?? 0),
      total: Number(ev.total || 0)
    };

    const sourceText =
      ev.source === "local+sheet" ? "Este dispositivo + Google Sheets" :
      ev.source === "sheet" ? "Google Sheets" :
      "Este dispositivo";

    const row = document.createElement("div");
    row.className = "histRow";
    row.innerHTML = `
      <div class="histTop">
        <div class="histTitle">
        Tienda ${ev.store} • ${r.pct}% 
       <span class="levelTag ${r.level === "Operativa" ? "ok" : r.level === "En riesgo" ? "risk" : "crit"}">
       ${r.level}
       </span>
       </div>
        <div class="histBadge ${ev.synced ? "ok" : "pend"}">${ev.synced ? "Correo enviado" : "Pendiente"}</div>
      </div>
      <div class="histMeta">GZ: ${escapeHTML(ev.gz)} • Zona: ${escapeHTML(ev.zone || "")} • ${formatDateTime(ev.dateISO)} • ${r.ok}/${r.total} OK</div>
      <div class="muted" style="margin-top:6px;">Origen: ${escapeHTML(sourceText)}</div>
      ${ev.generalNote ? `<div class="muted" style="margin-top:6px;"><strong>Obs. general:</strong> ${escapeHTML(ev.generalNote)}</div>` : ""}
${ev.maintenanceNote ? `<div class="muted" style="margin-top:6px;"><strong>Mantenimiento:</strong> ${escapeHTML(ev.maintenanceNote)}</div>` : ""}
${ev.marketingNote ? `<div class="muted" style="margin-top:6px;"><strong>Mercadeo:</strong> ${escapeHTML(ev.marketingNote)}</div>` : ""}
      <div class="histBtns">
        <button class="btn sm" data-act="open" data-id="${ev.id}" data-source="${ev.source}">Ver resultado</button>
        <button class="btn sm" data-act="export" data-id="${ev.id}">CSV</button>
        <button class="btn sm danger" data-act="del" data-id="${ev.id}">Borrar local</button>
      </div>
    `;
    wrap.appendChild(row);
  });

  wrap.querySelectorAll("button[data-act]").forEach(btn=>{
    btn.onclick = async ()=>{
      const id = btn.getAttribute("data-id");
      const act = btn.getAttribute("data-act");

      const localEv = loadEvals().find(x=>x.id===id);

      if(act==="open"){
        if(localEv){
          current = localEv;
          qIdx = 0;
          current.result = current.result || computeResult(current);
          renderResult(current);
          show("screenResult");
          return;
        }

        const remoteEv = await loadRemoteEvaluation(id);
        if(!remoteEv){
          toast("No se pudo cargar la evaluación desde Google Sheets", 3500);
          return;
        }

        current = remoteEv;
        qIdx = 0;
        renderResult(current);
        show("screenResult");

      }else if(act==="export"){
        if(localEv){
          exportCSV(localEv);
        }else{
          const remoteEv = await loadRemoteEvaluation(id);
          if(!remoteEv){
            toast("No se pudo exportar la evaluación remota", 3500);
            return;
          }
          exportCSV(remoteEv);
        }

      }else if(act==="del"){
        if(!localEv){
          toast("Esa evaluación solo existe en Google Sheets", 3000);
          return;
        }

        if(confirm("¿Borrar esta evaluación del dispositivo?")){
          deleteEval(id);
          renderHistory();
        }
      }
    };
  });
}

/* =========================
   EXPORT CSV
========================= */
function exportCSV(ev){
  const r = ev.result || computeResult(ev);
  const rows = [];
  rows.push(["id","store","gz","dateISO","createdAt","pct","level","synced","syncedAt"].map(escapeCSV).join(","));
  rows.push([ev.id,ev.store,ev.gz,ev.dateISO,ev.createdAt,r.pct,r.level,ev.synced,ev.syncedAt||""].map(escapeCSV).join(","));
  rows.push("");
  rows.push(["qid","area","question","val","note"].map(escapeCSV).join(","));
  ev.answers.forEach(a=>{
  rows.push([a.qid,a.area,a.text,a.val,a.note || ""].map(escapeCSV).join(","));
  });

  const blob = new Blob([rows.join("\n")], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `AMPM_Checklist_${ev.store}_${ev.dateISO.slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildAuditMeta(ev){
  const session = loadSession() || {};

  return {
    username: ev?.username || session?.username || "",
    nombreUsuario: ev?.gz || session?.name || "",
    role: ev?.role || session?.role || "",
    district: ev?.district || session?.district || "",
    zone: ev?.zone || session?.zone || "",
    tienda: ev?.store || "",
    gz: ev?.gz || "",
    fechaEvaluacion: ev?.dateISO || "",
    fechaEnvioISO: nowISO(),
    online: navigator.onLine ? "SI" : "NO",
    userAgent: navigator.userAgent || "",
    plataforma: navigator.platform || "",
    idioma: navigator.language || ""
  };
}

function buildSyncPayload(ev){
  const r = ev.result || computeResult(ev);
  const audit = buildAuditMeta(ev);
  const safeEvidences =
  (Array.isArray(ev._tempEvidences) && ev._tempEvidences.length)
    ? ev._tempEvidences
    : [];

  return {
    to: parseEmails(ev.emailTo),
    subject: `AMPM Checklist ${ev.store} | ${r.pct}% | ${r.level} | ${formatDateTime(ev.dateISO)}`,
    body: buildEmailBody(ev),
    returnTo: window.location.origin + window.location.pathname,
    syncId: ev.id,
    header: {
      id: ev.id,
      store: ev.store,
      gz: ev.gz,
      zone: ev.zone || "",
      username: ev.username || "",
      role: ev.role || "",
      district: ev.district || "",
      dateISO: ev.dateISO,
      createdAt: ev.createdAt,
      updatedAt: ev.updatedAt,
      emailTo: ev.emailTo || "",
      pct: r.pct,
      level: r.level,
      ok: r.ok,
      total: r.total,
      generalNote: ev.generalNote || "",
      maintenanceNote: ev.maintenanceNote || "",
      marketingNote: ev.marketingNote || "",
      synced: ev.synced === true,
      syncedAt: ev.syncedAt || "",
      frontendVersion: FRONTEND_VERSION,
      backendVersion: backendVersionDetected || "",
      versionStatus: versionAlignmentState || ""
    },
    audit,
    answers: ev.answers.map((a, idx) => ({
      order: idx + 1,
      qid: a.qid,
      area: a.area,
      text: a.text,
      val: a.val,
      responseText: a.val === 1 ? "Cumple" : "No cumple",
      note: a.note || ""
    })),
   evidences: safeEvidences
  .filter(img => img.image && String(img.image).includes(","))
  .map((img, idx) => {
    const parts = String(img.image).split(",");
    const base64 = parts.length > 1 ? parts[1] : "";

    return {
      name: `evidencia_${String(idx + 1).padStart(2, "0")}.jpg`,
      mimeType: "image/jpeg",
      base64: base64,
      note: img.note || "",
      type: img.type || "Operativo",
      sizeKB: Number(img.sizeKB || 0)
    };
  })
  };
  }

/* =========================
   SYNC + EMAIL (Apps Script)
========================= */
async function syncPending(onlyThisId=null){
    if(isVersionBlocked("enviar la evaluación")) return;
  if(!SCRIPT_URL){
    toast("Falta configurar SCRIPT_WEB_APP_URL en app.js");
    return;
  }

  const list = loadEvals();
  const pending = list.filter(ev => !ev.synced && (onlyThisId ? ev.id===onlyThisId : true));
  if(pending.length===0){
    toast("No hay pendientes");
    return;
  }

  const ev = (current && onlyThisId && current.id === onlyThisId)
  ? current
  : pending[0];
  const r = ev.result || computeResult(ev);
  const to = (ev.emailTo || "").trim();

  if(!to){
    toast("No hay 'Correo destino' (llenalo en Inicio)", 3500);
    return;
  }

  saveGeneralNotes();

const freshList = loadEvals();
const freshEv = (current && current.id === ev.id)
  ? current
  : (freshList.find(x => x.id === ev.id) || ev);

const payload = buildSyncPayload(freshEv);

payload.audit = {
  ...(payload.audit || {}),
  origenEnvio: "ENVIO_DIRECTO"
};

if (!navigator.onLine) {
  addToPendingQueue(payload);
  toast("Sin internet. Evaluación guardada en pendientes.", 3500);
  return;
}

  const popup = window.open("", "ampmMailSync", "width=720,height=760");

  if(!popup){
    toast("El navegador bloqueó la ventana emergente. Permití popups para continuar.", 4500);
    return;
  }

  const form = document.createElement("form");
  form.method = "POST";
  form.action = SCRIPT_URL;
  form.target = "ampmMailSync";
  form.style.display = "none";

  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "payload";
  input.value = JSON.stringify(payload);
  form.appendChild(input);

  document.body.appendChild(form);
  form.submit();
  if (form) form.remove();

  toast("Enviando correo...", 2200);
}

function buildEmailBody(ev){
  const r = ev.result || computeResult(ev);
  const generalNote = (ev.generalNote || "").trim();
  const maintenanceNote = (ev.maintenanceNote || "").trim();
  const marketingNote = (ev.marketingNote || "").trim();

  const levelColor =
    r.level === "Operativa" ? "#0f9d58" :
    r.level === "En riesgo" ? "#f57c00" :
    "#d93025";

  const levelBg =
    r.level === "Operativa" ? "#e8f5e9" :
    r.level === "En riesgo" ? "#fff3e0" :
    "#fdecea";

const semOp = r.level === "Operativa" ? "#0f9d58" : "#cfead6";
const semRisk = r.level === "En riesgo" ? "#f57c00" : "#fde2c2";
const semCrit = r.level === "Crítica" ? "#d93025" : "#f6c7c3";

  const areaRows = (r.areaList || []).map(x => `
    <tr>
      <td style="padding:10px;border:1px solid #d9dee7;font-size:14px;color:#172033;">${escapeHTML(x.area)}</td>
      <td style="padding:10px;border:1px solid #d9dee7;font-size:14px;color:#172033;text-align:center;">${x.ok}/${x.total}</td>
      <td style="padding:10px;border:1px solid #d9dee7;font-size:14px;color:#172033;text-align:center;font-weight:bold;">${x.pct}%</td>
    </tr>
  `).join("");

    const topFails = (r.fails || [])
    .filter(f => (f.note || "").trim() !== "")
    .slice(0, 5);

  const priorityRows = topFails.length
    ? topFails.map((f, i) => `
      <tr>
        <td style="padding:10px;border:1px solid #d9dee7;font-size:14px;color:#172033;text-align:center;width:44px;font-weight:bold;">
          ${i + 1}
        </td>
        <td style="padding:10px;border:1px solid #d9dee7;font-size:14px;color:#172033;width:180px;font-weight:bold;vertical-align:top;">
          ${escapeHTML(f.area)}
        </td>
        <td style="padding:10px;border:1px solid #d9dee7;font-size:14px;color:#172033;vertical-align:top;">
          <div>${escapeHTML(f.text)}</div>
          <div style="margin-top:6px;color:#5f6b7a;"><strong>Observación:</strong> ${escapeHTML(f.note)}</div>
        </td>
      </tr>
    `).join("")
    : `
      <tr>
        <td colspan="3" style="padding:12px;border:1px solid #d9dee7;font-size:14px;color:#172033;">
          Sin prioridades inmediatas registradas.
        </td>
      </tr>
    `;

  const failRows = (r.fails && r.fails.length)
    ? r.fails.slice(0, 40).map(f => `
      <tr>
        <td style="padding:10px;border:1px solid #d9dee7;font-size:14px;color:#172033;width:180px;vertical-align:top;font-weight:bold;">
          ${escapeHTML(f.area)}
        </td>
        <td style="padding:10px;border:1px solid #d9dee7;font-size:14px;color:#172033;vertical-align:top;">
        <div>${escapeHTML(f.text)}</div>
        ${f.note ? `<div style="margin-top:6px;color:#5f6b7a;"><strong>Observación:</strong> ${escapeHTML(f.note)}</div>` : ""}
        </td>
      </tr>
    `).join("")
    : `
      <tr>
        <td colspan="2" style="padding:12px;border:1px solid #d9dee7;font-size:14px;color:#172033;">
          Sin hallazgos críticos registrados.
        </td>
      </tr>
    `;

  const moreFails = (r.fails && r.fails.length > 40)
    ? `
      <tr>
        <td colspan="2" style="padding:10px;border:1px solid #d9dee7;font-size:13px;color:#6b7280;">
          ... y ${r.fails.length - 40} hallazgos más.
        </td>
      </tr>
    `
    : "";

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>AMPM Checklist Operativo GZ</title>
</head>
<body style="margin:0;padding:0;background:#f2f4f7;font-family:Arial,Helvetica,sans-serif;color:#172033;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f4f7;">
    <tr>
      <td align="center" style="padding:24px 12px;">

        <table role="presentation" width="820" cellpadding="0" cellspacing="0" border="0" style="width:820px;max-width:820px;background:#ffffff;border:1px solid #d9dee7;">
          <tr>
            <td style="background:#0a2a66;padding:18px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="72" valign="top" style="width:72px;padding-right:14px;">
                    <table role="presentation" width="56" height="56" cellpadding="0" cellspacing="0" border="0" style="width:56px;height:56px;background:#123b8f;border:1px solid #2f58ae;">
                      <tr>
                        <td align="center" valign="middle" style="font-size:22px;font-weight:bold;color:#ffffff;line-height:1;">
                          AMPM
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td valign="top">
                    <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#dbe7ff;">
                      AMPM — Checklist Operativo GZ
                    </div>
                    <div style="margin-top:8px;font-size:34px;font-weight:bold;line-height:1.1;color:#ffffff;">
                      Tienda ${escapeHTML(ev.store)}
                    </div>
                    <div style="margin-top:10px;font-size:15px;line-height:1.5;color:#ffffff;">
                      GZ: <strong>${escapeHTML(ev.gz || "-")}</strong><br>
                      Fecha/Hora: <strong>${escapeHTML(formatDateTime(ev.dateISO))}</strong>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 24px 10px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="50%" style="padding-right:12px;vertical-align:top;">
                    <div style="font-size:13px;color:#5f6b7a;text-transform:uppercase;font-weight:bold;">
                      Resultado general
                    </div>
                    <div style="margin-top:8px;font-size:52px;font-weight:bold;line-height:1;color:${levelColor};">
                      ${r.pct}%
                    </div>
                    <div style="margin-top:10px;display:inline-block;background:${levelBg};color:${levelColor};border:1px solid ${levelColor};padding:8px 12px;font-size:14px;font-weight:bold;">
                      ${escapeHTML(r.level)}
                    </div>
                  </td>
                  <td width="50%" style="padding-left:12px;vertical-align:top;text-align:right;">
                    <div style="font-size:13px;color:#5f6b7a;text-transform:uppercase;font-weight:bold;">
                      Cumplimiento
                    </div>
                    <div style="margin-top:8px;font-size:42px;font-weight:bold;line-height:1;color:#172033;">
                      ${r.ok}/${r.total}
                    </div>
                    <div style="margin-top:8px;font-size:14px;color:#5f6b7a;">
                      Ítems OK / total evaluado
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:6px 24px 0 24px;">
              <div style="font-size:13px;color:#5f6b7a;text-transform:uppercase;font-weight:bold;margin-bottom:8px;">
                Semáforo ejecutivo
              </div>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:12px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width:18px;height:18px;background:${semOp};border:1px solid #bfc7d4;"></td>
                        <td style="padding-left:8px;font-size:14px;color:#172033;">Operativa</td>
                      </tr>
                    </table>
                  </td>
                  <td style="padding-right:12px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width:18px;height:18px;background:${semRisk};border:1px solid #bfc7d4;"></td>
                        <td style="padding-left:8px;font-size:14px;color:#172033;">En riesgo</td>
                      </tr>
                    </table>
                  </td>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width:18px;height:18px;background:${semCrit};border:1px solid #bfc7d4;"></td>
                        <td style="padding-left:8px;font-size:14px;color:#172033;">Crítica</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 24px 0 24px;">
              <div style="font-size:28px;font-weight:bold;color:#172033;margin-bottom:10px;">
                Prioridades inmediatas
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr style="background:#e9edf3;">
                  <th style="padding:10px;border:1px solid #d9dee7;text-align:center;font-size:14px;color:#172033;width:44px;">#</th>
                  <th style="padding:10px;border:1px solid #d9dee7;text-align:left;font-size:14px;color:#172033;">Área</th>
                  <th style="padding:10px;border:1px solid #d9dee7;text-align:left;font-size:14px;color:#172033;">Acción</th>
                </tr>
                ${priorityRows}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 24px 0 24px;">
              <div style="font-size:28px;font-weight:bold;color:#172033;margin-bottom:10px;">
                Resumen por área
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr style="background:#e9edf3;">
                  <th style="padding:10px;border:1px solid #d9dee7;text-align:left;font-size:14px;color:#172033;">Área</th>
                  <th style="padding:10px;border:1px solid #d9dee7;text-align:center;font-size:14px;color:#172033;">OK</th>
                  <th style="padding:10px;border:1px solid #d9dee7;text-align:center;font-size:14px;color:#172033;">%</th>
                </tr>
                ${areaRows}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 24px 0 24px;">
              <div style="font-size:28px;font-weight:bold;color:#172033;margin-bottom:10px;">
                Hallazgos detectados (${r.fails ? r.fails.length : 0})
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr style="background:#e9edf3;">
                  <th style="padding:10px;border:1px solid #d9dee7;text-align:left;font-size:14px;color:#172033;">Área</th>
                  <th style="padding:10px;border:1px solid #d9dee7;text-align:left;font-size:14px;color:#172033;">Detalle</th>
                </tr>
                ${failRows}
                ${moreFails}
              </table>
            </td>
          </tr>

                    ${
            generalNote || maintenanceNote || marketingNote
              ? `
                <tr>
                  <td style="padding:18px 24px 0 24px;">
                    <div style="font-size:28px;font-weight:bold;color:#172033;margin-bottom:10px;">
                      Recomendaciones y observaciones
                    </div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                      <tr style="background:#e9edf3;">
                        <th style="padding:10px;border:1px solid #d9dee7;text-align:left;font-size:14px;color:#172033;">Tipo</th>
                        <th style="padding:10px;border:1px solid #d9dee7;text-align:left;font-size:14px;color:#172033;">Detalle</th>
                      </tr>
                      ${generalNote ? `
                        <tr>
                          <td style="padding:10px;border:1px solid #d9dee7;font-size:14px;color:#172033;font-weight:bold;">Observación general</td>
                          <td style="padding:10px;border:1px solid #d9dee7;font-size:14px;color:#172033;">${escapeHTML(generalNote)}</td>
                        </tr>
                      ` : ""}
                      ${maintenanceNote ? `
                        <tr>
                          <td style="padding:10px;border:1px solid #d9dee7;font-size:14px;color:#172033;font-weight:bold;">Mantenimiento</td>
                          <td style="padding:10px;border:1px solid #d9dee7;font-size:14px;color:#172033;">${escapeHTML(maintenanceNote)}</td>
                        </tr>
                      ` : ""}
                      ${marketingNote ? `
                        <tr>
                          <td style="padding:10px;border:1px solid #d9dee7;font-size:14px;color:#172033;font-weight:bold;">Mercadeo</td>
                          <td style="padding:10px;border:1px solid #d9dee7;font-size:14px;color:#172033;">${escapeHTML(marketingNote)}</td>
                        </tr>
                      ` : ""}
                    </table>
                  </td>
                </tr>
              `
              : ""
          }

          <tr>
            <td style="padding:20px 24px 24px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #d9dee7;">
                <tr>
                  <td style="padding:12px 14px;font-size:13px;color:#5f6b7a;">
                    Generado por <strong>Checklist Operativo GZ (PWA)</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function applyRoleUI(){
  const role = String(getCurrentRole() || "").trim().toLowerCase();
  const btnStart = $("btnStart");

  const btnUsers = document.getElementById("btnUsers");

if(btnUsers){
  if(role === "admin"){
    btnUsers.classList.remove("hidden");
  } else {
    btnUsers.classList.add("hidden");
  }
}

  if(btnStart){
    btnStart.disabled = !canEvaluate();
    btnStart.style.opacity = canEvaluate() ? "1" : "0.6";
    btnStart.title = canEvaluate() ? "" : "Este usuario no tiene permiso para evaluar";
  }

  const startCardTitle = document.querySelector("#screenStart h1");
  const startCardText = document.querySelector("#screenStart .muted");

  if(startCardTitle) startCardTitle.textContent = "Iniciar evaluación";
  if(startCardText) startCardText.textContent = "Completá los campos y empezá pregunta por pregunta.";

  if(role === "supervisor"){
    if(startCardTitle) startCardTitle.textContent = "Consulta de historial";
    if(startCardText) startCardText.textContent = "Este usuario puede revisar historiales de su distrito, pero no iniciar evaluaciones.";
  }
}
/* =========================
   INIT
========================= */
function init(){
  populateStores();
  handleMailReturn();
  window.addEventListener("message", handleMailMessage);
  $("kNotes")?.addEventListener("input", saveCurrentNote);
  $("rGeneralNote")?.addEventListener("input", saveGeneralNotes);
  $("rMaintenanceNote")?.addEventListener("input", saveGeneralNotes);
  $("rMarketingNote")?.addEventListener("input", saveGeneralNotes);
  $("inStore")?.addEventListener("input", updateStorePreview);
  checkVersionAlignment();
  
  const d = new Date();
  const pad = (n)=>String(n).padStart(2,"0");
  $("inDate").value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  $("inTime").value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  $("btnStart").onclick = startEval;
  $("btnLogin").onclick = loginUser;
  $("btnLogout").onclick = logoutUser;
  $("btnSaveNewPass").onclick = saveNewPassword;
  $("btnCancelChangePass").onclick = cancelPasswordChange;
  $("btnGoLogin").onclick = ()=>{
  pendingPasswordUser = null;
  if($("changePassNew")) $("changePassNew").value = "";
  if($("changePassConfirm")) $("changePassConfirm").value = "";
  if($("changePassMsg")) $("changePassMsg").textContent = "";
  show("screenLogin");
};
  $("btnHistory").onclick = async ()=>{
  show("screenHistory");
  await renderHistory();
  };

  $("btnPerformance").onclick = async () => {
  await openPerformanceScreen();
};

$("btnAddPhoto").onclick = () => {
  if(evidences.length >= 25){
    toast("Máximo 25 fotos");
    return;
  }
  $("inputPhoto").click();
};

$("historySearch")?.addEventListener("input", () => {
  renderHistory();
});

$("historyUserFilter")?.addEventListener("change", () => {
  renderHistory();
});

$("historyLevelFilter")?.addEventListener("change", () => {
  renderHistory();
});

$("btnBackHome").onclick = ()=>show("screenStart");

$("btnBackFromPerformance").onclick = ()=>show("screenStart");

$("filterDistrict")?.addEventListener("change", async () => {
  showPerfLoading("Actualizando filtros...");
  try{
    refreshPerformanceFilters();
    await renderPerformance();
  } finally {
    hidePerfLoading();
  }
});

$("filterZone")?.addEventListener("change", async () => {
  showPerfLoading("Actualizando filtros...");
  try{
    refreshPerformanceFilters();
    await renderPerformance();
  } finally {
    hidePerfLoading();
  }
});

$("filterStore")?.addEventListener("change", async () => {
  showPerfLoading("Actualizando tienda...");
  try{
    await renderPerformance();
  } finally {
    hidePerfLoading();
  }
});

$("filterWeeks")?.addEventListener("change", async () => {
  showPerfLoading("Actualizando semanas...");
  try{
    toggleCustomWeeksInput();
    selectedPerformanceWeek = "";
    selectedPerformanceArea = "";
    selectedPerformanceStore = "";
    await renderPerformance();
  } finally {
    hidePerfLoading();
  }
});

$("filterWeeksCustom")?.addEventListener("input", async () => {
  showPerfLoading("Actualizando semanas...");
  try{
    selectedPerformanceWeek = "";
    selectedPerformanceArea = "";
    selectedPerformanceStore = "";
    await renderPerformance();
  } finally {
    hidePerfLoading();
  }
});

  $("btnYes").onclick = ()=>setAnswer(1);
  $("btnNo").onclick = ()=>setAnswer(0);
  $("btnBack").onclick = goBack;
  $("btnSaveDraft").onclick = cancelEval;
  $("btnCancel").onclick = ()=>{ current=null; show("screenStart"); };

  $("btnFinish").onclick = finishEval;
  $("btnExport").onclick = ()=>{ if(current) exportCSV(current); };
  $("btnSync").onclick = ()=>syncPending(current?.id || null);
  $("btnNew").onclick = ()=>{ current=null; show("screenStart"); };

  $("loginUser")?.addEventListener("keydown", (e)=>{
  if(e.key === "Enter") loginUser();
});
$("loginPass")?.addEventListener("keydown", (e)=>{
  if(e.key === "Enter") loginUser();
});
$("changePassNew")?.addEventListener("keydown", (e)=>{
  if(e.key === "Enter") saveNewPassword();
});

$("changePassConfirm")?.addEventListener("keydown", (e)=>{
  if(e.key === "Enter") saveNewPassword();
});

// ===== USUARIOS (ADMIN) =====

$("btnUsers")?.addEventListener("click", async () => {
  const formCard = $("userFormCard");
  if(formCard) formCard.classList.add("hidden");
  resetUserForm();
  show("screenUsers");
  await loadUsers();
});

$("btnBackFromUsers")?.addEventListener("click", () => {
  show("screenStart");
});

$("btnNewUser")?.addEventListener("click", () => {
  resetUserForm();
  const formCard = $("userFormCard");
  if(formCard) formCard.classList.remove("hidden");
  formCard?.scrollIntoView({ behavior: "smooth", block: "start" });
});

$("btnSaveUser")?.addEventListener("click", async () => {
  await saveUserFromForm();
});

$("usersSearch")?.addEventListener("input", () => {
  renderUsers();
});

  // if("serviceWorker" in navigator){
//   navigator.serviceWorker.register("./sw.js").catch(()=>{});
// }

 updateSessionUI();
applySessionToForm();
applyRoleUI();


const session = loadSession();
if(session && session.username){
  show("screenStart");
} else {
  show("screenLogin");
}
}
window.addEventListener("load", init);

function getCurrentRole(){
  return String(loadSession()?.role || "").trim().toLowerCase();
}

function getCurrentDistrict(){
  return String(loadSession()?.district || "").trim().toUpperCase();
}

function getCurrentUsername(){
  return String(loadSession()?.username || "").trim().toLowerCase();
}

function canEvaluate(){
  const role = getCurrentRole();
  return role === "admin" || role === "evaluador";
}

function canViewAllDistrictHistory(){
  const role = getCurrentRole();
  return role === "admin" || role === "supervisor";
}

function show(screenId){
  ["screenLogin","screenChangePassword","screenStart","screenCheck","screenResult","screenHistory","screenPerformance","screenUsers"].forEach(id=>{
    const s = $(id);
    if(s) s.classList.toggle("hidden", id!==screenId);
  });
  window.scrollTo({top:0, behavior:"smooth"});
}

function renderPhotoList(){
  const targets = [$("photoList"), $("resultPhotoList")].filter(Boolean);
  if(!targets.length) return;

  targets.forEach(wrap => {
    wrap.style.display = "grid";
    wrap.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
    wrap.style.gap = "12px";
    wrap.style.alignItems = "start";

    wrap.innerHTML = "";

    evidences.forEach((ev, i) => {
      const div = document.createElement("div");
      div.className = "photoItem";
      div.style.width = "100%";
      div.style.minWidth = "0";

      div.innerHTML = `
        <div class="photoTop">
          <div class="photoBadge">${ev.type || "Operativo"} · Foto ${i + 1}${ev.sizeKB ? ` · ${ev.sizeKB} KB` : ""}</div>
          <button type="button" class="btn sm danger" onclick="removePhoto(${i})">Eliminar</button>
        </div>

        <img
          src="${ev.image}"
          class="photoPreview"
          alt="Evidencia ${i + 1}"
          style="width:100%;height:160px;object-fit:cover;border-radius:12px;"
        />

        <div class="photoMeta">
          <textarea
            class="photoNote"
            placeholder="Describe esta evidencia..."
            oninput="updatePhotoNote(${i}, this.value)"
          >${escapeHTML(ev.note || "")}</textarea>
        </div>
      `;

      wrap.appendChild(div);
    });
  });
}

function updatePhotoCounter(){
  const text = `${evidences.length} / 25 fotos cargadas`;

  const el1 = $("photoCounter");
  const el2 = $("resultPhotoCounter");

  if(el1) el1.textContent = text;
  if(el2) el2.textContent = text;
}

function removePhoto(i){
  evidences.splice(i, 1);
  renderPhotoList();
  updatePhotoCounter();
  saveEvidenceState();
}

function updatePhotoNote(i, value){
  if(!evidences[i]) return;
  evidences[i].note = String(value || "");
  saveEvidenceState();
}

function saveEvidenceState(){
  if(!current) return;

  // Las fotos quedan solo en memoria en la variable evidences.
  // No se guardan en current ni en localStorage.
  current.updatedAt = nowISO();
}

function blobToBase64(blob){
  return new Promise((resolve, reject) => {
    try{
      const reader = new FileReader();

      reader.onloadend = () => {
        const result = String(reader.result || "");
        if(!result){
          reject(new Error("Base64 vacío"));
          return;
        }
        resolve(result);
      };

      reader.onerror = () => reject(new Error("No se pudo convertir blob a base64"));
      reader.readAsDataURL(blob);
    }catch(e){
      reject(e);
    }
  });
}

function compressImage(file, maxWidth = 900, quality = 0.60){
  return new Promise((resolve) => {
    const fallbackOriginal = async () => {
      try{
        const originalBase64 = await blobToBase64(file);
        const sizeKB = Math.round((originalBase64.length * 3 / 4) / 1024);

        resolve({
          base64: originalBase64,
          sizeKB,
          width: 0,
          height: 0,
          fallback: true
        });
      }catch(e){
        resolve(null);
      }
    };

    try{
      if(!file || !String(file.type || "").startsWith("image/")){
        fallbackOriginal();
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        try{
          let width = img.naturalWidth || img.width || 0;
          let height = img.naturalHeight || img.height || 0;

          if(!width || !height){
            URL.revokeObjectURL(objectUrl);
            fallbackOriginal();
            return;
          }

          if(width > maxWidth){
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if(!ctx){
            URL.revokeObjectURL(objectUrl);
            fallbackOriginal();
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(async (blob) => {
            URL.revokeObjectURL(objectUrl);

            if(!blob){
              fallbackOriginal();
              return;
            }

            try{
              const base64 = await blobToBase64(blob);
              const sizeKB = Math.round((base64.length * 3 / 4) / 1024);

              resolve({
                base64,
                sizeKB,
                width,
                height,
                fallback: false
              });
            }catch(e){
              fallbackOriginal();
            }
          }, "image/jpeg", quality);

        }catch(e){
          URL.revokeObjectURL(objectUrl);
          fallbackOriginal();
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        fallbackOriginal();
      };

      img.src = objectUrl;
    }catch(e){
      fallbackOriginal();
    }
  });
}
$("inputPhoto").onchange = async (e) => {
  const file = e.target.files[0];
  if(!file) return;

  if(evidences.length >= 25){
    toast("Máximo 25 fotos");
    e.target.value = "";
    return;
  }

  try{
    const compressed = await compressImage(file, 700, 0.45);

    if(!compressed || !compressed.base64){
  console.error("Imagen inválida o vacía");
  toast("La foto no pudo convertirse. Tomala nuevamente.", 3000);
  e.target.value = "";
  return;
}

    const type = $("photoType")?.value || "Operativo";

    evidences.push({
      image: compressed.base64,
      note: "",
      type,
      sizeKB: compressed.sizeKB
    });

    renderPhotoList();
    updatePhotoCounter();
    saveEvidenceState();

    if(compressed.fallback){
      toast("Imagen agregada sin compresión", 2200);
    }
  }catch(err){
  console.error(err);
  toast("No se pudo guardar la foto en el dispositivo. Probá tomarla de nuevo.", 3200);
}

  e.target.value = "";
};

async function loadUsers(){
  if(getCurrentRole() !== "admin"){
    toast("Solo admin puede ver usuarios");
    return;
  }

  try{
    const data = await jsonpRequest(
      `${SCRIPT_URL}?users=1&role=${encodeURIComponent(getCurrentRole())}`,
      8000
    );

    if(!data || !data.ok){
      $("usersList").innerHTML = `<div class="muted">No se pudieron cargar usuarios.</div>`;
      return;
    }

    const incomingUsers = Array.isArray(data.items) ? data.items : [];
const existingUsers = loadUsersCache();

usersCache = incomingUsers.map(u => {
  const old = existingUsers.find(x =>
    String(x.username || "").toLowerCase() === String(u.username || "").toLowerCase()
  );

  return {
    ...u,
    passwordHash: old?.passwordHash || ""
  };
});

saveUsersCache(usersCache);
    renderUsers();
  }catch(e){
    console.error("Error cargando usuarios:", e);
    $("usersList").innerHTML = `<div class="muted">Error cargando usuarios.</div>`;
  }
}

function renderUsers(){
  const wrap = $("usersList");
  if(!wrap) return;

  const term = String($("usersSearch")?.value || "").trim().toLowerCase();

  const filtered = usersCache.filter(u => {
    if(!term) return true;
    const txt = `
      ${u.username || ""}
      ${u.name || ""}
      ${u.role || ""}
      ${u.active || ""}
      ${u.district || ""}
      ${u.zone || ""}
    `.toLowerCase();
    return txt.includes(term);
  });

  if(!filtered.length){
    wrap.innerHTML = `<div class="muted">No hay usuarios para mostrar.</div>`;
    return;
  }

  wrap.innerHTML = filtered.map(u => `
    <div class="histRow">
      <div class="histTop">
        <div class="histTitle">${escapeHTML(u.name || "")} (${escapeHTML(u.username || "")})</div>
        <div class="histBadge ${u.active === "SI" ? "ok" : "pend"}">${escapeHTML(u.active || "NO")}</div>
      </div>
      <div class="histMeta">
        Rol: ${escapeHTML(u.role || "")} • Distrito: ${escapeHTML(u.district || "")} • Zona: ${escapeHTML(u.zone || "")} • Debe cambiar: ${escapeHTML(u.mustChangePassword || "NO")}
      </div>
      <div class="histBtns">
        <button class="btn sm" type="button" onclick="editUser('${escapeHTML(u.username || "")}')">Editar</button>
      </div>
    </div>
  `).join("");
}

function resetUserForm(){
  editingUser = null;
  isNewUserMode = true;

  $("userFormTitle").textContent = "Nuevo usuario";
  $("uUsername").value = "";
  $("uName").value = "";
  $("uPassword").value = "";
  $("uRole").value = "evaluador";
  $("uActive").value = "SI";
  $("uMustChangePassword").value = "SI";
  $("uDistrict").value = "";
  $("uZone").value = "";
  $("usersMsg").textContent = "";
}

function editUser(username){
  const user = usersCache.find(x => String(x.username || "").toLowerCase() === String(username || "").toLowerCase());
  if(!user) return;

  editingUser = user.username;
  isNewUserMode = false;

  $("userFormTitle").textContent = "Editar usuario";
  $("uUsername").value = user.username || "";
  $("uName").value = user.name || "";
  $("uPassword").value = "";
  $("uRole").value = user.role || "evaluador";
  $("uActive").value = user.active || "SI";
  $("uMustChangePassword").value = user.mustChangePassword || "NO";
  $("uDistrict").value = user.district || "";
  $("uZone").value = user.zone || "";
  $("usersMsg").textContent = "";

  const formCard = $("userFormCard");
if(formCard) formCard.classList.remove("hidden");
formCard?.scrollIntoView({ behavior: "smooth", block: "start" });
}


async function saveUserFromForm(){
  const msgEl = $("usersMsg");
  if(msgEl) msgEl.textContent = "";

  const username = String($("uUsername")?.value || "").trim().toLowerCase();
  const name = String($("uName")?.value || "").trim();
  const password = String($("uPassword")?.value || "").trim();
  const userRole = String($("uRole")?.value || "").trim().toLowerCase();
  const active = String($("uActive")?.value || "SI").trim().toUpperCase();
  const mustChangePassword = String($("uMustChangePassword")?.value || "NO").trim().toUpperCase();
  const district = String($("uDistrict")?.value || "").trim().toUpperCase();
  const zone = String($("uZone")?.value || "").trim().toUpperCase();

  if(!username){
    if(msgEl) msgEl.textContent = "Falta usuario";
    return;
  }

  if(!name){
    if(msgEl) msgEl.textContent = "Falta nombre";
    return;
  }

  try{
    const url =
      `${SCRIPT_URL}?saveUser=1` +
      `&role=${encodeURIComponent(getCurrentRole())}` +
      `&isNew=${encodeURIComponent(isNewUserMode ? "1" : "0")}` +
      `&username=${encodeURIComponent(username)}` +
      `&name=${encodeURIComponent(name)}` +
      `&password=${encodeURIComponent(password)}` +
      `&userRole=${encodeURIComponent(userRole)}` +
      `&active=${encodeURIComponent(active)}` +
      `&mustChangePassword=${encodeURIComponent(mustChangePassword)}` +
      `&district=${encodeURIComponent(district)}` +
      `&zone=${encodeURIComponent(zone)}`;

    const data = await jsonpRequest(url, 8000);

    if(!data || !data.ok){
      if(msgEl) msgEl.textContent = data?.error || "No se pudo guardar";
      return;
    }

    if(msgEl) msgEl.textContent = data.message || "Guardado correctamente";
    await loadUsers();
    resetUserForm();
    const formCard = $("userFormCard");
    if(formCard) formCard.classList.add("hidden");
    toast("Usuario guardado ✅", 2200);
  }catch(e){
    console.error("Error guardando usuario:", e);
    if(msgEl) msgEl.textContent = "Error guardando usuario";
  }
}

let swRegistration = null;
let refreshingPage = false;

function showUpdateBanner() {
  const banner = document.getElementById("updateBanner");
  if (banner) banner.style.display = "block";
}

function hideUpdateBanner() {
  const banner = document.getElementById("updateBanner");
  if (banner) banner.style.display = "none";
}

function setupUpdateButton() {
  const btn = document.getElementById("btnUpdateNow");
  if (!btn) return;

  btn.addEventListener("click", () => {
    if (!swRegistration || !swRegistration.waiting) return;
    swRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      swRegistration = await navigator.serviceWorker.register("./sw.js");

      setupUpdateButton();

      if (swRegistration.waiting) {
        showUpdateBanner();
      }

      swRegistration.addEventListener("updatefound", () => {
        const newWorker = swRegistration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            showUpdateBanner();
          }
        });
      });

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshingPage) return;
        refreshingPage = true;
        window.location.reload();
      });
    } catch (err) {
      console.error("Error registrando SW:", err);
    }
  });
}
