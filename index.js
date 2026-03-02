const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "verificacion123";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

const CSV_FILE = path.join(__dirname, "BASE_PRECIOS_PERSIANAS_2026.csv");

// ====== MEMORIA SIMPLE DE USUARIOS ======
const userState = {};

// ====== LEER CSV ======
function getData() {
  try {
    if (!fs.existsSync(CSV_FILE)) {
      console.log("Archivo no encontrado");
      return [];
    }

    let file = fs.readFileSync(CSV_FILE, "utf8").replace(/^\uFEFF/, "");
    const lines = file.split(/\r?\n/).filter(l => l.trim() !== "");

    const separator = lines[0].includes(";") ? ";" : ",";
    const rows = lines.slice(1);

    return rows.map(r => {
      const c = r.split(separator);
      return {
        categoria: c[0]?.trim(),
        modelo: c[1]?.trim(),
        colores: c[2]?.trim(),
        precio: c[3]?.trim()
      };
    }).filter(x => x.categoria && x.modelo);

  } catch (e) {
    console.log("Error leyendo CSV:", e.message);
    return [];
  }
}

// ====== MENU ======
function mainMenu() {
  return `MENÚ PRINCIPAL

1 - Sheer
2 - Panel Japonés
3 - Enrollable

0 - Volver al menú`;
}

// ====== WEBHOOK GET ======
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ====== WEBHOOK POST ======
app.post("/webhook", (req, res) => {

  // RESPONDER INMEDIATO (evita loop de facebook)
  res.status(200).send("EVENT_RECEIVED");

  const body = req.body;

  if (body.object !== "page") return;

  body.entry.forEach(entry => {
    entry.messaging.forEach(event => {

      if (!event.message || !event.message.text) return;

      const senderId = event.sender.id;
      const text = event.message.text.trim();

      handleMessage(senderId, text);

    });
  });
});

// ====== LOGICA PRINCIPAL ======
async function handleMessage(senderId, text) {

  if (!userState[senderId]) {
    userState[senderId] = { step: "menu" };
  }

  const data = getData();

  if (text === "0") {
    userState[senderId] = { step: "menu" };
    return sendMessage(senderId, mainMenu());
  }

  if (userState[senderId].step === "menu") {

    if (!["1","2","3"].includes(text)) {
      return sendMessage(senderId, mainMenu());
    }

    const modelos = data.filter(d => d.categoria === text);

    if (modelos.length === 0) {
      return sendMessage(senderId, "No hay modelos disponibles.");
    }

    userState[senderId] = {
      step: "modelos",
      categoria: text,
      modelos: modelos
    };

    let respuesta = "MODELOS:\n";
    modelos.forEach((m, i) => {
      respuesta += `${i+1} - ${m.modelo}\n`;
    });

    return sendMessage(senderId, respuesta);
  }

  if (userState[senderId].step === "modelos") {

    const index = parseInt(text) - 1;
    const modelos = userState[senderId].modelos;

    if (isNaN(index) || !modelos[index]) {
      return sendMessage(senderId, "Modelo inválido.");
    }

    const modelo = modelos[index];

    userState[senderId] = { step: "menu" };

    return sendMessage(
      senderId,
      `Modelo: ${modelo.modelo}
Colores: ${modelo.colores}
Precio: ${modelo.precio}`
    );
  }
}

// ====== ENVIAR MENSAJE ======
async function sendMessage(senderId, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: senderId },
        message: { text: text }
      }
    );
  } catch (error) {
    console.log("Error enviando mensaje:", error.response?.data || error.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor estable en puerto", PORT);
});
