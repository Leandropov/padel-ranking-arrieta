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
 * Migración de UNA SOLA VEZ: de un delta por PAREJA a un delta por
 * JUGADOR. Correr a mano desde el editor de Apps Script.
 *
 * Por qué: hasta ahora los dos compañeros de una pareja se movían
 * exactamente lo mismo, así que alcanzaba con guardar un delta por equipo
 * (columnas K y L) y sumárselo a los dos. Cuando los rivales empiecen a
 * valorar quién jugó mejor, los compañeros dejan de moverse igual y cada
 * uno necesita su propio número.
 *
 * Esta migración NO cambia ningún puntaje. Solo copia el delta de cada
 * pareja a las dos columnas nuevas de sus jugadores (U=V=K, W=X=L) y
 * repunta las fórmulas de Jugadores para que lean de ahí. El reparto
 * según valoración se conecta después, en un cambio aparte.
 *
 * Qué hace, en orden:
 *   1. Respalda la planilla entera.
 *   2. Anota el puntaje actual de cada jugador (para verificar al final).
 *   3. Escribe los encabezados de Q..X en el Historial.
 *   4. Copia K -> U,V y L -> W,X en todas las filas existentes.
 *   5. Reescribe la fórmula de puntaje de cada jugador (ahora lee U..X).
 *   6. Verifica que los puntajes hayan quedado EXACTAMENTE iguales.
 */
function migrarADeltaPorJugador() {
  const ss = getSpreadsheet_();
  const jugadoresSheet = ss.getSheetByName(SHEET_JUGADORES);
  const historialSheet = ss.getSheetByName(SHEET_HISTORIAL);

  if (String(historialSheet.getRange(1, COL_HISTORIAL_DELTA_A1).getValue()).trim() === 'Delta A1') {
    Logger.log('La planilla YA está migrada (Historial!U1 dice "Delta A1"). No se tocó nada.');
    return;
  }

  const respaldo = ss.copy(
    ss.getName() +
      ' (respaldo pre-delta-por-jugador ' +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') +
      ')'
  );
  Logger.log('Respaldo creado: ' + respaldo.getUrl());

  // --- 2. Estado previo, indexado por ID -------------------------------
  const ultimaFilaJugadores = jugadoresSheet.getLastRow();
  if (ultimaFilaJugadores < 2) {
    Logger.log('No hay jugadores. No hay nada que migrar.');
    return;
  }
  const jugadores = jugadoresSheet
    .getRange(2, 1, ultimaFilaJugadores - 1, 5)
    .getValues()
    .filter((fila) => fila[0]);

  const puntajesAntes = {};
  jugadores.forEach(([id, , , , actual]) => {
    puntajesAntes[String(id).trim()] = Number(actual);
  });

  // --- 3. Encabezados nuevos -------------------------------------------
  historialSheet
    .getRange(1, COL_HISTORIAL_VAL_A1, 1, ENCABEZADOS_VALORACION.length)
    .setValues([ENCABEZADOS_VALORACION])
    .setFontWeight('bold');

  // --- 4. Copiar los deltas de pareja a los de jugador ------------------
  // Se lee y se escribe todo de una sola vez: fila por fila serían cientos
  // de llamadas a la planilla y Apps Script corta a los 6 minutos.
  const ultimaFilaHistorial = historialSheet.getLastRow();
  let partidos = 0;
  if (ultimaFilaHistorial >= 2) {
    const cantidad = ultimaFilaHistorial - 1;
    const deltasPareja = historialSheet.getRange(2, 11, cantidad, 2).getValues(); // K y L
    const porJugador = deltasPareja.map(([deltaA, deltaB]) => {
      // Una fila sin delta (cargada a mano, o a medio escribir) se deja en
      // blanco en vez de convertirse en un 0 que el SUMIF sí sumaría.
      const a = deltaA === '' || deltaA === null ? '' : Number(deltaA);
      const b = deltaB === '' || deltaB === null ? '' : Number(deltaB);
      return [a, a, b, b];
    });
    historialSheet
      .getRange(2, COL_HISTORIAL_DELTA_A1, cantidad, 4)
      .setValues(porJugador);
    partidos = cantidad;
  }
  Logger.log('Deltas copiados en ' + partidos + ' partido(s).');

  // --- 5. Repuntar las fórmulas de Jugadores ---------------------------
  const formulas = jugadores.map((_, i) => [formulaPuntajeActual_(i + 2)]);
  if (formulas.length) {
    jugadoresSheet.getRange(2, 5, formulas.length, 1).setFormulas(formulas);
  }
  Logger.log('Fórmulas repuntadas en ' + formulas.length + ' jugador(es).');

  // --- 6. Verificación --------------------------------------------------
  SpreadsheetApp.flush();
  verificarPuntajesPorId_(jugadoresSheet, jugadores.length, puntajesAntes);

  Logger.log('Migración terminada. Respaldo: ' + respaldo.getUrl());
}

