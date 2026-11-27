// ======= CONFIGURACIÓN =======
// El token NO va aquí: vive en el servidor (api/blynk.js).
const BASE  = "/api/blynk";
const CADA_MS = 5000;

const $ = id => document.getElementById(id);
const pinesLectura = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].map(n => "v" + n);
const tocado = {};           // último momento en que el usuario movió cada control
let historial = [];          // [{t, h}] horas de uso

try { historial = JSON.parse(localStorage.getItem("po_hist") || "[]"); } catch(e) {}

const hm = min => {
  min = Math.round(Number(min) || 0);
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}<sup>h</sup>${m}<sup>min</sup>` : `${m}<sup>min</sup>`;
};
const num = (v, d = 0) => (v === undefined || v === null || v === "") ? "--" : Number(v).toFixed(d);

function mostrarError(t){ $("msg").textContent = t; }

async function leer() {
  try {
    const r = await fetch(`${BASE}?accion=get`);
    if (!r.ok) throw new Error(r.status === 400 ? "Token inválido" : "Error " + r.status);
    pintar(await r.json());
    mostrarError("");
    const c = await (await fetch(`${BASE}?accion=conectado`)).text();
    $("dot").className = "dot " + (c === "true" ? "on" : "off");
    $("connTxt").textContent = c === "true" ? "Dispositivo en línea" : "Dispositivo sin conexión";
  } catch (e) {
    $("dot").className = "dot off";
    $("connTxt").textContent = "Sin datos";
    mostrarError("No se pudieron leer los datos: " + e.message + ". Revisa la conexión.");
  }
}

function pintar(d) {
  $("estado").textContent = d.v12 || "--";
  $("estadoBox").className = "estado " + (d.v12 || "");
  $("v11").textContent = num(d.v11, 1);
  $("v1").textContent  = num(d.v1, 1);
  $("v2").textContent  = num(d.v2);

  const cal = Math.max(0, Math.min(100, Number(d.v4) || 0));
  $("v4").textContent = num(d.v4);
  $("arc").setAttribute("stroke-dasharray", `${cal} 100`);
  $("arc").setAttribute("stroke-opacity", cal > 0 ? 1 : 0);   // con 0 % no se dibuja
  $("arc").setAttribute("stroke", cal >= 70 ? "var(--teal)" : cal >= 40 ? "var(--amber)" : "var(--red)");

  $("v5").innerHTML  = hm(d.v5);
  $("v6").innerHTML  = `${num(d.v6, 1)}<sup>h</sup>`;
  $("v13").innerHTML = hm(d.v13);
  $("v14").textContent = num(d.v14);
  $("v15").innerHTML = hm(d.v15);
  $("v16").textContent = num(d.v16);

  // controles: no pisar lo que el usuario está moviendo
  for (const n of [7, 8, 10]) setCtl(n, d["v" + n]);
  if (Date.now() - (tocado[9] || 0) > 4000 && d.v9 !== undefined) {
    $("v9").checked = String(d.v9) === "1"; actualizarManual();
  }

  if (d.v6 !== undefined && d.v6 !== "") {
    historial.push({ t: Date.now(), h: Number(d.v6) });
    historial = historial.slice(-300);
    try { localStorage.setItem("po_hist", JSON.stringify(historial)); } catch(e) {}
    dibujar();
  }
}

function setCtl(n, v) {
  if (v === undefined || v === "") return;
  if (Date.now() - (tocado[n] || 0) < 4000) return;
  $("v" + n).value = v; $("o" + n).textContent = n === 10 ? v + " %" : v + " lx";
}

function dibujar() {
  if (historial.length < 2) return;
  const w = 600, h = 150, p = 8;
  const hs = historial.map(x => x.h), ts = historial.map(x => x.t);
  const minH = Math.min(...hs), maxH = Math.max(...hs, minH + 0.1);
  const t0 = ts[0], t1 = ts[ts.length - 1] || t0 + 1;
  const pts = historial.map(x =>
    `${p + (x.t - t0) / (t1 - t0 || 1) * (w - 2 * p)},${h - p - (x.h - minH) / (maxH - minH) * (h - 2 * p)}`).join(" ");
  $("chart").innerHTML = `<polyline points="${pts}" fill="none" stroke="var(--amber)" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
  const f = t => new Date(t).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  $("chartInfo").textContent = `Desde ${f(t0)} hasta ${f(t1)} · de ${minH.toFixed(1)} h a ${maxH.toFixed(1)} h`;
}

async function escribir(n, v) {
  try {
    const r = await fetch(`${BASE}?accion=update&pin=v${n}&valor=${encodeURIComponent(v)}`);
    if (!r.ok) throw new Error("Error " + r.status);
    mostrarError("");
  } catch (e) { mostrarError("No se pudo guardar el cambio: " + e.message); }
}

function actualizarManual() {
  const auto = $("v9").checked;
  $("v10").disabled = auto;      // el brillo manual solo aplica con el modo automático apagado
}

for (const n of [7, 8, 10]) {
  const el = $("v" + n);
  el.addEventListener("input", () => {
    tocado[n] = Date.now();
    $("o" + n).textContent = el.value + (n === 10 ? " %" : " lx");
  });
  el.addEventListener("change", () => { tocado[n] = Date.now(); escribir(n, el.value); });
}
$("v9").addEventListener("change", e => {
  tocado[9] = Date.now(); actualizarManual(); escribir(9, e.target.checked ? 1 : 0);
});

dibujar(); leer(); setInterval(leer, CADA_MS);
