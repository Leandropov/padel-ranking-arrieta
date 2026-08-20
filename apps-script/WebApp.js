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
 *
 * doPost() rutea por payload.tipo: 'registro' da de alta un jugador
 * (ver registrarJugador_ en Jugadores.js), 'valoracion' guarda cómo los
 * rivales repartieron los puntos de un partido ya cargado (ver
 * guardarValoracion_), y cualquier otra cosa se trata como la carga de
 * un resultado. El default es el resultado a
 * propósito: durante una ventana de despliegue puede quedar una versión
 * vieja del frontend mandando resultados sin declarar el tipo.
 *
 * Ojo con los jugadores: desde la migración a IDs, el frontend manda y
 * recibe IDs (J001...), nunca nombres. El nombre es solo para mostrar.
 */

function doGet(e) {
  const vista = e && e.parameter && e.parameter.vista;
  if (vista === 'ranking') return jsonOutput_(safeRun_(getRankingCacheado_));
  return jsonOutput_(safeRun_(getContext));
}

function doPost(e) {
  return jsonOutput_(
    safeRun_(function () {
      const payload = JSON.parse(e.postData.contents);
      if (payload && payload.tipo === 'registro') return registrarJugador_(payload);
      if (payload && payload.tipo === 'valoracion') return guardarValoracion_(payload);
      return submitResultado(payload);
    })
  );
}

/**
 * `codigo` viaja aparte del mensaje para que el frontend pueda
 * reaccionar distinto a un error puntual (hoy: NOMBRE_DUPLICADO, que
 * amerita una pantalla propia) sin tener que comparar el texto del
 * mensaje, que cambia.
 */
function safeRun_(fn) {
  try {
    return { ok: true, data: fn() };
  } catch (err) {
    const salida = { ok: false, error: err.message };
    if (err.codigo) salida.codigo = err.codigo;
    return salida;
  }
}

