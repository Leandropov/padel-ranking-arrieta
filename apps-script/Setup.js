/**
 * Setup.js
 * Correr UNA sola vez la función setupClub() desde el editor de Apps Script.
 * Crea la planilla con sus 4 pestañas, el formulario de registro,
 * los triggers, y deja todo listo para usar.
 *
 * Cómo correrla: abrí este proyecto en script.google.com, elegí la función
 * "setupClub" en el desplegable de arriba, y tocá "Ejecutar". La primera vez
 * te va a pedir autorización (es tu propio script leyendo/escribiendo tus
 * propios Sheets/Forms, es normal y seguro aceptarlo).
 */

function setupClub() {
  const ss = SpreadsheetApp.create('Club de Pádel - Ranking');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

  setupCategorias_(ss);
  setupJugadores_(ss);
  setupRanking_(ss);
  setupHistorial_(ss);
  setupRegistros_(ss);

  // La hoja "Hoja 1" que Sheets crea por defecto ya no hace falta.
  const hojaDefault = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (hojaDefault) ss.deleteSheet(hojaDefault);

  Logger.log('Planilla creada: ' + ss.getUrl());
  Logger.log(
    'Ya no se crea un Google Form de registro: los jugadores se dan de alta ' +
      'desde la pantalla #registro de la app, que es la única que puede avisarle ' +
      'a alguien en el momento que su nombre ya está tomado. Ver Jugadores.js.'
  );
  Logger.log(
    'Paso pendiente manual: publicar la web app ' +
      '(Implementar > Nueva implementación > Aplicación web). Ver README.'
  );
}

function setupCategorias_(ss) {
  const sheet = ss.insertSheet(SHEET_CATEGORIAS);
  sheet.getRange('A1:C1').setValues([['Categoría', 'Puntos mínimo', 'Puntos máximo']]).setFontWeight('bold');
  sheet
    .getRange('A2:C6')
    .setValues([
      ['Sexta', 0, 10],
      ['Quinta', 11, 20],
      ['Cuarta', 21, 30],
      ['Tercera', 31, 40],
      ['Segunda', 41, 50],
    ]);
  sheet
    .getRange('A8')
    .setValue('Configuración (ajustable en cualquier momento, ver README para cómo recalibrar)')
    .setFontWeight('bold');
  sheet.getRange(CONFIG_ROW_K, 1, 1, 2).setValues([['K (máx. puntos que mueve un partido)', 2]]);
  sheet.getRange(CONFIG_ROW_D, 1, 1, 2).setValues([['D (sensibilidad Elo a la diferencia de nivel)', 20]]);
  sheet
    .getRange(CONFIG_ROW_CANCHAS, 1, 1, 2)
    .setValues([['Canchas (separadas por coma)', 'Cancha 1, Cancha 2, Cancha 3, Cancha 4']]);
  sheet.getRange(CONFIG_ROW_PARTIDOS_REF, 1, 1, 2).setValues([
    ['Partidos de referencia para corregir un nivel mal asignado', 5],
  ]);
  // Formato texto ANTES de escribir los valores, para que Sheets no
  // autoconvierta "07:00"/"22:00" a un valor de hora interno.
  sheet.getRange(CONFIG_ROW_APERTURA, 2, 4, 1).setNumberFormat('@');
  sheet.getRange(CONFIG_ROW_APERTURA, 1, 1, 2).setValues([['Horario de apertura del club (HH:MM)', '07:00']]);
  sheet.getRange(CONFIG_ROW_CIERRE, 1, 1, 2).setValues([['Horario de cierre del club (HH:MM)', '22:00']]);
  sheet
    .getRange(CONFIG_ROW_DURACION_BLOQUE, 1, 1, 2)
    .setValues([['Duración de cada bloque de cancha (minutos)', 90]]);
  sheet
    .getRange(CONFIG_ROW_VENTANA_DETECCION, 1, 1, 2)
    .setValues([['Ventana para detectar un bloque recién terminado (minutos)', 30]]);
  sheet.getRange(CONFIG_ROW_PIN_ADMIN, 2, 1, 1).setNumberFormat('@'); // que "0000" no se guarde como número
  sheet
    .getRange(CONFIG_ROW_PIN_ADMIN, 1, 1, 2)
    .setValues([['PIN de administración (cambiar por uno propio, no compartir)', '0000']]);
  sheet
    .getRange(CONFIG_ROW_PESO_MARGEN, 1, 1, 2)
    .setValues([['Peso del margen del resultado (0 desactiva esto, ej. 0.3)', 0.3]]);
  sheet.autoResizeColumns(1, 3);
  sheet.setColumnWidth(1, 320);
}

