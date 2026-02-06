import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const STORAGE_KEY = "leite_estoque_pwa";
const PENDING_KEY = "leite_estoque_pending";
const FAMILY_KEY = "leite_estoque_family";

const authSection = document.getElementById("authSection");
const familySection = document.getElementById("familySection");
const appSection = document.getElementById("appSection");
const entradaSection = document.getElementById("entrada");
const saidaSection = document.getElementById("saida");
const relatorioSection = document.getElementById("relatorio");
const backupSection = document.getElementById("backup");

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const authMessage = document.getElementById("authMessage");
const logoutBtn = document.getElementById("logoutBtn");

const createFamilyForm = document.getElementById("createFamilyForm");
const joinFamilyForm = document.getElementById("joinFamilyForm");
const familyMessage = document.getElementById("familyMessage");
const familyInfo = document.getElementById("familyInfo");

const entradaForm = document.getElementById("entradaForm");
const saidaForm = document.getElementById("saidaForm");
const saldoTotalEl = document.getElementById("saldoTotal");
const ultimaMovEl = document.getElementById("ultimaMov");
const saldoPorVolumeEl = document.getElementById("saldoPorVolume");
const fifoListaEl = document.getElementById("fifoLista");
const historicoEl = document.getElementById("historico");
const saidaErroEl = document.getElementById("saidaErro");
const exportBtn = document.getElementById("exportBtn");
const importInput = document.getElementById("importInput");
const installBtn = document.getElementById("installBtn");
const syncStatusEl = document.getElementById("syncStatus");

const today = new Date().toISOString().slice(0, 10);
entradaForm.data.value = today;
saidaForm.data.value = today;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let state = {
  user: null,
  familyId: null,
  familyCode: null,
  movimentos: [],
  pending: loadPending(),
};

let installPrompt = null;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installBtn.hidden = false;
});

installBtn.addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installBtn.hidden = true;
});

function showSection(section, show) {
  section.classList.toggle("hidden", !show);
}

function updateView() {
  const hasUser = Boolean(state.user);
  const hasFamily = Boolean(state.familyId);

  showSection(authSection, !hasUser);
  showSection(familySection, hasUser && !hasFamily);
  showSection(appSection, hasUser && hasFamily);
  showSection(entradaSection, hasUser && hasFamily);
  showSection(saidaSection, hasUser && hasFamily);
  showSection(relatorioSection, hasUser && hasFamily);
  showSection(backupSection, hasUser && hasFamily);

  logoutBtn.hidden = !hasUser;
}

function setMessage(el, message = "", isError = true) {
  el.textContent = message;
  el.style.color = isError ? "var(--warning)" : "var(--primary)";
}

function loadPending() {
  const raw = localStorage.getItem(PENDING_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Erro ao ler pendências", error);
    return [];
  }
}

function savePending(pending) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

function loadCachedMovimentos() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Erro ao ler dados", error);
    return [];
  }
}

function saveCachedMovimentos(movimentos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(movimentos));
}

function totalMl(movimento) {
  return Number(movimento.volume_ml) * Number(movimento.quantidade_sacos);
}

function calcularSaldoTotal(movimentos) {
  return movimentos.reduce((acc, mov) => {
    return acc + (mov.tipo === "entrada" ? totalMl(mov) : -totalMl(mov));
  }, 0);
}

function calcularSaldoPorVolume(movimentos) {
  const saldo = {};
  movimentos.forEach((mov) => {
    const volume = Number(mov.volume_ml);
    saldo[volume] = saldo[volume] ?? 0;
    saldo[volume] += mov.tipo === "entrada" ? totalMl(mov) : -totalMl(mov);
  });
  return saldo;
}

function ordenarEntradas(entradas) {
  return [...entradas].sort((a, b) => {
    const dataA = a.validade || a.data_ordenha || a.data;
    const dataB = b.validade || b.data_ordenha || b.data;
    return dataA.localeCompare(dataB);
  });
}

function entradasComSaldo(movimentos) {
  const entradas = movimentos.filter((mov) => mov.tipo === "entrada");
  const saidas = movimentos.filter((mov) => mov.tipo === "saida");
  const entradasOrdenadas = ordenarEntradas(entradas).map((mov) => ({
    movimento: mov,
    restante: totalMl(mov),
  }));
  let totalSaida = saidas.reduce((acc, mov) => acc + totalMl(mov), 0);
  entradasOrdenadas.forEach((item) => {
    if (totalSaida <= 0) return;
    const consumo = Math.min(item.restante, totalSaida);
    item.restante -= consumo;
    totalSaida -= consumo;
  });
  return entradasOrdenadas.filter((item) => item.restante > 0);
}

