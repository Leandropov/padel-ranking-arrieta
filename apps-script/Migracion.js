/**
 * Migracion.js
 * Utilidades de UNA SOLA VEZ para pasar la planilla del modelo viejo
 * (el nombre escrito era la identidad del jugador) al nuevo (cada
 * jugador tiene un ID y el Historial guarda IDs). Ver Jugadores.js.
 *
 * Correr migrarAIdsDeJugador() a mano desde el editor de Apps Script.
 * No está atada a ningún trigger.
 *
 * Antes de tocar nada saca una copia de respaldo de la planilla entera,
 * así que es segura de correr. Si algo sale mal, el respaldo queda en el
 * Drive del dueño con la fecha en el nombre.
 *
 * Qué hace, en orden:
 *   1. Respalda la planilla.
 *   2. Anota el puntaje actual de cada jugador (para verificar al final).
 *   3. Le asigna un ID a cada jugador (J001, J002, ... en el orden en que
 *      están en la planilla).
 *   4. Reemplaza los nombres por IDs en el Historial (columnas E..H, que
 *      son los 4 jugadores, y M, que es quién cargó el resultado).
 *   5. Reestructura Jugadores y Ranking al layout nuevo.
 *   6. Crea la pestaña Registros.
 *   7. Verifica que los puntajes hayan quedado EXACTAMENTE iguales que
 *      en el paso 2, y avisa fuerte si alguno se movió.
 */

function migrarAIdsDeJugador() {
  const ss = getSpreadsheet_();
  const jugadoresSheet = ss.getSheetByName(SHEET_JUGADORES);
  const historialSheet = ss.getSheetByName(SHEET_HISTORIAL);

  if (String(jugadoresSheet.getRange('A1').getValue()).trim() === 'ID') {
    Logger.log('La planilla YA está migrada (Jugadores!A1 dice "ID"). No se tocó nada.');
    return;
  }

  const respaldo = ss.copy(
    ss.getName() + ' (respaldo pre-IDs ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') + ')'
  );
  Logger.log('Respaldo creado: ' + respaldo.getUrl());

  // --- 2. Estado previo -----------------------------------------------
  // Layout viejo: A=Nombre, B=Categoría, C=Puntaje inicial, D=Puntaje actual.
  const lastRow = jugadoresSheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('No hay jugadores para migrar.');
    return;
  }
  const viejo = jugadoresSheet
    .getRange(2, 1, lastRow - 1, 4)
    .getValues()
    .filter((row) => row[0]);

  const puntajesAntes = {};
  viejo.forEach(([nombre, , , actual]) => {
    puntajesAntes[String(nombre).trim()] = Number(actual);
  });

  // --- 3. Asignar IDs --------------------------------------------------
  const jugadores = viejo.map(([nombre, categoria, inicial], i) => ({
    id: PREFIJO_ID_JUGADOR + ('000' + (i + 1)).slice(-3),
    nombre: String(nombre).trim(),
    categoria: String(categoria).trim(),
    puntajeInicial: Number(inicial),
  }));

  const idPorNombre = {};
  jugadores.forEach((j) => {
    idPorNombre[normalizarNombre_(j.nombre)] = j.id;
  });
  Logger.log('IDs asignados a ' + jugadores.length + ' jugadores.');

  // --- 4. Historial: nombres -> IDs ------------------------------------
  const sinResolver = traducirHistorialAIds_(historialSheet, idPorNombre);

  // --- 5. Reestructurar Jugadores y Ranking ----------------------------
  jugadoresSheet.insertColumnBefore(1);
  jugadoresSheet.getRange('A1').setValue('ID').setFontWeight('bold');
  jugadores.forEach((j, i) => escribirFilaJugador_(jugadoresSheet, i + 2, j));
  jugadoresSheet.autoResizeColumns(1, 5);

  reconstruirRanking_(ss);

  // --- 6. Registros ----------------------------------------------------
  if (!ss.getSheetByName(SHEET_REGISTROS)) crearHojaRegistros_(ss);

  // --- 7. Verificación -------------------------------------------------
  SpreadsheetApp.flush();
  verificarPuntajes_(jugadoresSheet, jugadores, puntajesAntes);

  if (sinResolver.length) {
    Logger.log(
      'ATENCIÓN: ' + sinResolver.length + ' celda(s) del Historial tenían un nombre que no ' +
        'existe en Jugadores y quedaron sin traducir: ' + sinResolver.join(', ') + '. ' +
        'Revisalas a mano en la planilla.'
    );
  }

  Logger.log('Migración terminada. Respaldo: ' + respaldo.getUrl());
}

/**
 * Reemplaza por IDs los nombres de las columnas de jugadores del
 * Historial: E..H (los 4 del partido) y M (quién cargó el resultado).
 * Devuelve la lista de valores que no se pudieron resolver.
 *
 * Se leen y escriben las dos zonas de una sola vez: fila por fila serían
 * cientos de llamadas a la planilla y Apps Script corta a los 6 minutos.
 */
