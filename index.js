const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "verificacion123";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

/* =========================
   BASE DE DATOS INTERNA
=========================*/

const catalogo = {
  "1": { // SHEER
    nombre: "SHEER",
    modelos: [
      { nombre: "FRESH TRAS 2.7", precio: 700, max: 2.7 },
      { nombre: "TURQUESA TRAS 2.7", precio: 784, max: 2.7 },
      { nombre: "NATURE S TRAS 2.7", precio: 924, max: 2.7 },
      { nombre: "TEXTURY S TRAS 2.7", precio: 1078, max: 2.7 },
      { nombre: "RUBI TRAS 2.7", precio: 1078, max: 2.7 },
      { nombre: "SHEER SCREEN TRAS 2.7", precio: 1722, max: 2.7 },
      { nombre: "BAHUNIA TRAS 2.7", precio: 1722, max: 2.7 },
      { nombre: "NATURE B/O 2.7", precio: 1120, max: 2.7 },
      { nombre: "TOLEDO B/O 2.7", precio: 1176, max: 2.7 },
      { nombre: "URBAN D/M 2.7", precio: 1176, max: 2.7 }
    ]
  },

  "2": { // ENROLLABLE
    nombre: "ENROLLABLE",
    modelos: [
      { nombre: "LINEN TRAS 2.1", precio: 490, max: 2.1 },
      { nombre: "VALLEY TRAS 2.4", precio: 490, max: 2.4 },
      { nombre: "TANIA TRAS 2.1", precio: 490, max: 2.1 },
      { nombre: "SCREEN 250 TRAS 2.5", precio: 490, max: 2.5 },
      { nombre: "SCREEN 450 TRAS 2.5", precio: 490, max: 2.5 },
      { nombre: "FERRARA TRAS 2.4", precio: 560, max: 2.4 },
      { nombre: "ASPEN TRAS 3", precio: 560, max: 3 },
      { nombre: "MONTREAL TRAS 2.5", precio: 560, max: 2.5 },
      { nombre: "LINEN B/O 2.8", precio: 630, max: 2.8 },
      { nombre: "BRAHAMS B/O 2.5", precio: 630, max: 2.5 },
      { nombre: "TANIA B/O 2.2", precio: 630, max: 2.2 },
      { nombre: "BRAMPTON B/O 3", precio: 910, max: 3 },
      { nombre: "DINASY B/O 3", precio: 910, max: 3 },
      { nombre: "ASPEN B/O 3", precio: 910, max: 3 },
      { nombre: "FERRARA B/O 2.5", precio: 910, max: 2.5 },
      { nombre: "VICTORIA B/O 3", precio: 910, max: 3 },
      { nombre: "MONTREAL B/O 2.5", precio: 910, max: 2.5 }
    ]
  },

  "3": { // PANEL JAPONES
    nombre: "PANEL JAPONES",
    modelos: [
      { nombre: "LINEN TRAS 2.1", precio: 1400, max: 2.1 },
      { nombre: "TANIA TRAS 2.1", precio: 1400, max: 2.1 },
      { nombre: "SCREEN 250 TRAS 2.5", precio: 1400, max: 2.5 },
      { nombre: "SCREEN 450 TRAS 2.5", precio: 1400, max: 2.5 },
      { nombre: "FERRARA TRAS 2.4", precio: 1610, max: 2.4 },
      { nombre: "ASPEN TRAS 3", precio: 1610, max: 3 },
      { nombre: "MONTREAL TRAS 2.5", precio: 1610, max: 2.5 },
      { nombre: "LINEN B/O 2.8", precio: 1610, max: 2.8 },
      { nombre: "BRAHAMS B/O 2.5", precio: 1610, max: 2.5 },
      { nombre: "TANIA B/O 2.2", precio: 1610, max: 2.2 },
      { nombre: "BRAMPTON B/O 3", precio: 1820, max: 3 },
      { nombre: "DINASY B/O 3", precio: 1820, max: 3 },
      { nombre: "ASPEN B/O 3", precio: 1820, max: 3 },
      { nombre: "FERRARA B/O 2.5", precio: 1820, max: 2.5 },
      { nombre: "VICTORIA B/O 3", precio: 1820, max: 3 },
      { nombre: "MONTREAL B/O 2.5", precio: 1820, max: 2.5 }
    ]
  }
};