/**
 * Gemela de verificarPuntajes_, pero comparando por ID en vez de por
 * nombre: acá los IDs ya existen de la migración anterior y son la clave
 * confiable. Esta migración no debe mover ningún puntaje ni un decimal.
 */
function verificarPuntajesPorId_(jugadoresSheet, cantidad, puntajesAntes) {
  const despues = jugadoresSheet.getRange(2, 1, cantidad, 5).getValues();
  const problemas = [];

  despues.forEach(([id, nombre, , , actual]) => {
    const antes = puntajesAntes[String(id).trim()];
    if (antes === undefined) return;
    const ahora = Number(actual);
    if (Math.abs(antes - ahora) > 0.001) {
      problemas.push(nombre + ' (' + id + '): antes ' + antes.toFixed(3) + ', ahora ' + ahora.toFixed(3));
    }
  });

  if (problemas.length) {
    Logger.log('*** LOS PUNTAJES NO COINCIDEN. Revisar antes de seguir: ***');
    problemas.forEach((p) => Logger.log('  - ' + p));
    Logger.log('Volvé al respaldo que se creó al principio.');
  } else {
    Logger.log('Verificación OK: los ' + cantidad + ' puntajes quedaron idénticos.');
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

/**
 * Agrega a una planilla YA instalada la fila de configuración del tope de
 * reparto por valoración. Setup.js la escribe en las instalaciones
 * nuevas, pero las que ya existen no la tienen y sin ella el reparto
 * queda inerte (mitad y mitad para los dos compañeros).
 *
 * La ubica justo debajo de la fila de confiabilidad en vez de en un
 * número de fila fijo, porque getConfig_ busca por etiqueta y el club
 * puede haber movido cosas. Correr a mano una sola vez; si la fila ya
 * está, no hace nada.
 */
function agregarTopeDeReparto() {
  const sheet = getSpreadsheet_().getSheetByName(SHEET_CATEGORIAS);
  const etiquetas = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();

  const yaEsta = etiquetas.some(([e]) => String(e).toLowerCase().includes('tope del reparto'));
  if (yaEsta) {
    Logger.log('La fila "Tope del reparto" YA existe. No se tocó nada.');
    return;
  }

  const filaConfiabilidad = etiquetas.findIndex(([e]) =>
    String(e).toLowerCase().includes('confiabilidad')
  );
  if (filaConfiabilidad === -1) {
    Logger.log('No encontré la fila de confiabilidad para ubicarme. No se tocó nada.');
    return;
  }

  const destino = filaConfiabilidad + 2; // findIndex es 0-based; +1 fila, +1 para ir debajo
  sheet.insertRowAfter(filaConfiabilidad + 1);
  sheet
    .getRange(destino, 1, 1, 2)
    .setValues([['Tope del reparto por valoración (0.7 = 70/30, vacío lo desactiva)', 0.7]]);

  Logger.log('Fila "Tope del reparto por valoración" agregada en la fila ' + destino + ' con valor 0.7.');
}

/**
 * Agrega a la pestaña Categorías la fila "Margen para cambiar de
 * categoría", que es la que enciende la histéresis. Correr a mano una
 * sola vez; si la fila ya está, no hace nada.
 *
 * Mismo criterio que agregarTopeDeReparto: se ubica debajo de la fila
 * que ya existe en vez de en un número fijo, porque getConfig_ busca por
 * etiqueta y el club puede haber movido cosas de lugar.
 *
 * El valor 2 es un punto de partida, no un número calibrado: son ~0,3
 * del ancho de una categoría de 10 puntos, que es lo que se simuló.
 */
function agregarMargenDeCategoria() {
  const sheet = getSpreadsheet_().getSheetByName(SHEET_CATEGORIAS);
  const etiquetas = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();

  const yaEsta = etiquetas.some(([e]) => String(e).toLowerCase().includes('margen para cambiar'));
  if (yaEsta) {
    Logger.log('La fila "Margen para cambiar de categoría" YA existe. No se tocó nada.');
    return;
  }

  const filaTope = etiquetas.findIndex(([e]) => String(e).toLowerCase().includes('tope del reparto'));
  if (filaTope === -1) {
    Logger.log('No encontré la fila del tope del reparto para ubicarme. No se tocó nada.');
    return;
  }

  const destino = filaTope + 2; // findIndex es 0-based; +1 fila, +1 para ir debajo
  sheet.insertRowAfter(filaTope + 1);
  sheet
    .getRange(destino, 1, 1, 2)
    .setValues([['Margen para cambiar de categoría (en puntos, 0 lo desactiva)', 2]]);

  Logger.log('Fila "Margen para cambiar de categoría" agregada en la fila ' + destino + ' con valor 2.');
}

/**
 * Llena la columna F de Jugadores ("Categoría vigente") para los
 * jugadores que ya estaban antes de que existiera la histéresis.
 *
 * Hasta ahora la categoría se deducía del puntaje cada vez que alguien
 * abría el ranking, sin guardarse en ningún lado. La histéresis necesita
 * saber en cuál estabas antes (ver categoriaConHisteresis_ en
 * Ranking.js), así que hay que darle un punto de partida. El punto de
 * partida correcto es la categoría que la app venía mostrando, o sea la
 * que sale del puntaje a secas, sin margen.
 *
 * Es aditiva: escribe una columna que antes no existía y no toca ni
 * puntajes ni Historial. Aun así saca respaldo, como el resto de las
 * migraciones de este archivo.
 *
 * Correr a mano una sola vez, DESPUÉS de agregarMargenDeCategoria().
 * Volver a correrla no rompe nada, pero pisa la categoría vigente de
 * todos con la que salga del puntaje, y con eso se pierde la memoria de
 * quién estaba adentro de la banda de histéresis.
 */
function migrarCategoriaVigente() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_JUGADORES);
  const rangos = getCategoryRanges_();

  const respaldo = ss.copy(
    ss.getName() +
      ' (respaldo pre-categoría-vigente ' +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') +
      ')'
  );
  Logger.log('Respaldo creado: ' + respaldo.getUrl());

  sheet.getRange(1, COL_JUGADORES_CATEGORIA_VIGENTE).setValue('Categoría vigente').setFontWeight('bold');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('No hay jugadores todavía. Solo se escribió el encabezado.');
    return;
  }

  const filas = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  const aEscribir = filas.map((row) => {
    if (!row[0] || !row[1]) return [''];
    return [categoriaPorPuntaje_(Number(row[4]), rangos)];
  });
  sheet
    .getRange(2, COL_JUGADORES_CATEGORIA_VIGENTE, aEscribir.length, 1)
    .setValues(aEscribir);
  sheet.autoResizeColumns(COL_JUGADORES_CATEGORIA_VIGENTE, 1);

  const cuenta = {};
  aEscribir.forEach(([c]) => {
    if (c) cuenta[c] = (cuenta[c] || 0) + 1;
  });
  Logger.log('Categoría vigente escrita para ' + aEscribir.filter(([c]) => c).length + ' jugadores.');
  Logger.log('Reparto: ' + JSON.stringify(cuenta));
  Logger.log('Respaldo: ' + respaldo.getUrl());
}