function traducirHistorialAIds_(historialSheet, idPorNombre) {
  const lastRow = historialSheet.getLastRow();
  if (lastRow < 2) return [];

  const sinResolver = [];
  const traducir = (valor) => {
    const texto = String(valor || '').trim();
    if (!texto) return '';
    // Ya migrado (o cargado a mano como ID): se deja como está.
    if (/^J\d{3,}$/i.test(texto)) return texto.toUpperCase();
    const id = idPorNombre[normalizarNombre_(texto)];
    if (!id) {
      if (sinResolver.indexOf(texto) === -1) sinResolver.push(texto);
      return texto;
    }
    return id;
  };

  // E..H = los 4 jugadores del partido.
  const rangoJugadores = historialSheet.getRange(2, 5, lastRow - 1, 4);
  rangoJugadores.setValues(rangoJugadores.getValues().map((fila) => fila.map(traducir)));

  // M = "Registrado por".
  const rangoRegistrador = historialSheet.getRange(2, 13, lastRow - 1, 1);
  rangoRegistrador.setValues(rangoRegistrador.getValues().map(([v]) => [traducir(v)]));

  // Columna de referencia legible, fila por fila (no ARRAYFORMULA: una
  // fórmula sobre la columna abierta infla getLastRow y rompe appendRow).
  historialSheet
    .getRange(1, COL_HISTORIAL_NOMBRES)
    .setValue('Jugadores (referencia)')
    .setFontWeight('bold');
  historialSheet.setColumnWidth(COL_HISTORIAL_NOMBRES, 320);
  const formulas = [];
  for (let fila = 2; fila <= lastRow; fila++) formulas.push([formulaNombresHistorial_(fila)]);
  historialSheet.getRange(2, COL_HISTORIAL_NOMBRES, formulas.length, 1).setFormulas(formulas);

  Logger.log('Historial traducido a IDs: ' + (lastRow - 1) + ' partidos.');
  return sinResolver;
}

/**
 * El Ranking es 100% derivado de Jugadores, así que se puede tirar y
 * rehacer sin perder nada.
 */
function reconstruirRanking_(ss) {
  const sheet = ss.getSheetByName(SHEET_RANKING);
  sheet.clear();
  sheet
    .getRange('A1:E1')
    .setValues([['ID', 'Nombre completo', 'Categoría declarada', 'Puntaje actual', 'Puesto']])
    .setFontWeight('bold');
  sheet
    .getRange('A2')
    .setFormula(
      '=IFERROR(SORT(QUERY(Jugadores!A2:E, "select A, B, C, E where A is not null", 0), 4, FALSE), "")'
    );
  sheet.getRange('E2').setFormula('=ARRAYFORMULA(IF(A2:A="","",ROW(A2:A)-1))');
  sheet.setFrozenRows(1);
  Logger.log('Ranking reconstruido con el layout nuevo.');
}

/**
 * El puntaje de cada jugador tiene que ser idéntico antes y después: la
 * migración cambia CÓMO se identifica a la persona, no cuánto sumó. Si
 * algo no coincide, es que un nombre del Historial no se tradujo bien y
 * ese jugador perdió (o ganó) partidos.
 *
 * Se compara con tolerancia de 0.001 porque son floats de Sheets.
 */
function verificarPuntajes_(jugadoresSheet, jugadores, puntajesAntes) {
  const despues = jugadoresSheet.getRange(2, 1, jugadores.length, 5).getValues();
  const problemas = [];

  despues.forEach(([id, nombre, , , actual]) => {
    const antes = puntajesAntes[String(nombre).trim()];
    const ahora = Number(actual);
    if (antes === undefined) return;
    if (Math.abs(antes - ahora) > 0.001) {
      problemas.push(nombre + ' (' + id + '): antes ' + antes.toFixed(3) + ', ahora ' + ahora.toFixed(3));
    }
  });

  if (problemas.length) {
    Logger.log('*** LOS PUNTAJES NO COINCIDEN. Revisar antes de seguir: ***');
    problemas.forEach((p) => Logger.log('  - ' + p));
    Logger.log('Podés volver al respaldo que se creó al principio.');
  } else {
    Logger.log('Verificación OK: los ' + jugadores.length + ' puntajes quedaron idénticos.');
  }
}

/**
 * Cierra el Google Form de registro viejo, si todavía existe, y le deja
 * un mensaje a quien entre con el link guardado.
 *
 * Correr a mano, pasándole la URL de EDICIÓN del formulario (la que
 * termina en /edit), que se saca desde Drive. No se busca solo porque el
 * formulario ya no está referenciado desde ningún lado del código.
 */
function cerrarFormularioViejo_(urlDeEdicion) {
  if (!urlDeEdicion) {
    Logger.log('Pasale la URL de edición del formulario. Ej: cerrarFormularioViejo_("https://docs.google.com/forms/d/.../edit")');
    return;
  }
  const form = FormApp.openByUrl(urlDeEdicion);
  form.setAcceptingResponses(false);
  form.setCustomClosedFormMessage(
    'El registro se mudó a la app del ranking. Entra desde el link o el QR del club y ' +
      'toca "Registrarme". Si ya estabas registrado, no tienes que hacer nada.'
  );
  Logger.log('Formulario cerrado: ' + form.getTitle());
}
