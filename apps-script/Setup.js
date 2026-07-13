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

  // La hoja "Hoja 1" que Sheets crea por defecto ya no hace falta.
  const hojaDefault = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (hojaDefault) ss.deleteSheet(hojaDefault);

  const formUrl = setupFormularioRegistro_(ss);

  Logger.log('Planilla creada: ' + ss.getUrl());
  Logger.log('Formulario de registro: ' + formUrl);
  Logger.log(
    'Guardá estos dos links. El de la planilla es para el administrador, ' +
      'el del formulario es para compartir con los jugadores nuevos.'
  );
  Logger.log(
    'Paso pendiente manual: publicar la web app de resultado ' +
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
  sheet.autoResizeColumns(1, 3);
  sheet.setColumnWidth(1, 320);
}

function setupJugadores_(ss) {
  const sheet = ss.insertSheet(SHEET_JUGADORES);
  sheet
    .getRange('A1:D1')
    .setValues([['Nombre completo', 'Categoría declarada', 'Puntaje inicial', 'Puntaje actual']])
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 4);
}

function setupRanking_(ss) {
  const sheet = ss.insertSheet(SHEET_RANKING);
  sheet
    .getRange('A1:D1')
    .setValues([['Nombre completo', 'Categoría declarada', 'Puntaje actual', 'Puesto']])
    .setFontWeight('bold');
  // Ranking 100% derivado de Jugadores, ordenado de mayor a menor puntaje.
  // Nadie debe escribir a mano en esta pestaña.
  sheet
    .getRange('A2')
    .setFormula(
      '=IFERROR(SORT(QUERY(Jugadores!A2:D, "select A, B, D where A is not null", 0), 3, FALSE), "")'
    );
  sheet.getRange('D2').setFormula('=ARRAYFORMULA(IF(A2:A="","",ROW(A2:A)-1))');
  sheet.setFrozenRows(1);
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
}

/**
 * Formulario de registro de jugador (una sola vez por persona).
 * Este SÍ es un Google Form nativo -- no necesita pantalla de confirmación
 * especial, y así el club lo puede administrar fácil desde Forms.
 */
function setupFormularioRegistro_(ss) {
  const form = FormApp.create('Registro de Jugador - Club de Pádel');
  form.setDescription(
    'Completá esto una sola vez para entrar al ranking. Tu puntaje inicial ' +
      'se calcula automáticamente según la categoría que elijas.'
  );

  form
    .addTextItem()
    .setTitle('Nombre completo (agrega algo que te distinga: apellido materno, apodo, o número de jugador)')
    .setRequired(true);

  const categorias = getCategoryRanges_(); // ya está seteado SPREADSHEET_ID en script properties
  form
    .addListItem()
    .setTitle('¿Qué categoría consideras tener?')
    .setChoiceValues(categorias.map((c) => c.nombre))
    .setRequired(true);

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  ScriptApp.newTrigger('onRegistroFormSubmit')
    .forForm(form)
    .onFormSubmit()
    .create();

  return form.getPublishedUrl();
}
