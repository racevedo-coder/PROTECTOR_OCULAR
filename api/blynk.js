// Intermediario entre la página y Blynk: aquí vive el token (no en la página).
const BASE = "https://blynk.cloud/external/api";
const TOKEN = process.env.BLYNK_TOKEN;
const ESCRITURA = ["v7", "v8", "v9", "v10"];   // pines que la página puede cambiar

module.exports = async (req, res) => {
  const { accion, pin, valor } = req.query;
  let url;

  if (!TOKEN) return res.status(500).send("Falta la variable BLYNK_TOKEN");

  if (accion === "get") {
    const pines = Array.from({ length: 17 }, (_, n) => "v" + n).join("&");
    url = `${BASE}/get?token=${TOKEN}&${pines}`;
  } else if (accion === "conectado") {
    url = `${BASE}/isHardwareConnected?token=${TOKEN}`;
  } else if (accion === "update") {
    if (!ESCRITURA.includes(pin)) return res.status(400).send("Pin no permitido");
    url = `${BASE}/update?token=${TOKEN}&${pin}=${encodeURIComponent(valor)}`;
  } else {
    return res.status(400).send("Acción no válida");
  }

  try {
    const r = await fetch(url);
    res.status(r.status).send(await r.text());
  } catch (e) {
    res.status(502).send("No se pudo contactar a Blynk");
  }
};