function setupJugadores_(ss) {
  const sheet = ss.insertSheet(SHEET_JUGADORES);
  // El ID va primero y es la identidad real del jugador: el Historial
  // guarda IDs, no nombres. Ver Jugadores.js para el porqué.
  sheet
    .getRange('A1:E1')
    .setValues([['ID', 'Nombre completo', 'Categoría declarada', 'Puntaje inicial', 'Puntaje actual']])
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 5);
}

function setupRanking_(ss) {
  const sheet = ss.insertSheet(SHEET_RANKING);
  sheet
    .getRange('A1:E1')
    .setValues([['ID', 'Nombre completo', 'Categoría declarada', 'Puntaje actual', 'Puesto']])
    .setFontWeight('bold');
  // Ranking 100% derivado de Jugadores, ordenado de mayor a menor puntaje.
  // Nadie debe escribir a mano en esta pestaña.
  // select A,B,C,E = ID, Nombre, Categoría, Puntaje actual (se saltea el
  // Puntaje inicial); se ordena por la 4a columna del resultado.
  sheet
    .getRange('A2')
    .setFormula(
      '=IFERROR(SORT(QUERY(Jugadores!A2:E, "select A, B, C, E where A is not null", 0), 4, FALSE), "")'
    );
  sheet.getRange('E2').setFormula('=ARRAYFORMULA(IF(A2:A="","",ROW(A2:A)-1))');
  sheet.setFrozenRows(1);
}

function setupRegistros_(ss) {
  crearHojaRegistros_(ss);
}

function setupHistorial_(ss) {
  const sheet = ss.insertSheet(SHEET_HISTORIAL);
  sheet
    .getRange('A1:O1')
    .setValues([
      [
        'Timestamp registro',
        'Fecha del partido',
        'Cancha',
        'Hora fin',
        'Equipo A - Jugador 1',
        'Equipo A - Jugador 2',
        'Equipo B - Jugador 1',
        'Equipo B - Jugador 2',
        'Equipo ganador',
        'Resultado',
        'Delta Equipo A',
        'Delta Equipo B',
        'Registrado por',
        'Origen',
        'Motivo (solo administración)',
      ],
    ])
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 15);
  // Texto plano para que Sheets no autoconvierta "2026-07-12" / "19:30" a
  // un valor de fecha interno -- eso rompería la comparación exacta que
  // hace hayDuplicado_ en WebApp.js.
  sheet.getRange('B2:B').setNumberFormat('@');
  sheet.getRange('D2:D').setNumberFormat('@');
  // Columna de referencia para el humano: las E..H guardan IDs, que no
  // se leen a ojo. La fórmula la escribe submitResultado fila por fila
  // (no un ARRAYFORMULA sobre la columna entera, que inflaría
  // getLastRow y rompería appendRow).
  sheet.getRange(1, COL_HISTORIAL_NOMBRES).setValue('Jugadores (referencia)').setFontWeight('bold');
  sheet.setColumnWidth(COL_HISTORIAL_NOMBRES, 320);
}

/*
 * Acá vivía setupFormularioRegistro_, que creaba el Google Form de alta
 * de jugadores. Se eliminó: un Google Form no puede mirar la lista de
 * jugadores mientras la persona escribe, así que no había forma de
 * avisarle al segundo "Juan Pérez" que su nombre ya estaba tomado --
 * justo en el único momento en que él es la única persona capaz de
 * resolverlo. El alta ahora es la pantalla #registro de la app, que sí
 * puede (ver registrarJugador_ en Jugadores.js).
 *
 * Beneficio de arrastre: se cayó la necesidad de normalizar categorías
 * abreviadas ("4ta" -> "Cuarta"), porque la app ofrece exactamente los
 * nombres de la pestaña Categorías. normalizarNombreCategoria_ sigue en
 * Config.js por si quedan datos viejos, pero ya no la alimenta nadie.
 *
 * Si el formulario viejo todavía existe y alguien tiene el link, ver
 * cerrarFormularioViejo_ en Migracion.js.
 */