function renderTabela(element, rows) {
  element.innerHTML = "";
  if (!rows.length) {
    element.innerHTML = "<p class=\"muted\">Sem dados.</p>";
    return;
  }
  rows.forEach((row) => {
    const div = document.createElement("div");
    div.className = "table-item";
    div.innerHTML = `<strong>${row.title}</strong><span>${row.value}</span>`;
    element.appendChild(div);
  });
}

function updateSyncStatus() {
  if (!navigator.onLine) {
    syncStatusEl.textContent = "Offline: salvando localmente.";
    return;
  }
  if (state.pending.length) {
    syncStatusEl.textContent = `Sincronizando ${state.pending.length} pendência(s)...`;
  } else {
    syncStatusEl.textContent = "Sincronizado com a família.";
  }
}

function atualizarUI() {
  const movimentosComPendencia = [...state.movimentos, ...state.pending.map((p) => p.movimento)];
  const saldo = calcularSaldoTotal(movimentosComPendencia);
  saldoTotalEl.textContent = `${saldo} ml`;

  const ultima = movimentosComPendencia[movimentosComPendencia.length - 1];
  ultimaMovEl.textContent = ultima
    ? `${ultima.tipo} · ${totalMl(ultima)} ml`
    : "-";

  const saldoVolume = calcularSaldoPorVolume(movimentosComPendencia);
  const saldoRows = Object.keys(saldoVolume)
    .sort((a, b) => Number(a) - Number(b))
    .map((volume) => ({
      title: `${volume} ml`,
      value: `${saldoVolume[volume]} ml`,
    }));
  renderTabela(saldoPorVolumeEl, saldoRows);

  const fifo = entradasComSaldo(movimentosComPendencia);
  const fifoRows = fifo.slice(0, 6).map((item) => ({
    title: `${item.movimento.volume_ml} ml · ${item.movimento.quantidade_sacos} saco(s)`,
    value: `Restante: ${item.restante} ml | Validade: ${item.movimento.validade || "n/a"}`,
  }));
  renderTabela(fifoListaEl, fifoRows);

  const historicoRows = movimentosComPendencia
    .slice(-6)
    .reverse()
    .map((mov) => ({
      title: `${mov.tipo.toUpperCase()} · ${mov.data}`,
      value: `${totalMl(mov)} ml | ${mov.observacao || "-"}`,
    }));
  renderTabela(historicoEl, historicoRows);

  updateSyncStatus();
}

function generateFamilyCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function handleSession() {
  const { data } = await supabase.auth.getSession();
  state.user = data.session?.user ?? null;
  updateView();
  if (state.user) {
    await loadFamily();
  }
}

async function loadFamily() {
  const storedFamily = localStorage.getItem(FAMILY_KEY);
  if (storedFamily) {
    try {
      const parsed = JSON.parse(storedFamily);
      state.familyId = parsed.familyId;
      state.familyCode = parsed.familyCode;
    } catch (error) {
      console.error("Erro ao carregar família", error);
    }
  }

  if (!state.familyId) {
    const { data, error } = await supabase
      .from("family_members")
      .select("family_id, families(code, name)")
      .eq("user_id", state.user.id)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error(error);
    }
    if (data) {
      state.familyId = data.family_id;
      state.familyCode = data.families?.code ?? null;
      localStorage.setItem(
        FAMILY_KEY,
        JSON.stringify({ familyId: state.familyId, familyCode: state.familyCode })
      );
    }
  }

  if (state.familyId) {
    familyInfo.innerHTML = `Você está na família <strong>${state.familyCode ?? ""}</strong>.`;
    updateView();
    await loadMovimentos();
    await flushPending();
  }

  updateView();
}

async function createFamily(name) {
  familyMessage.textContent = "";
  const code = generateFamilyCode();
  const { data, error } = await supabase
    .from("families")
    .insert({ code, name: name || null, created_by: state.user.id })
    .select()
    .single();

  if (error) {
    setMessage(familyMessage, "Não foi possível criar a família.");
    return;
  }

  const { error: memberError } = await supabase
    .from("family_members")
    .insert({ family_id: data.id, user_id: state.user.id });

  if (memberError) {
    setMessage(familyMessage, "Família criada, mas não foi possível entrar.");
    return;
  }

  state.familyId = data.id;
  state.familyCode = data.code;
  localStorage.setItem(
    FAMILY_KEY,
    JSON.stringify({ familyId: state.familyId, familyCode: state.familyCode })
  );

  familyInfo.innerHTML = `Código da família: <strong>${data.code}</strong>`;
  updateView();
  await loadMovimentos();
  await flushPending();
}

async function joinFamily(code) {
  familyMessage.textContent = "";
  const { data, error } = await supabase.rpc("join_family_by_code", { p_code: code });
  if (error) {
    setMessage(familyMessage, "Não foi possível entrar na família.");
    return;
  }
  state.familyId = data;
  state.familyCode = code;
  localStorage.setItem(
    FAMILY_KEY,
    JSON.stringify({ familyId: state.familyId, familyCode: state.familyCode })
  );
  familyInfo.innerHTML = `Você entrou na família <strong>${code}</strong>.`;
  updateView();
  await loadMovimentos();
  await flushPending();
}

