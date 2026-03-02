const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "verificacion123";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

let sesiones = {};

/* =========================
   PARSER CSV ROBUSTO (SIN LIBRERÍAS)
========================= */
function parseCSVLine(line) {
  const regex = /(".*?"|[^",]+)(?=\s*,|\s*$)/g;
  const matches = line.match(regex);
  return matches ? matches.map(m => m.replace(/^"|"$/g, "").trim()) : [];
}

/* =========================
   LEER GOOGLE SHEETS
========================= */
async function obtenerPrecios() {
  try {
    const url = "https://docs.google.com/spreadsheets/d/1PiA-jCNr4hUQJE1jO_FZ-xh0gg_sPSw2-qHCf9_a-h8/export?format=csv";
    const response = await axios.get(url);

    const lineas = response.data.split("\n");
    const resultados = [];

    const encabezados = parseCSVLine(lineas[0]);

    for (let i = 1; i < lineas.length; i++) {
      const columnas = parseCSVLine(lineas[i]);
      if (columnas.length === encabezados.length) {
        let fila = {};
        encabezados.forEach((enc, index) => {
          fila[enc.trim()] = columnas[index];
        });

        resultados.push({
          codigo: fila["CODIGO"]?.trim(),
          tipo: fila["TIPO"]?.trim(),
          modelo: fila["MODELO"]?.trim(),
          colores: fila["COLORES"]?.trim(),
          precio_m2: parseFloat(fila["PRECIO_M2"])
        });
      }
    }

    return resultados;

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

          if (mensaje === "0") {
            sesiones[senderId] = { paso: "menu" };
            await sendMessage(senderId, menuPrincipal());
            continue;
          }

          if (sesiones[senderId].paso === "menu") {

            if (["1", "2", "3"].includes(mensaje)) {

              const datos = await obtenerPrecios();
              const filtrados = datos.filter(d => d.codigo === mensaje);

              if (filtrados.length === 0) {
                await sendMessage(senderId, "No hay modelos disponibles para esta categoría.");
                continue;
              }

              sesiones[senderId] = {
                paso: "modelo",
                modelos: filtrados
              };

              let respuesta = "Modelos disponibles:\n\n";
              filtrados.forEach((m, index) => {
                respuesta += `${index + 1}️⃣ ${m.modelo}\n`;
              });

              respuesta += "\n0️⃣ Volver al menú";

              await sendMessage(senderId, respuesta);
            }

            else {
              await sendMessage(senderId, menuPrincipal());
            }
          }

          else if (sesiones[senderId].paso === "modelo") {

            const index = parseInt(mensaje) - 1;
            const modelos = sesiones[senderId].modelos;

            if (!isNaN(index) && modelos[index]) {

              const seleccionado = modelos[index];

              await sendMessage(
                senderId,
                `Modelo: ${seleccionado.modelo}

Colores disponibles:
${seleccionado.colores}

Precio: $${seleccionado.precio_m2} por m2

0️⃣ Volver al menú`
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