/**
 * Restaura Jugadores, Historial, Registros y las respuestas del formulario
 * viejo desde una copia de respaldo, y deja la planilla lista para el
 * esquema actual (delta por jugador en U..X).
 *
 * Existe porque limpiarDatosDePrueba() vació la planilla real por error:
 * está en el mismo archivo que las utilidades de borrado puntual y es la
 * primera del desplegable, así que es fácil elegirla sin querer.
 *
 * Sólo copia VALORES y después reescribe las fórmulas, en vez de copiar
 * las celdas tal cual: las fórmulas del respaldo apuntan a filas de otra
 * planilla y traerlas como texto dejaría referencias rotas.
 *
 * Es deliberadamente cobarde: si la planilla actual todavía tiene
 * jugadores, no toca nada. Restaurar encima de datos buenos sería peor
 * que el problema que viene a resolver.
 *
 * Correr a mano pasándole el ID del respaldo (lo que va entre /d/ y /edit
 * en su URL).
 */
function restaurarDesdeRespaldo(idDelRespaldo) {
  // Desde el desplegable esto se ejecuta SIN argumentos, así que en vez de
  // pedir un ID que nadie tiene a mano, se listan los respaldos que hay en
  // el Drive para poder copiar el que corresponda. Antes esta función
  // parecía "no hacer nada" y era fácil creer que había restaurado.
  if (!idDelRespaldo) {
    Logger.log('Esta función necesita el ID de un respaldo. Los que hay en tu Drive:');
    const archivos = DriveApp.searchFiles(
      'title contains "respaldo" and mimeType = "application/vnd.google-apps.spreadsheet" and trashed = false'
    );
    let hubo = false;
    while (archivos.hasNext()) {
      const f = archivos.next();
      hubo = true;
      Logger.log('  ' + f.getName() + '\n      restaurarDesdeRespaldo("' + f.getId() + '")');
    }
    if (!hubo) Logger.log('  (no encontré ninguno)');
    Logger.log('Copiá la línea del respaldo que quieras y corréla desde la consola del editor.');
    return;
  }

  const destino = getSpreadsheet_();
  const jugadoresDestino = destino.getSheetByName(SHEET_JUGADORES);
  if (jugadoresDestino.getLastRow() > 1) {
    Logger.log(
      'La planilla actual TIENE ' + (jugadoresDestino.getLastRow() - 1) + ' jugador(es). ' +
        'No se restauró nada: esto sólo corre sobre una planilla vacía.'
    );
    return;
  }

  const origen = SpreadsheetApp.openById(idDelRespaldo);
  Logger.log('Restaurando desde: ' + origen.getName());

  // --- Jugadores: A..D son valores, E es fórmula ------------------------
  const jugadores = leerBloque_(origen.getSheetByName(SHEET_JUGADORES), 4);
  if (!jugadores.length) {
    Logger.log('El respaldo no tiene jugadores. No se tocó nada.');
    return;
  }
  jugadoresDestino.getRange(2, 1, jugadores.length, 4).setValues(jugadores);
  jugadoresDestino
    .getRange(2, 5, jugadores.length, 1)
    .setFormulas(jugadores.map((_, i) => [formulaPuntajeActual_(i + 2)]));
  Logger.log('Jugadores restaurados: ' + jugadores.length);

  // --- Historial: A..O son valores, P es fórmula, U..X se recalculan ----
  const historialDestino = destino.getSheetByName(SHEET_HISTORIAL);
  const partidos = leerBloque_(origen.getSheetByName(SHEET_HISTORIAL), 15);
  if (partidos.length) {
    historialDestino.getRange(2, 1, partidos.length, 15).setValues(partidos);
    historialDestino
      .getRange(2, COL_HISTORIAL_NOMBRES, partidos.length, 1)
      .setFormulas(partidos.map((_, i) => [formulaNombresHistorial_(i + 2)]));
    // K y L son el delta base por jugador; hasta que alguien valore, los
    // dos compañeros se mueven igual.
    historialDestino.getRange(2, COL_HISTORIAL_DELTA_A1, partidos.length, 4).setValues(
      partidos.map((fila) => {
        const a = fila[10] === '' || fila[10] === null ? '' : Number(fila[10]);
        const b = fila[11] === '' || fila[11] === null ? '' : Number(fila[11]);
        return [a, a, b, b];
      })
    );
  }
  Logger.log('Partidos restaurados: ' + partidos.length);

  // --- Bitácoras: se copian tal cual, no tienen fórmulas ---------------
  copiarHojaSimple_(origen, destino, SHEET_REGISTROS);
  const respuestas = origen.getSheets().find((s) => s.getName().indexOf('Form Responses') === 0);
  if (respuestas) copiarHojaSimple_(origen, destino, respuestas.getName());

  SpreadsheetApp.flush();
  invalidarCacheRanking_();
  Logger.log('Restauración terminada. Revisá el ranking antes de seguir.');
}

