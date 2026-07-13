/**
 * WebApp.js
 * Backend de la web app de resultado. El frontend (la página que ve el
 * jugador) vive aparte, en la carpeta web/ (React), hospedado donde se
 * decida desplegarlo -- este archivo ya no sirve HTML, solo responde
 * JSON: doGet() para pedir el contexto (jugadores,
 * canchas, detección de bloque horario) y doPost() para guardar un
 * resultado. Se comunican por fetch() desde afuera, no por
 * google.script.run.
 *
 * Truco de CORS: el frontend manda el POST sin header de Content-Type
 * (el navegador pone "text/plain" por defecto), así el pedido cuenta
 * como "simple request" y el navegador no exige un preflight que Apps
 * Script no sabe responder. Por eso acá se parsea e.postData.contents
 * a mano en vez de esperar JSON declarado.
 *
 * getContext() detecta si hay un bloque de horario recién terminado
 * (mismo horario para todas las canchas) y decide si se salta directo
 * a cargar jugadores, si hay que elegir entre varias canchas, o si cae
 * al selector manual de respaldo. Ver getBloqueRecienTerminado_ en
 * Config.js.
 *
 * doGet() también sirve la página de ranking (?vista=ranking, ver
 * getRanking() en Ranking.js) -- mismo backend, misma implementación
 * de Apps Script, un solo query param decide qué devolver.
 */

function doGet(e) {
  const vista = e && e.parameter && e.parameter.vista;
  if (vista === 'ranking') return jsonOutput_(safeRun_(getRanking));
  return jsonOutput_(safeRun_(getContext));
}

function doPost(e) {
  return jsonOutput_(
    safeRun_(function () {
      const payload = JSON.parse(e.postData.contents);
      return submitResultado(payload);
    })
  );
}

