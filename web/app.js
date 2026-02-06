const STORAGE_KEY = "leite_estoque_pwa";

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

const today = new Date().toISOString().slice(0, 10);
entradaForm.data.value = today;
saidaForm.data.value = today;

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

function loadData() {
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

function saveData(movimentos) {
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

function atualizarUI() {
  const movimentos = loadData();
  const saldo = calcularSaldoTotal(movimentos);
  saldoTotalEl.textContent = `${saldo} ml`;

  const ultima = movimentos[movimentos.length - 1];
  ultimaMovEl.textContent = ultima
    ? `${ultima.tipo} · ${totalMl(ultima)} ml`
    : "-";

  const saldoVolume = calcularSaldoPorVolume(movimentos);
  const saldoRows = Object.keys(saldoVolume)
    .sort((a, b) => Number(a) - Number(b))
    .map((volume) => ({
      title: `${volume} ml`,
      value: `${saldoVolume[volume]} ml`,
    }));
  renderTabela(saldoPorVolumeEl, saldoRows);

  const fifo = entradasComSaldo(movimentos);
  const fifoRows = fifo.slice(0, 6).map((item) => ({
    title: `${item.movimento.volume_ml} ml · ${item.movimento.quantidade_sacos} saco(s)`,
    value: `Restante: ${item.restante} ml | Validade: ${item.movimento.validade || "n/a"}`,
  }));
  renderTabela(fifoListaEl, fifoRows);

  const historicoRows = movimentos
    .slice(-6)
    .reverse()
    .map((mov) => ({
      title: `${mov.tipo.toUpperCase()} · ${mov.data}`,
      value: `${totalMl(mov)} ml | ${mov.observacao || "-"}`,
    }));
  renderTabela(historicoEl, historicoRows);
}

entradaForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(entradaForm);
  const movimento = {
    tipo: "entrada",
    data: formData.get("data"),
    volume_ml: Number(formData.get("volume_ml")),
    quantidade_sacos: Number(formData.get("quantidade_sacos")),
    local: formData.get("local"),
    data_ordenha: formData.get("data_ordenha") || "",
    validade: formData.get("validade") || "",
    observacao: formData.get("observacao") || "",
  };

  const movimentos = loadData();
  movimentos.push(movimento);
  saveData(movimentos);
  entradaForm.reset();
  entradaForm.data.value = today;
  atualizarUI();
});

saidaForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saidaErroEl.textContent = "";
  const formData = new FormData(saidaForm);
  const movimento = {
    tipo: "saida",
    data: formData.get("data"),
    volume_ml: Number(formData.get("volume_ml")),
    quantidade_sacos: Number(formData.get("quantidade_sacos")),
    local: "",
    data_ordenha: "",
    validade: "",
    observacao: formData.get("observacao") || "",
  };

  const movimentos = loadData();
  const saldo = calcularSaldoTotal(movimentos);
  const saidaTotal = totalMl(movimento);
  if (saidaTotal > saldo) {
    saidaErroEl.textContent = `Saída inválida: ${saidaTotal} ml excede o saldo (${saldo} ml).`;
    return;
  }

  movimentos.push(movimento);
  saveData(movimentos);
  saidaForm.reset();
  saidaForm.data.value = today;
  atualizarUI();
});

exportBtn.addEventListener("click", () => {
  const data = loadData();
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
      saveData(parsed);
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

atualizarUI();