/* =========================
   CONTROL DE ESTADO
=========================*/

const estadoUsuario = {};

function menuPrincipal() {
  return `MENÚ PRINCIPAL

1 - Sheer
2 - Enrollable
3 - Panel Japonés

0 - Volver al menú`;
}

/* =========================
   WEBHOOK
=========================*/

app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    return res.status(200).send(req.query["hub.challenge"]);
  }
  return res.sendStatus(403);
});

app.post("/webhook", (req, res) => {
  res.status(200).send("EVENT_RECEIVED");

  const body = req.body;
  if (body.object !== "page") return;

  body.entry.forEach(entry => {
    entry.messaging.forEach(event => {
      if (!event.message || !event.message.text) return;

      manejarMensaje(event.sender.id, event.message.text.trim());
    });
  });
});

/* =========================
   LOGICA PRINCIPAL
=========================*/

async function manejarMensaje(user, texto) {

  if (!estadoUsuario[user]) {
    estadoUsuario[user] = { paso: "menu" };
  }

  const estado = estadoUsuario[user];

  if (texto === "0") {
    estadoUsuario[user] = { paso: "menu" };
    return enviar(user, menuPrincipal());
  }

  // PASO MENU PRINCIPAL
  if (estado.paso === "menu") {

    if (!catalogo[texto]) {
      return enviar(user, menuPrincipal());
    }

    const categoria = catalogo[texto];
    estadoUsuario[user] = { paso: "modelo", categoria: texto };

    let respuesta = `${categoria.nombre}\n\n`;
    categoria.modelos.forEach((m, i) => {
      respuesta += `${i + 1} - ${m.nombre} ($${m.precio} m²)\n`;
    });

    respuesta += `\n0 - Volver`;
    return enviar(user, respuesta);
  }

  // SELECCION MODELO
  if (estado.paso === "modelo") {

    const categoria = catalogo[estado.categoria];
    const index = parseInt(texto) - 1;

    if (!categoria.modelos[index]) {
      return enviar(user, "Modelo inválido");
    }

    estadoUsuario[user] = {
      paso: "ancho",
      modelo: categoria.modelos[index]
    };

    return enviar(user, `Ingresa el ANCHO en metros (máximo ${categoria.modelos[index].max})`);
  }

  // INGRESA ANCHO
  if (estado.paso === "ancho") {

    const ancho = parseFloat(texto);

    if (isNaN(ancho) || ancho > estado.modelo.max) {
      return enviar(user, `Ancho inválido. Máximo permitido ${estado.modelo.max}`);
    }

    estadoUsuario[user] = {
      paso: "alto",
      modelo: estado.modelo,
      ancho: ancho
    };

    return enviar(user, "Ingresa el ALTO en metros");
  }

  // INGRESA ALTO
  if (estado.paso === "alto") {

    const alto = parseFloat(texto);

    if (isNaN(alto)) {
      return enviar(user, "Alto inválido");
    }

    let area = estado.ancho * alto;
    if (area < 1) area = 1;

    const total = Math.round(area * estado.modelo.precio);

    estadoUsuario[user] = { paso: "menu" };

    return enviar(user,
`COTIZACIÓN

Modelo: ${estado.modelo.nombre}
Ancho: ${estado.ancho} m
Alto: ${alto} m
Área cobrada: ${area} m²
Precio m²: $${estado.modelo.precio}
TOTAL: $${total} MXN

Escribe cualquier número para nueva cotización`
    );
  }
}

/* =========================
   ENVIO MENSAJE
=========================*/

async function enviar(user, texto) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: user },
        message: { text: texto }
      }
    );
  } catch (error) {
    console.log("Error:", error.response?.data || error.message);
  }
}

app.listen(process.env.PORT || 3000);
