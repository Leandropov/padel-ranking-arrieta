/**
 * Reset.js
 * Herramientas de borrado sobre la planilla. Ninguna está atada a un
 * trigger: se corren a mano desde el editor de Apps Script.
 *
 * Hay dos, y la diferencia importa:
 *
 *   borrarPartidos_()      quirúrgico. Borra los partidos que se le
 *                          nombren, por fecha + cancha + hora.
 *
 *   limpiarDatosDePrueba() arrasa. Deja la planilla en cero: sin
 *                          jugadores, sin historial, sin bitácoras.
 *
 * El 2026-08-18 se corrió la segunda queriendo la primera y se perdieron
 * los 17 jugadores y los 36 partidos del club (recuperados desde el
 * respaldo automático de la migración). Por eso ahora la destructiva pide
 * una confirmación explícita y desde el desplegable no hace nada.
 *
 * Regla para el futuro: las funciones de un solo uso que envuelven a
 * borrarPartidos_ con fechas concretas se BORRAN de este archivo una vez
 * corridas. Si se dejan, el desplegable se llena de nombres parecidos que
 * ya no hacen nada, y entre ellos es cuestión de tiempo elegir el
 * equivocado.
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
        'El editor no tiene consola, así que para correrla de verdad hay que escribir\n' +
        'una función temporal en este archivo que la llame con la palabra exacta:\n' +
        "    function vaciarTodoDeVerdad() { limpiarDatosDePrueba('BORRAR TODO'); }\n" +
        'Ese trámite es a propósito: obliga a decidirlo dos veces.\n' +
        'Si lo que querés es borrar uno o dos partidos puntuales, no es esta función.'
    );
    return;
  }

  const ss = getSpreadsheet_();

  limpiarFilas_(ss.getSheetByName(SHEET_JUGADORES));
  limpiarFilas_(ss.getSheetByName(SHEET_HISTORIAL));
  limpiarFilas_(ss.getSheetByName(SHEET_REGISTROS));

  const respuestas = ss.getSheets().find((s) => s.getName().indexOf('Form Responses') === 0);
  limpiarFilas_(respuestas);

  // Sin esto el ranking sigue sirviendo desde la caché los puntajes de
  // los jugadores que acaban de desaparecer.
  SpreadsheetApp.flush();
  invalidarCacheRanking_();

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

  // Sin quitar repetidos, borrar dos veces la misma fila se lleva puesta
  // a la siguiente: al borrar la fila N las de abajo suben, así que el
  // segundo deleteRow(N) elimina un partido que nadie pidió borrar. Pasa
  // con solo repetir una clave por copy-paste.
  const filasUnicas = aBorrar.filter((fila, i) => aBorrar.indexOf(fila) === i);

  filasUnicas
    .sort((a, b) => b - a)
    .forEach((fila) => {
      Logger.log('Borrando fila ' + fila + ' del Historial.');
      sheet.deleteRow(fila);
    });

  SpreadsheetApp.flush();
  invalidarCacheRanking_();
  Logger.log(filasUnicas.length + ' fila(s) borrada(s). Los puntajes ya se recalcularon solos.');
}