async function loadMovimentos() {
  if (!state.familyId) return;
  const cached = loadCachedMovimentos();
  if (cached.length) {
    state.movimentos = cached;
  }
  atualizarUI();

  if (!navigator.onLine) {
    return;
  }

  const { data, error } = await supabase
    .from("milk_movements")
    .select("*")
    .eq("family_id", state.familyId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  state.movimentos = data;
  saveCachedMovimentos(data);
  atualizarUI();
}

function addToPending(movimento) {
  const entry = { id: crypto.randomUUID(), movimento, createdAt: new Date().toISOString() };
  state.pending.push(entry);
  savePending(state.pending);
  atualizarUI();
}

async function flushPending() {
  if (!navigator.onLine || !state.pending.length || !state.familyId) {
    updateSyncStatus();
    return;
  }

  const pendingCopy = [...state.pending];
  const remaining = [];

  for (const item of pendingCopy) {
    const { error } = await supabase.from("milk_movements").insert(item.movimento);
    if (error) {
      remaining.push(item);
    } else {
      state.movimentos.push(item.movimento);
    }
  }

  state.pending = remaining;
  savePending(state.pending);
  saveCachedMovimentos(state.movimentos);
  atualizarUI();
}

function buildMovimento(formData, tipo) {
  return {
    family_id: state.familyId,
    user_id: state.user.id,
    tipo,
    data: formData.get("data"),
    volume_ml: Number(formData.get("volume_ml")),
    quantidade_sacos: Number(formData.get("quantidade_sacos")),
    local: tipo === "entrada" ? formData.get("local") : "",
    data_ordenha: tipo === "entrada" ? formData.get("data_ordenha") || null : null,
    validade: tipo === "entrada" ? formData.get("validade") || null : null,
    observacao: formData.get("observacao") || "",
  };
}

async function inserirMovimento(movimento) {
  if (!navigator.onLine) {
    addToPending(movimento);
    return;
  }
  const { error } = await supabase.from("milk_movements").insert(movimento);
  if (error) {
    addToPending(movimento);
    return;
  }
  state.movimentos.push(movimento);
  saveCachedMovimentos(state.movimentos);
  atualizarUI();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authMessage.textContent = "";
  const formData = new FormData(loginForm);
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (error) {
    setMessage(authMessage, "Email ou senha inválidos.");
  }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authMessage.textContent = "";
  const formData = new FormData(signupForm);
  const { error } = await supabase.auth.signUp({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (error) {
    setMessage(authMessage, "Não foi possível cadastrar.");
  } else {
    setMessage(authMessage, "Conta criada! Verifique seu email se necessário.", false);
  }
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  state = {
    user: null,
    familyId: null,
    familyCode: null,
    movimentos: [],
    pending: loadPending(),
  };
  localStorage.removeItem(FAMILY_KEY);
  updateView();
});

createFamilyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(createFamilyForm);
  await createFamily(formData.get("name"));
});

joinFamilyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(joinFamilyForm);
  await joinFamily(formData.get("code").toUpperCase().trim());
});

entradaForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(entradaForm);
  const movimento = buildMovimento(formData, "entrada");
  await inserirMovimento(movimento);
  entradaForm.reset();
  entradaForm.data.value = today;
});

saidaForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  saidaErroEl.textContent = "";
  const formData = new FormData(saidaForm);
  const movimento = buildMovimento(formData, "saida");

  const movimentosComPendencia = [...state.movimentos, ...state.pending.map((p) => p.movimento)];
  const saldo = calcularSaldoTotal(movimentosComPendencia);
  const saidaTotal = totalMl(movimento);
  if (saidaTotal > saldo) {
    saidaErroEl.textContent = `Saída inválida: ${saidaTotal} ml excede o saldo (${saldo} ml).`;
    return;
  }

  await inserirMovimento(movimento);
  saidaForm.reset();
  saidaForm.data.value = today;
});

exportBtn.addEventListener("click", () => {
  const data = [...state.movimentos, ...state.pending.map((p) => p.movimento)];
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "leite_estoque_backup.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed)) {
        throw new Error("Arquivo inválido");
      }
      state.movimentos = parsed;
      saveCachedMovimentos(parsed);
      atualizarUI();
    } catch (error) {
      alert("Não foi possível importar o backup.");
    }
  };
  reader.readAsText(file);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js");
  });
}

window.addEventListener("online", () => {
  flushPending();
  loadMovimentos();
});

supabase.auth.onAuthStateChange((_event, session) => {
  state.user = session?.user ?? null;
  updateView();
  if (state.user) {
    loadFamily();
  }
});

handleSession();
updateView();
