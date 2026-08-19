/**
 * Reset.js
 * Utilidad de una sola vez para vaciar los datos de prueba antes de
 * invitar jugadores reales. Correr limpiarDatosDePrueba() a mano desde
 * el editor de Apps Script (elegirla en el desplegable de funciones y
 * tocar Ejecutar) -- no está atada a ningún trigger, no se dispara sola.
 *
 * Borra todas las filas de Jugadores, Historial, Registros y las
 * respuestas del formulario viejo (deja los encabezados). NO toca
 * Categorías (la configuración del club) ni el Ranking, que es 100%
 * fórmula sobre Jugadores y queda vacío solo.
 *
 * Al vaciar Jugadores se reinicia también la numeración de IDs: el
 * próximo jugador vuelve a ser J001. Es lo correcto para un reset de
 * datos de prueba, pero NO corras esto con datos reales -- los IDs de
 * los partidos que queden en cualquier lado dejarían de apuntar a nadie.
 */
function limpiarDatosDePrueba(confirmacion) {
  // Seguro. El 2026-08-18 esta función se corrió por error sobre la
  // planilla real —está en el mismo archivo que los borrados puntuales y
  // aparece primera en el desplegable— y se llevó los 17 jugadores y los
  // 36 partidos. Como desde el desplegable se ejecuta SIN argumentos,
  // ahora no hace nada salvo que se la llame a propósito desde otra
  // función o desde la consola con la palabra exacta.
  if (confirmacion !== 'BORRAR TODO') {
    Logger.log(
      'FRENADO: limpiarDatosDePrueba() borra TODOS los jugadores y TODOS los partidos.\n' +
        'Si de verdad querés vaciar la planilla, llamala así desde la consola:\n' +
        "    limpiarDatosDePrueba('BORRAR TODO')\n" +
        'Si lo que querés es borrar uno o dos partidos puntuales, usá borrarPartidos_().'
    );
    return;
  }

  const ss = getSpreadsheet_();

  limpiarFilas_(ss.getSheetByName(SHEET_JUGADORES));
  limpiarFilas_(ss.getSheetByName(SHEET_HISTORIAL));
  limpiarFilas_(ss.getSheetByName(SHEET_REGISTROS));

  const respuestas = ss.getSheets().find((s) => s.getName().indexOf('Form Responses') === 0);
  limpiarFilas_(respuestas);

  Logger.log(
    'Listo. Jugadores, Historial, Registros' +
      (respuestas ? ' y "' + respuestas.getName() + '"' : '') +
      ' quedaron vacíos (solo el encabezado). Categorías no se tocó.'
  );
}

function limpiarFilas_(sheet) {
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);
}

/**
 * Borra partidos puntuales del Historial por su clave (fecha + cancha +
 * hora), que es la misma combinación con la que submitResultado detecta
 * duplicados y por lo tanto identifica un partido de forma única.
 *
 * Para qué: durante las pruebas quedan partidos inventados en el
 * Historial real que movieron el puntaje de gente de verdad. Borrarlos a
 * mano en la planilla funciona, pero es fácil equivocarse de fila -- acá
 * se nombra el partido y el script encuentra la fila.
 *
 * No hay que recalcular nada después: los puntajes de Jugadores son
 * fórmulas que suman el Historial, así que al desaparecer la fila se
 * corrigen solos.
 *
 * Correr a mano desde el editor. Ejemplo:
 *
 *   borrarPartidos_([
 *     { fecha: '2026-08-17', cancha: 'Cancha 4', hora: '20:30' },
 *   ]);
 *
 * Se borran de abajo hacia arriba para que los índices de las filas que
 * todavía no se borraron no se corran en el medio.
 */
function borrarPartidos_(claves) {
  if (!claves || !claves.length) {
    Logger.log('Pasale una lista de partidos: [{fecha, cancha, hora}, ...]');
    return;
  }

  const sheet = getSpreadsheet_().getSheetByName(SHEET_HISTORIAL);
  const ultimaFila = sheet.getLastRow();
  if (ultimaFila < 2) {
    Logger.log('El Historial está vacío.');
    return;
  }

  // B=fecha, C=cancha, D=hora. La fecha puede venir como Date o como
  // texto según cómo se haya cargado la fila, así que se normaliza.
  const filas = sheet.getRange(2, 2, ultimaFila - 1, 3).getValues();
  const zona = Session.getScriptTimeZone();
  const normFecha = (v) =>
    v instanceof Date ? Utilities.formatDate(v, zona, 'yyyy-MM-dd') : String(v).trim();
  const normHora = (v) =>
    v instanceof Date ? Utilities.formatDate(v, zona, 'HH:mm') : String(v).trim();

  const aBorrar = [];
  claves.forEach((clave) => {
    let encontrada = false;
    filas.forEach((fila, i) => {
      if (
        normFecha(fila[0]) === String(clave.fecha).trim() &&
        String(fila[1]).trim() === String(clave.cancha).trim() &&
        normHora(fila[2]) === String(clave.hora).trim()
      ) {
        aBorrar.push(i + 2);
        encontrada = true;
      }
    });
    if (!encontrada) {
      Logger.log(
        'NO ENCONTRADO: ' + clave.fecha + ' ' + clave.cancha + ' ' + clave.hora + '. No se borró nada por esta clave.'
      );
    }
  });

  if (!aBorrar.length) {
    Logger.log('No se borró ninguna fila.');
    return;
  }

  aBorrar
    .sort((a, b) => b - a)
    .forEach((fila) => {
      Logger.log('Borrando fila ' + fila + ' del Historial.');
      sheet.deleteRow(fila);
    });

  SpreadsheetApp.flush();
  invalidarCacheRanking_();
  Logger.log(aBorrar.length + ' fila(s) borrada(s). Los puntajes ya se recalcularon solos.');
}

/**
 * Los dos partidos de prueba que quedaron cargados el 2026-08-17 mientras
 * se probaba el marcador nuevo contra producción. Movieron el puntaje de
 * 7 jugadores reales. Correr una vez y después se puede borrar esta
 * función.
 */
function borrarPruebasDel17DeAgosto() {
  borrarPartidos_([
    { fecha: '2026-08-17', cancha: 'Cancha 4', hora: '20:30' },
    { fecha: '2026-08-17', cancha: 'Cancha 4', hora: '19:00' },
  ]);
}

/**
 * Los dos partidos de prueba del 2026-08-18, cargados para verificar el
 * reparto por valoración de punta a punta (uno por API, otro desde la
 * pantalla). Movieron el puntaje de 8 jugadores reales. Correr una vez.
 */
function borrarPruebasDel18DeAgosto() {
  borrarPartidos_([
    { fecha: '2026-08-18', cancha: 'Cancha 5', hora: '10:00' },
    { fecha: '2026-08-18', cancha: 'Cancha 3', hora: '22:00' },
  ]);
}