/** Filas de datos (sin encabezado) de una hoja, hasta `columnas` columnas. */
function leerBloque_(sheet, columnas) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, columnas)
    .getValues()
    .filter((fila) => String(fila[0]).trim() !== '');
}

function copiarHojaSimple_(origen, destino, nombre) {
  const hojaOrigen = origen.getSheetByName(nombre);
  const hojaDestino = destino.getSheetByName(nombre);
  if (!hojaOrigen || !hojaDestino || hojaOrigen.getLastRow() < 2) return;
  const columnas = hojaOrigen.getLastColumn();
  const filas = hojaOrigen.getRange(2, 1, hojaOrigen.getLastRow() - 1, columnas).getValues();
  hojaDestino.getRange(2, 1, filas.length, columnas).setValues(filas);
  Logger.log(nombre + ': ' + filas.length + ' fila(s) restaurada(s).');
}

/**
 * Restaura desde el respaldo más reciente que haya en el Drive.
 *
 * Existe porque el editor de Apps Script no tiene consola: solo se pueden
 * ejecutar funciones del desplegable, sin argumentos. Sin esta, recuperar
 * la planilla exigía escribir a mano una función con el ID del respaldo
 * adentro -- justo el trámite que uno no quiere estar haciendo cuando
 * acaba de perder los datos.
 *
 * Es segura por construcción: restaurarDesdeRespaldo se niega a tocar una
 * planilla que todavía tenga jugadores.
 */
function restaurarDesdeElRespaldoMasReciente() {
  const archivos = DriveApp.searchFiles(
    'title contains "respaldo" and mimeType = "application/vnd.google-apps.spreadsheet" and trashed = false'
  );

  let elegido = null;
  while (archivos.hasNext()) {
    const f = archivos.next();
    if (!elegido || f.getDateCreated() > elegido.getDateCreated()) elegido = f;
  }

  if (!elegido) {
    Logger.log('No encontré ningún respaldo en tu Drive.');
    return;
  }

  Logger.log('Respaldo más reciente: ' + elegido.getName());
  restaurarDesdeRespaldo(elegido.getId());
}