function safeRun_(fn) {
  try {
    return { ok: true, data: fn() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function hoyISO_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function listarJugadores_() {
  const sheet = getSpreadsheet_().getSheetByName(SHEET_JUGADORES);
  const lastRow = sheet.getLastRow();
  return lastRow >= 2
    ? sheet
        .getRange(2, 1, lastRow - 1, 1)
        .getValues()
        .map((r) => r[0])
        .filter((n) => n)
    : [];
}

/**
 * Llamado desde el cliente al cargar la página. Resuelve todo lo que
 * hace falta para decidir qué pantalla mostrar primero:
 * - "auto": un solo partido recién terminado sin resultado cargado ->
 *   cancha y hora ya vienen resueltas, se salta directo a jugadores.
 * - "elegir": terminaron varios partidos a la vez en distintas canchas
 *   -> se muestran esas pocas opciones para elegir.
 * - "manual": no se detectó ningún bloque recién terminado (o ya están
 *   todos cargados) -> selector de cancha/hora a mano, como respaldo.
 */
function getContext() {
  const fecha = hoyISO_();
  const config = getConfig_();
  const bloque = getBloqueRecienTerminado_(config);

  let candidatos = [];
  if (bloque) {
    const historialSheet = getSpreadsheet_().getSheetByName(SHEET_HISTORIAL);
    candidatos = config.canchas.filter((cancha) => !hayDuplicado_(historialSheet, cancha, fecha, bloque.fin));
  }

  let modo = 'manual';
  if (bloque && candidatos.length === 1) modo = 'auto';
  else if (bloque && candidatos.length > 1) modo = 'elegir';

  return {
    jugadores: listarJugadores_(),
    canchas: config.canchas,
    fecha: fecha,
    bloquesDelDia: getBloques_(config),
    modo: modo,
    bloque: bloque,
    candidatos: candidatos,
  };
}

/**
 * Valida y guarda un resultado de partido. Se llama desde el cliente
 * SOLO después de la pantalla de confirmación (el usuario ya revisó el
 * resumen y tocó "Confirmar y enviar").
 */
function submitResultado(payload) {
  const config = getConfig_();
  validarPayload_(payload, config);

  const ss = getSpreadsheet_();
  const jugadoresSheet = ss.getSheetByName(SHEET_JUGADORES);
  const historialSheet = ss.getSheetByName(SHEET_HISTORIAL);

  const mapaJugadores = leerJugadores_(jugadoresSheet);

  const [a1, a2] = payload.equipoA;
  const [b1, b2] = payload.equipoB;
  [payload.quienEres, a1, a2, b1, b2].forEach((nombre) => {
    if (!mapaJugadores[nombre]) {
      throw new Error('"' + nombre + '" no está en Jugadores. Pídele que se registre primero.');
    }
  });

  if (hayDuplicado_(historialSheet, payload.cancha, payload.fecha, payload.hora)) {
    throw new Error(
      'Ya existe un resultado cargado para ' + payload.cancha + ' el ' + payload.fecha + ' a las ' + payload.hora + '.'
    );
  }

  const promedioA = (mapaJugadores[a1].puntaje + mapaJugadores[a2].puntaje) / 2;
  const promedioB = (mapaJugadores[b1].puntaje + mapaJugadores[b2].puntaje) / 2;
  const ganoA = payload.ganador === 'A';
  const deltaA = calcularDeltaA_(promedioA, promedioB, ganoA, config.K, config.D);
  const deltaB = -deltaA;

  historialSheet.appendRow([
    new Date(),
    payload.fecha,
    payload.cancha,
    payload.hora,
    a1,
    a2,
    b1,
    b2,
    payload.ganador,
    payload.resultado,
    deltaA,
    deltaB,
    payload.quienEres,
    payload.cargaAdministracion ? 'Administración' : 'Jugador',
    payload.cargaAdministracion ? payload.motivo || '' : '',
  ]);

  return {
    deltaA: Math.round(deltaA * 10) / 10,
    deltaB: Math.round(deltaB * 10) / 10,
    equipoA: [a1, a2],
    equipoB: [b1, b2],
  };
}

function validarPayload_(p, config) {
  if (!p.quienEres) throw new Error('Falta indicar quién completa el formulario.');
  if (!p.cancha) throw new Error('Falta elegir la cancha.');
  if (!p.fecha || !p.hora) throw new Error('Falta la fecha o la hora del partido.');
  if (p.fecha > hoyISO_()) throw new Error('La fecha del partido no puede ser futura.');
  if (!Array.isArray(p.equipoA) || p.equipoA.length !== 2) throw new Error('El equipo A debe tener exactamente 2 jugadores.');
  if (!Array.isArray(p.equipoB) || p.equipoB.length !== 2) throw new Error('El equipo B debe tener exactamente 2 jugadores.');
  const todos = [...p.equipoA, ...p.equipoB];
  if (new Set(todos).size !== 4) throw new Error('Los 4 jugadores del partido deben ser distintos.');
  if (!p.cargaAdministracion && !todos.includes(p.quienEres)) {
    throw new Error('Quien completa el formulario debe ser uno de los 4 jugadores del partido (o ser una carga por administración).');
  }
  if (p.ganador !== 'A' && p.ganador !== 'B') throw new Error('Falta indicar qué equipo ganó.');
  if (!p.resultado || !/^\d-\d(, \d-\d){1,2}$/.test(p.resultado.trim())) {
    throw new Error('El resultado debe tener el formato "6-4, 6-3" (2 o 3 sets, un dígito por lado).');
  }
  if (p.cargaAdministracion) {
    if (!p.motivo) throw new Error('Las cargas por administración necesitan un motivo.');
    if (String(p.pin || '').trim() !== String(config.pinAdmin).trim()) {
      throw new Error('PIN de administración incorrecto.');
    }
  }
}

function leerJugadores_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};
  const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  const mapa = {};
  values.forEach((row) => {
    const [nombre, , , puntaje] = row;
    if (nombre) mapa[nombre] = { puntaje: Number(puntaje) };
  });
  return mapa;
}

function hayDuplicado_(historialSheet, cancha, fecha, hora) {
  const lastRow = historialSheet.getLastRow();
  if (lastRow < 2) return false;
  const values = historialSheet.getRange(2, 2, lastRow - 1, 3).getValues(); // Fecha, Cancha, Hora
  return values.some(([fechaFila, canchaFila, horaFila]) => {
    const fechaFilaStr =
      fechaFila instanceof Date ? Utilities.formatDate(fechaFila, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(fechaFila);
    return fechaFilaStr === fecha && String(canchaFila) === cancha && String(horaFila) === hora;
  });
}
