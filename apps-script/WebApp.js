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
    const claves = leerClavesHistorial_(historialSheet);
    candidatos = config.canchas.filter((cancha) => !hayDuplicado_(claves, cancha, fecha, bloque.fin));
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
      throw new Error('"' + nombre + '" no está anotado en la lista de jugadores. Pídele que se registre primero.');
    }
  });

  // Lock: sin esto, dos envíos casi simultáneos para el mismo partido
  // pueden leer ambos "no hay duplicado" antes de que cualquiera de los
  // dos escriba, y el delta de Elo se aplicaría dos veces.
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const claves = leerClavesHistorial_(historialSheet);
    if (hayDuplicado_(claves, payload.cancha, payload.fecha, payload.hora)) {
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
  } finally {
    lock.releaseLock();
  }
}

// Estas reglas duplican a mano las de validar() en
// web/src/pages/ResultadoPage.jsx (no hay forma de compartir código
// entre un proyecto de Vite y uno de Apps Script sin un build extra) --
// esta es la que manda (la del cliente es solo para evitar una vuelta
// de red), si se cambia una regla acá hay que replicarla ahí también.
function validarPayload_(p, config) {
  if (!p.quienEres) throw new Error('Falta indicar quién completa el formulario.');
  if (!p.cancha) throw new Error('Falta elegir la cancha.');
  if (!p.fecha || !p.hora) throw new Error('Falta la fecha o la hora del partido.');
  if (p.fecha > hoyISO_()) throw new Error('La fecha del partido no puede ser futura.');
  if (!Array.isArray(p.equipoA) || p.equipoA.length !== 2) throw new Error('Elige exactamente 2 jugadores para el equipo A.');
  if (!Array.isArray(p.equipoB) || p.equipoB.length !== 2) throw new Error('Elige exactamente 2 jugadores para el equipo B.');
  const todos = [...p.equipoA, ...p.equipoB];
  if (new Set(todos).size !== 4) throw new Error('Los 4 jugadores del partido deben ser distintos.');
  if (!p.cargaAdministracion && !todos.includes(p.quienEres)) {
    throw new Error('Quien completa el formulario debe ser uno de los 4 jugadores del partido. Si no jugaste, usa la opción de administración.');
  }
  if (p.ganador !== 'A' && p.ganador !== 'B') throw new Error('Falta indicar qué equipo ganó.');
  if (!p.resultado || !/^\d-\d(, \d-\d){1,2}$/.test(p.resultado.trim())) {
    throw new Error('El resultado debe tener el formato "6-4, 6-3" (2 o 3 sets, un dígito por lado).');
  }
  if (p.cargaAdministracion) {
    if (!p.motivo) throw new Error('Las cargas por administración necesitan un motivo.');
    verificarPin_(p.pin, config);
  }
}

/**
 * Limita los intentos de PIN para que no se pueda probar por fuerza
 * bruta pegándole directo a la API (son solo 10.000 combinaciones de 4
 * dígitos). Bloquea 15 minutos después de 5 intentos fallidos. Apps
 * Script no expone la IP de quien llama, así que no se puede limitar
 * por origen -- esto es lo más granular que se puede hacer acá.
 */
function verificarPin_(pin, config) {
  const cache = CacheService.getScriptCache();
  const intentosFallidos = Number(cache.get('pinAdminFallos') || 0);
  if (intentosFallidos >= 5) {
    throw new Error('Demasiados intentos con PIN incorrecto. Probá de nuevo en 15 minutos.');
  }
  if (String(pin || '').trim() !== String(config.pinAdmin).trim()) {
    cache.put('pinAdminFallos', String(intentosFallidos + 1), 900); // 15 min
    throw new Error('PIN de administración incorrecto.');
  }
  cache.remove('pinAdminFallos');
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

/**
 * Lee Fecha+Cancha+Hora de todo Historial UNA sola vez y arma un Set de
 * claves "fecha|cancha|hora". getContext() necesita chequear varias
 * canchas contra el mismo Historial (una por cada cancha candidata);
 * sin esto, cada chequeo releía la hoja entera desde cero.
 */
function leerClavesHistorial_(historialSheet) {
  const lastRow = historialSheet.getLastRow();
  const claves = new Set();
  if (lastRow < 2) return claves;
  const values = historialSheet.getRange(2, 2, lastRow - 1, 3).getValues(); // Fecha, Cancha, Hora
  values.forEach(([fechaFila, canchaFila, horaFila]) => {
    const fechaFilaStr =
      fechaFila instanceof Date ? Utilities.formatDate(fechaFila, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(fechaFila);
    claves.add(fechaFilaStr + '|' + canchaFila + '|' + horaFila);
  });
  return claves;
}

function hayDuplicado_(claves, cancha, fecha, hora) {
  return claves.has(fecha + '|' + cancha + '|' + hora);
}
