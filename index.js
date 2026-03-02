const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "verificacion123";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

/* =========================
   ESTADO SIMPLE EN MEMORIA
========================= */
let sesiones = {};

/* =========================
   LEER GOOGLE SHEETS
========================= */
async function obtenerPrecios() {
  try {
    const url = "https://docs.google.com/spreadsheets/d/1PiA-jCNr4hUQJE1jO_FZ-xh0gg_sPSw2-qHCf9_a-h8/export?format=csv";
    const response = await axios.get(url);
    const filas = response.data.split("\n");

    const datos = [];

    for (let i = 1; i < filas.length; i++) {
      const columnas = filas[i].split(",");
      if (columnas.length >= 4) {
        datos.push({
          tipo: columnas[0]?.trim(),
          modelo: columnas[1]?.trim(),
          colores: columnas[2]?.trim(),
          precio_m2: parseFloat(columnas[3])
        });
      }
    }

    return datos;
  } catch (error) {
    console.error("Error leyendo hoja:", error);
    return [];
  }
}

/* =========================
   MENÚ PRINCIPAL
========================= */
function menuPrincipal() {
  return `
Bienvenido al Cotizador de Persianas

1️⃣ Sheer
2️⃣ Panel Japonés
3️⃣ Enrollable

0️⃣ Volver a este menú
`;
}

/* =========================
   WEBHOOK VERIFICACIÓN
========================= */
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

/* =========================
   WEBHOOK MENSAJES
========================= */
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    for (const entry of body.entry) {
      for (const event of entry.messaging) {
        if (event.message) {

          const senderId = event.sender.id;
          const mensaje = event.message.text?.trim();

          if (!sesiones[senderId]) {
            sesiones[senderId] = { paso: "menu" };
          }

          // VOLVER A MENÚ
          if (mensaje === "0") {
            sesiones[senderId] = { paso: "menu" };
            await sendMessage(senderId, menuPrincipal());
            continue;
          }

          // MENÚ PRINCIPAL
          if (sesiones[senderId].paso === "menu") {

            if (mensaje === "1") {
              const datos = await obtenerPrecios();
              const sheer = datos.filter(d => d.tipo.toUpperCase() === "SHEER");

              if (sheer.length === 0) {
                await sendMessage(senderId, "No hay modelos SHEER disponibles.");
                continue;
              }

              sesiones[senderId] = {
                paso: "sheer_modelo",
                modelos: sheer
              };

              let respuesta = "Modelos SHEER disponibles:\n\n";
              sheer.forEach((m, index) => {
                respuesta += `${index + 1}️⃣ ${m.modelo}\n`;
              });
              respuesta += "\n0️⃣ Volver al menú";

              await sendMessage(senderId, respuesta);
            }

            else if (mensaje === "2") {
              await sendMessage(senderId, "Panel Japonés próximamente disponible.\n\n0️⃣ Volver al menú");
            }

            else if (mensaje === "3") {
              await sendMessage(senderId, "Enrollables próximamente disponible.\n\n0️⃣ Volver al menú");
            }

            else {
              await sendMessage(senderId, menuPrincipal());
            }
          }

          // SELECCIÓN MODELO SHEER
          else if (sesiones[senderId].paso === "sheer_modelo") {

            const index = parseInt(mensaje) - 1;
            const modelos = sesiones[senderId].modelos;

            if (!isNaN(index) && modelos[index]) {

              const modeloSeleccionado = modelos[index];

              sesiones[senderId] = {
                paso: "sheer_color",
                modelo: modeloSeleccionado
              };

              await sendMessage(
                senderId,
                `Modelo: ${modeloSeleccionado.modelo}\n\nColores disponibles:\n${modeloSeleccionado.colores}\n\n0️⃣ Volver al menú`
              );

            } else {
              await sendMessage(senderId, "Selecciona un número válido.\n0️⃣ Volver al menú");
            }
          }
        }
      }
    }
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

/* =========================
   ENVIAR MENSAJE
========================= */
async function sendMessage(senderId, text) {
  await axios.post(
    `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    {
      recipient: { id: senderId },
      message: { text: text }
    }
  );
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