function errorConCodigo_(codigo, mensaje) {
  const err = new Error(mensaje);
  err.codigo = codigo;
  return err;
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function hoyISO_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * Los jugadores tal como los necesita el frontend: el `id` es lo que
 * viaja en el payload de un resultado, y la `etiqueta` es lo único que
 * se le muestra a la persona. Se omite el puntaje a propósito -- la
 * pantalla de carga de resultado no lo usa y no tiene por qué bajarlo.
 */
function listarJugadoresParaCliente_() {
  const sheet = getSpreadsheet_().getSheetByName(SHEET_JUGADORES);
  return agregarEtiquetas_(leerJugadores_(sheet)).map((j) => ({
    id: j.id,
    nombre: j.nombre,
    etiqueta: j.etiqueta,
    categoria: j.categoria,
  }));
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
    jugadores: listarJugadoresParaCliente_(),
    canchas: config.canchas,
    fecha: fecha,
    bloquesDelDia: getBloques_(config),
    modo: modo,
    bloque: bloque,
    candidatos: candidatos,
    // Para la pantalla de registro: las categorías que el jugador puede
    // declarar, y la lista de nombres ya tomados (va implícita en
    // `jugadores`) contra la que avisa en vivo si el nombre se repite.
    categorias: getCategoryRanges_().map((c) => c.nombre),
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

  // Indexado por ID: dos jugadores con el mismo nombre son dos entradas
  // distintas. Antes esto era un mapa por nombre y el segundo pisaba al
  // primero, así que el Elo se calculaba con el puntaje del equivocado
  // y los deltas salían mal para los cuatro.
  const mapaJugadores = leerJugadoresPorId_(jugadoresSheet);

  const [a1, a2] = payload.equipoA;
  const [b1, b2] = payload.equipoB;
  [payload.quienEres, a1, a2, b1, b2].forEach((id) => {
    if (!mapaJugadores[id]) {
      throw errorConCodigo_(
        'JUGADOR_DESCONOCIDO',
        'Uno de los jugadores del partido ya no figura en la lista. Recarga la página e inténtalo de nuevo.'
      );
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
    // El margen del resultado y la confiabilidad son dos ajustes
    // independientes sobre el K de este partido puntual -- se combinan
    // multiplicando, ninguno reemplaza al otro. Ver Elo.js.
    const partidosJugados = contarPartidosJugados_(historialSheet, [a1, a2, b1, b2]);
    const factor =
      factorMargen_(payload.resultado, config.pesoMargen) *
      factorConfiabilidad_(partidosJugados, config.partidosReferencia, config.pesoConfiabilidad);
    const kEfectivo = config.K * factor;
    const deltaA = calcularDeltaA_(promedioA, promedioB, ganoA, kEfectivo, config.D);
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
    // Las columnas E..H y M guardan IDs, que no se pueden leer a ojo.
    // Esta fórmula los traduce a nombres para quien abra la planilla; al
    // ser fórmula y no texto, si alguien corrige un nombre en Jugadores
    // el historial viejo también queda corregido.
    const filaNueva = historialSheet.getLastRow();
    historialSheet
      .getRange(filaNueva, COL_HISTORIAL_NOMBRES)
      .setFormula(formulaNombresHistorial_(filaNueva));

    // El delta por jugador (U..X) es de donde el puntaje de cada uno se
    // calcula desde la migración a delta por jugador. Por ahora los dos
    // compañeros reciben lo mismo -- el reparto según la valoración de
    // los rivales todavía no está conectado, así que esto se comporta
    // igual que antes. Las valoraciones (Q..T) quedan vacías.
    historialSheet
      .getRange(filaNueva, COL_HISTORIAL_VAL_A1, 1, 8)
      .setValues([['', '', '', '', deltaA, deltaA, deltaB, deltaB]]);

    // Este partido acaba de mover los puntajes, así que el ranking
    // cacheado quedó viejo. El flush primero: ver invalidarCacheRanking_
    // en Ranking.js para por qué importa el orden.
    SpreadsheetApp.flush();
    // Con los puntajes nuevos ya recalculados (la columna E de Jugadores
    // es una fórmula, por eso hace falta el flush de arriba), se decide
    // si alguno de los 4 cambió de categoría. Solo estos 4 pueden haber
    // cambiado: el puntaje de un jugador es la suma de SUS deltas, así
    // que nadie más se movió con este partido.
    actualizarCategoriaVigente_(
      jugadoresSheet,
      [a1, a2, b1, b2],
      getCategoryRanges_(),
      config.margenCategoria
    );
    // Segundo flush: lo de arriba escribió celdas, y el cache se invalida
    // después para que la primera lectura del ranking ya las vea.
    SpreadsheetApp.flush();
    invalidarCacheRanking_();

    return {
      deltaA: redondearDelta_(deltaA),
      deltaB: redondearDelta_(deltaB),
      equipoA: [mapaJugadores[a1].nombre, mapaJugadores[a2].nombre],
      equipoB: [mapaJugadores[b1].nombre, mapaJugadores[b2].nombre],
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
  // Compara IDs, no nombres: dos personas distintas que se llaman igual
  // tienen IDs distintos y pueden jugar el mismo partido. Cuando esto
  // comparaba nombres, ese caso quedaba bloqueado con un mensaje falso.
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
    throw new Error('Demasiados intentos con PIN incorrecto. Inténtalo de nuevo en 15 minutos.');
  }
  if (String(pin || '').trim() !== String(config.pinAdmin).trim()) {
    cache.put('pinAdminFallos', String(intentosFallidos + 1), 900); // 15 min
    throw new Error('PIN de administración incorrecto.');
  }
  cache.remove('pinAdminFallos');
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

/**
 * Cuántos partidos jugó cada uno de los `ids` hasta ahora, contando
 * apariciones en las columnas E..H de Historial. Una sola lectura
 * agrupada de esas 4 columnas (no un COUNTIF por jugador), mismo
 * criterio que leerClavesHistorial_. Alimenta factorConfiabilidad_.
 */
function contarPartidosJugados_(historialSheet, ids) {
  const lastRow = historialSheet.getLastRow();
  const conteo = {};
  if (lastRow >= 2) {
    const values = historialSheet.getRange(2, 5, lastRow - 1, 4).getValues(); // E..H
    values.forEach((fila) => {
      fila.forEach((id) => {
        conteo[id] = (conteo[id] || 0) + 1;
      });
    });
  }
  return ids.map((id) => conteo[id] || 0);
}

/**
 * Guarda la valoración de los rivales sobre un partido YA cargado, y
 * recalcula con ella cómo se reparte entre los dos compañeros lo que le
 * tocó a cada pareja.
 *
 * Va aparte del envío del resultado a propósito: el partido tiene que
 * quedar guardado antes de que nadie valore. Si la valoración fuese parte
 * del mismo envío, un partido podría perderse porque el rival se fue y
 * quien cargaba se quedó trabado en una pantalla. La valoración es
 * opcional; sin ella el reparto es mitad y mitad, igual que siempre.
 *
 * Se puede llamar más de una vez sobre el mismo partido: pisa lo
 * anterior. Quien llama tiene que ser uno de los 4 del partido, la misma
 * regla que para cargar el resultado.
 *
 * `payload.valoraciones` son los puntos que recibió cada jugador:
 * {a1, a2, b1, b2}. A cada pareja la valoran LOS DOS de la pareja
 * contraria, repartiendo 6 puntos cada uno, así que cada par suma 12 --
 * o 6 si sólo votó uno, o 0 si esa pareja se quedó sin valorar.
 *
 * Dos votos y no uno porque con uno solo esa persona decidía sola el
 * reparto de sus rivales: darle cero a alguien que le cayera mal le
 * costaba puntos y nadie lo diluía. Con dos, un rencor pesa la mitad.
 */
function guardarValoracion_(payload) {
  const config = getConfig_();
  const historialSheet = getSpreadsheet_().getSheetByName(SHEET_HISTORIAL);
  const val = payload.valoraciones || {};

  const a1 = numeroValoracion_(val.a1);
  const a2 = numeroValoracion_(val.a2);
  const b1 = numeroValoracion_(val.b1);
  const b2 = numeroValoracion_(val.b2);
  validarParVotos_(a1 + a2, 'A');
  validarParVotos_(b1 + b2, 'B');

  // Mismo candado que al cargar un resultado: dos valoraciones a la vez
  // sobre el mismo partido podrían leer el delta base y escribir encima
  // una de la otra.
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const fila = buscarFilaPartido_(historialSheet, payload.fecha, payload.cancha, payload.hora);
    if (!fila) {
      throw new Error('No encontramos ese partido para valorarlo. Recarga la página e inténtalo de nuevo.');
    }

    // E..H son los 4 jugadores; K y L el delta base por jugador, el que
    // salió del Elo antes de repartir. Se recalcula SIEMPRE desde ese
    // delta base y no desde U..X, para que revalorar no acumule.
    const datos = historialSheet.getRange(fila, 5, 1, 8).getValues()[0]; // E..L
    const jugadores = [datos[0], datos[1], datos[2], datos[3]];
    const deltaBaseA = Number(datos[6]);
    const deltaBaseB = Number(datos[7]);

    if (!payload.quienEres || jugadores.indexOf(payload.quienEres) === -1) {
      throw new Error('Solo los jugadores de ese partido pueden valorarlo.');
    }

    // El puntaje de cada uno ANTES de este partido, que es contra lo que
    // repartoPorValoracion_ compara el voto de los rivales.
    //
    // Hay que restarlo, no leerlo a secas: el puntaje que hay en
    // Jugadores es una fórmula que ya suma el delta de ESTE partido
    // (columnas U..X). Si se usara tal cual, revalorar dos veces el
    // mismo partido daría resultados distintos, porque la segunda vez el
    // puntaje ya arrastraría el reparto de la primera. Restando el delta
    // guardado se recupera el estado previo y el cálculo vuelve a ser el
    // mismo cuantas veces se corra -- el mismo criterio por el que el
    // delta base se relee de K/L y no de U..X.
    const puntajePorId = {};
    leerJugadores_(getSpreadsheet_().getSheetByName(SHEET_JUGADORES)).forEach((j) => {
      puntajePorId[j.id] = j.puntaje;
    });
    const deltasGuardados = historialSheet
      .getRange(fila, COL_HISTORIAL_DELTA_A1, 1, 4)
      .getValues()[0];
    const puntajePrevio_ = (posicion) => {
      const id = String(jugadores[posicion]).trim();
      return (Number(puntajePorId[id]) || 0) - (Number(deltasGuardados[posicion]) || 0);
    };

    const [deltaA1, deltaA2] = repartirDelta_(
      deltaBaseA,
      repartoPorValoracion_(a1, a2, config.topeReparto, puntajePrevio_(0), puntajePrevio_(1), config.D)
    );
    const [deltaB1, deltaB2] = repartirDelta_(
      deltaBaseB,
      repartoPorValoracion_(b1, b2, config.topeReparto, puntajePrevio_(2), puntajePrevio_(3), config.D)
    );

    historialSheet
      .getRange(fila, COL_HISTORIAL_VAL_A1, 1, 8)
      .setValues([[a1, a2, b1, b2, deltaA1, deltaA2, deltaB1, deltaB2]]);

    SpreadsheetApp.flush();
    // La valoración reparte el delta distinto entre los dos compañeros,
    // así que también puede cruzar a alguien de categoría -- no es solo
    // cosa de cargar el resultado.
    actualizarCategoriaVigente_(
      getSpreadsheet_().getSheetByName(SHEET_JUGADORES),
      jugadores.map((id) => String(id).trim()),
      getCategoryRanges_(),
      config.margenCategoria
    );
    SpreadsheetApp.flush();
    invalidarCacheRanking_();

    // leerJugadores_ devuelve un array; acá hace falta buscar por id.
    const porId = {};
    leerJugadores_(getSpreadsheet_().getSheetByName(SHEET_JUGADORES)).forEach((j) => {
      porId[j.id] = j;
    });
    const nombre = (id) => (porId[id] ? porId[id].nombre : id);
    return {
      jugadores: [
        { nombre: nombre(jugadores[0]), delta: redondearDelta_(deltaA1) },
        { nombre: nombre(jugadores[1]), delta: redondearDelta_(deltaA2) },
        { nombre: nombre(jugadores[2]), delta: redondearDelta_(deltaB1) },
        { nombre: nombre(jugadores[3]), delta: redondearDelta_(deltaB2) },
      ],
    };
  } finally {
    lock.releaseLock();
  }
}

/** Los puntos que reparte cada persona al valorar a la pareja rival. */
const PUNTOS_VALORACION = 6;

/** Cuántas personas valoran a cada pareja: los dos rivales. */
const VOTANTES_POR_PAREJA = 2;

function numeroValoracion_(v) {
  const n = Math.round(Number(v) || 0);
  // El tope es el doble porque a cada jugador lo pueden votar los dos
  // rivales, y en el extremo los dos le dan sus 6 puntos.
  if (n < 0 || n > PUNTOS_VALORACION * VOTANTES_POR_PAREJA) {
    throw new Error('Cada valoración va de 0 a ' + PUNTOS_VALORACION * VOTANTES_POR_PAREJA + '.');
  }
  return n;
}

/**
 * Lo que recibe una pareja tiene que ser un reparto entero de votantes:
 * 0 si nadie la valoró, 6 si votó uno, 12 si votaron los dos. Cualquier
 * otro total significa que llegó algo mal armado.
 */
function validarParVotos_(total, cual) {
  for (let votantes = 0; votantes <= VOTANTES_POR_PAREJA; votantes++) {
    if (total === PUNTOS_VALORACION * votantes) return;
  }
  throw new Error(
    'La valoración de la pareja ' + cual + ' tiene que sumar 0, ' + PUNTOS_VALORACION +
      ' o ' + PUNTOS_VALORACION * VOTANTES_POR_PAREJA + ' puntos.'
  );
}

/**
 * Dos decimales, no uno. Con un decimal, un partido entre parejas de
 * nivel muy distinto mueve tan poco que los cuatro jugadores salían con
 * el mismo ±0.1 en pantalla aunque el reparto por valoración hubiera sido
 * 70/30 -- la diferencia desaparecía justo en la pantalla que existe para
 * mostrarla.
 */
function redondearDelta_(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Número de fila del partido identificado por fecha + cancha + hora, o
 * null. Es la misma clave con la que se detectan los duplicados, así que
 * identifica un partido de forma única.
 */
function buscarFilaPartido_(historialSheet, fecha, cancha, hora) {
  const lastRow = historialSheet.getLastRow();
  if (lastRow < 2) return null;
  const values = historialSheet.getRange(2, 2, lastRow - 1, 3).getValues();
  const zona = Session.getScriptTimeZone();
  for (let i = 0; i < values.length; i++) {
    const [fechaFila, canchaFila, horaFila] = values[i];
    const fechaStr =
      fechaFila instanceof Date ? Utilities.formatDate(fechaFila, zona, 'yyyy-MM-dd') : String(fechaFila);
    const horaStr =
      horaFila instanceof Date ? Utilities.formatDate(horaFila, zona, 'HH:mm') : String(horaFila);
    if (fechaStr === String(fecha) && String(canchaFila) === String(cancha) && horaStr === String(hora)) {
      return i + 2;
    }
  }
  return null;
}
