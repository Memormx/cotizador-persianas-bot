const express = require("express");
const axios = require("axios");
const fs = require("fs");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "verificacion123";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

const CSV_FILE = "./BASE_PRECIOS_PERSIANAS_2026.csv";

// ====== LEER ARCHIVO LOCAL ======
function getSheetData() {
  try {
    const file = fs.readFileSync(CSV_FILE, "utf8");
    const rows = file.split("\n").slice(1); // ignora encabezado

    return rows
      .map(row => row.split(","))
      .filter(row => row.length >= 4)
      .map(row => ({
        categoria: row[0]?.trim(),
        modelo: row[1]?.trim(),
        colores: row[2]?.trim(),
        precio: row[3]?.trim()
      }));
  } catch (error) {
    console.log("Error leyendo archivo:", error.message);
    return [];
  }
}

// ====== MENU PRINCIPAL ======
function mainMenu() {
  return `
📌 MENÚ PRINCIPAL

1️⃣ Sheer
2️⃣ Panel Japonés
3️⃣ Enrollable

0️⃣ Volver al menú

Escribe el número:
`;
}

// ====== WEBHOOK GET ======
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ====== WEBHOOK POST ======
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    for (const entry of body.entry) {
      for (const event of entry.messaging) {
        if (event.message && event.message.text) {

          const senderId = event.sender.id;
          const text = event.message.text.trim();

          if (text === "0") {
            await sendMessage(senderId, mainMenu());
            return;
          }

          if (["1","2","3"].includes(text)) {

            const data = getSheetData();
            const modelos = data.filter(item => item.categoria === text);

            if (modelos.length === 0) {
              await sendMessage(senderId, "❌ No hay modelos disponibles en esta categoría.");
              return;
            }

            let respuesta = "📌 MODELOS DISPONIBLES:\n\n";

            modelos.forEach((item, index) => {
              respuesta += `${index + 1}. ${item.modelo}\n`;
            });

            respuesta += "\nEscribe el número del modelo para ver colores.";
            await sendMessage(senderId, respuesta);
            return;
          }

          await sendMessage(senderId, mainMenu());
        }
      }
    }
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

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
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
