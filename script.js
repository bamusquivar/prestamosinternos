
let registros = [];
let filtroArea = "todas";

// Convención de saldo:
// Para cada área, saldo = devoluciones - solicitudes.
// Es decir, si Tesorería registra muchas SOLICITUDES, su saldo tiende a ser negativo (le deben).
// Si registra muchas DEVOLUCIONES, su saldo es positivo (tiene saldo a favor).

function parseNumber(str) {
  if (!str) return 0;
  const clean = String(str).replace(/,/g, "");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

function formatNumber(n) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function saveData() {
  const tipo = document.getElementById("tipo").value;
  const fecha = document.getElementById("fechaSolicitud").value;
  const compania = document.getElementById("compania").value;
  const area = document.getElementById("area").value;
  const moneda = document.getElementById("moneda").value;
  const montoInput = document.getElementById("monto").value;
  const aprobado = document.getElementById("aprobado").value;
  const responsable = document.getElementById("responsable").value;
  const referencia = document.getElementById("referencia").value;

  const montoNum = parseNumber(montoInput);
  const montoFmt = formatNumber(montoNum);

  const reg = {
    tipo,
    fecha,
    compania,
    area,
    moneda,
    monto: montoFmt,
    montoNum,
    aprobado,
    responsable,
    referencia
  };

  registros.push(reg);
  applyFilters();
  alert("Operación guardada. Si trabajas con base compartida, no olvides sincronizar con SharePoint (cuando TI lo habilite).");
}

function applyFilters() {
  const selectArea = document.getElementById("filtroArea");
  filtroArea = selectArea.value;
  renderTable();
  updateKpis();
}

function renderTable() {
  const tbody = document.getElementById("historialBody");
  const badgeCount = document.getElementById("badgeCount");
  tbody.innerHTML = "";

  const filtrados = registros.filter(r => {
    if (filtroArea === "todas") return true;
    return r.area === filtroArea;
  });

  if (filtrados.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 9;
    td.className = "empty-placeholder";
    td.textContent = "No hay registros para el filtro seleccionado.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    badgeCount.textContent = "0 registros";
    return;
  }

  filtrados.forEach(r => {
    const tr = document.createElement("tr");

    const tdTipo = document.createElement("td");
    const spanTipo = document.createElement("span");
    spanTipo.className = "tag-op " + (r.tipo === "Solicitud de préstamo" ? "tag-solicitud" : "tag-devolucion");
    spanTipo.textContent = r.tipo === "Solicitud de préstamo" ? "Solicitud" : "Devolución";
    tdTipo.appendChild(spanTipo);
    tr.appendChild(tdTipo);

    ["fecha","compania","area","moneda"].forEach(key => {
      const td = document.createElement("td");
      td.textContent = r[key] || "";
      tr.appendChild(td);
    });

    const tdMonto = document.createElement("td");
    tdMonto.textContent = r.monto;
    tr.appendChild(tdMonto);

    const tdAprobado = document.createElement("td");
    tdAprobado.textContent = r.aprobado || "";
    tr.appendChild(tdAprobado);

    const tdResp = document.createElement("td");
    tdResp.textContent = r.responsable || "";
    tr.appendChild(tdResp);

    const tdRef = document.createElement("td");
    tdRef.textContent = r.referencia || "";
    tr.appendChild(tdRef);

    tbody.appendChild(tr);
  });

  badgeCount.textContent = filtrados.length + (filtrados.length === 1 ? " registro" : " registros");
}

function updateKpis() {
  let saldoTes = 0;
  let saldoInv = 0;

  registros.forEach(r => {
    let factor = r.tipo === "Devolución" ? 1 : -1; // devolución suma, solicitud resta
    if (r.area === "Tesorería") {
      saldoTes += factor * r.montoNum;
    } else if (r.area === "Inversiones") {
      saldoInv += factor * r.montoNum;
    }
  });

  const total = saldoTes + saldoInv;

  document.getElementById("kpiTesoreria").textContent = formatNumber(saldoTes);
  document.getElementById("kpiInversiones").textContent = formatNumber(saldoInv);
  document.getElementById("kpiTotal").textContent = formatNumber(total);
}

// Exporta a CSV que Excel abre directamente
function exportCsv() {
  if (registros.length === 0) {
    alert("No hay registros para exportar.");
    return;
  }
  let csv = "Tipo,Fecha,Compañía,Área,Moneda,Monto,Aprobado,Responsable,Referencia\n";
  registros.forEach(r => {
    const row = [
      r.tipo, r.fecha, r.compania, r.area, r.moneda,
      r.monto, r.aprobado, r.responsable, r.referencia
    ].map(v => {
      if (v === null || v === undefined) return "";
      const s = String(v).replace(/"/g,'""');
      return `"${s}"`;
    });
    csv += row.join(",") + "\n";
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "PrestamosInternos.csv";
  a.click();
}

// Guardar / cargar base local (JSON) – puede usarse con OneDrive/SharePoint carpeta sincronizada
async function saveToFile() {
  try {
    const json = JSON.stringify(registros, null, 2);
    const blob = new Blob([json], { type: "application/json" });

    if (!window.showSaveFilePicker) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "basePrestamos.json";
      a.click();
      return;
    }

    const handle = await window.showSaveFilePicker({
      suggestedName: "basePrestamos.json",
      types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    alert("Base exportada. Guarda este archivo en tu carpeta compartida (OneDrive/SharePoint).");
  } catch (e) {
    console.error(e);
  }
}

async function loadFromFile() {
  try {
    if (!window.showOpenFilePicker) {
      alert("Tu navegador no soporta carga directa de archivos. Usa Chrome o Edge.");
      return;
    }
    const [fileHandle] = await window.showOpenFilePicker({
      types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
    });
    const file = await fileHandle.getFile();
    const text = await file.text();
    registros = JSON.parse(text).map(r => ({
      ...r,
      montoNum: r.montoNum !== undefined ? r.montoNum : parseNumber(r.monto)
    }));
    applyFilters();
    alert("Base cargada correctamente.");
  } catch (e) {
    console.error(e);
  }
}

// Modo oscuro con persistencia
function initThemeToggle() {
  const toggle = document.getElementById("toggleDark");
  const saved = window.localStorage.getItem("neumoTheme");
  if (saved === "dark") {
    document.body.classList.add("dark");
  }
  toggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    window.localStorage.setItem("neumoTheme", document.body.classList.contains("dark") ? "dark" : "light");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  applyFilters();
});
