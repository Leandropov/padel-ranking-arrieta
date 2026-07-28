/**
 * Jugadores.js
 * Identidad de los jugadores. Cada persona tiene un ID propio (J001,
 * J002, ...) y ese ID es lo ÚNICO que el sistema usa para identificarla:
 * el Historial guarda IDs en las columnas de jugadores, y el puntaje se
 * acumula por ID.
 *
 * Por qué existe esto: antes el nombre escrito era la clave. Dos
 * personas con el mismo nombre compartían una sola identidad -- los
 * SUMIF del puntaje le sumaban a las dos filas los partidos de ambas, y
 * leerJugadores_ se quedaba con una sola de las dos al calcular el Elo,
 * así que los deltas salían mal también para sus rivales. Con el ID,
 * dos nombres iguales son dos jugadores distintos y nada se mezcla.
 *
 * Efecto secundario buscado: como el nombre ya no identifica a nadie, se
 * puede corregir (un typo, un apodo) sin romperle el historial a la
 * persona -- la columna de nombres del Historial es una fórmula que mira
 * a Jugadores por ID, así que se actualiza sola.
 *
 * Layout de la pestaña Jugadores:
 *   A=ID  B=Nombre completo  C=Categoría declarada
 *   D=Puntaje inicial  E=Puntaje actual (fórmula)
 */

const PREFIJO_ID_JUGADOR = 'J';

/**
 * Clave de comparación de nombres: sin acentos, sin mayúsculas, sin
 * espacios de más. "Juan Pérez", "juan perez" y "Juan  Perez" son el
 * mismo nombre a los efectos de detectar un repetido -- si no, alguien
 * se registraría de nuevo con una variante y volveríamos a tener dos
 * personas que el club no puede distinguir en pantalla.
 *
 * Ojo: los SUMIF de Sheets tampoco distinguen mayúsculas, así que esta
 * normalización es además la que evita que dos variantes se sumen entre
 * sí en las fórmulas de puntaje.
 */
function normalizarNombre_(texto) {
  return String(texto || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    // Los acentos, escritos como escape y no como caracteres literales:
    // son marcas combinantes, invisibles en el fuente y fáciles de
    // romper con un copy-paste.
    .replace(/[\u0300-\u036f]/g, '');
}

/** Espacios de más colapsados, pero respetando mayúsculas y acentos. */
function limpiarNombre_(texto) {
  return String(texto || '').trim().replace(/\s+/g, ' ');
}

/**
 * Todos los jugadores como lista de {id, nombre, categoria, puntaje},
 * en el orden en que están en la planilla. Una sola lectura agrupada.
 */
function leerJugadores_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet
    .getRange(2, 1, lastRow - 1, 5)
    .getValues()
    .filter((row) => row[0] && row[1])
    .map(([id, nombre, categoria, , puntaje]) => ({
      id: String(id).trim(),
      nombre: String(nombre).trim(),
      categoria: String(categoria).trim(),
      puntaje: Number(puntaje),
    }));
}

/** Los mismos jugadores indexados por ID, para buscar en O(1). */
function leerJugadoresPorId_(sheet) {
  const mapa = {};
  leerJugadores_(sheet).forEach((j) => {
    mapa[j.id] = j;
  });
  return mapa;
}

/**
 * Etiqueta con la que se muestra a cada jugador en la app. Normalmente
 * es su nombre a secas; si DOS jugadores comparten nombre exacto se les
 * agrega la categoría, para que nunca haya dos opciones idénticas en un
 * desplegable ni dos filas idénticas en el ranking.
 *
 * Es una red de seguridad: registrarJugador_ ya rechaza los nombres
 * repetidos, así que esto solo se activa si alguien agregó una fila a
 * mano en la planilla salteándose la app.
 */
function agregarEtiquetas_(jugadores) {
  const cuentaPorNombre = {};
  jugadores.forEach((j) => {
    const clave = normalizarNombre_(j.nombre);
    cuentaPorNombre[clave] = (cuentaPorNombre[clave] || 0) + 1;
  });
  return jugadores.map((j) => {
    const repetido = cuentaPorNombre[normalizarNombre_(j.nombre)] > 1;
    return Object.assign({}, j, {
      etiqueta: repetido && j.categoria ? j.nombre + ' · ' + j.categoria : j.nombre,
      nombreRepetido: repetido,
    });
  });
}

/**
 * Siguiente ID libre. Se calcula a partir del mayor número ya usado (no
 * de la cantidad de filas): si alguna vez se borra un jugador, el ID no
 * se reutiliza y no se le puede adjudicar a otra persona el historial
 * del anterior.
 */
function siguienteIdJugador_(jugadores) {
  const maximo = jugadores.reduce((max, j) => {
    const n = Number(String(j.id).replace(/^\D+/, ''));
    return isNaN(n) ? max : Math.max(max, n);
  }, 0);
  const numero = maximo + 1;
  return PREFIJO_ID_JUGADOR + ('000' + numero).slice(-3);
}

/**
 * Fórmula del puntaje actual de la fila `fila`: el puntaje inicial más
 * todos los deltas del Historial donde ese ID aparece. Las columnas
 * E..H del Historial son los 4 jugadores (A1, A2, B1, B2) y K/L los
 * deltas de cada equipo.
 */
function formulaPuntajeActual_(fila) {
  return (
    '=D' + fila +
    ' + SUMIF(Historial!E:E,$A' + fila + ',Historial!K:K)' +
    ' + SUMIF(Historial!F:F,$A' + fila + ',Historial!K:K)' +
    ' + SUMIF(Historial!G:G,$A' + fila + ',Historial!L:L)' +
    ' + SUMIF(Historial!H:H,$A' + fila + ',Historial!L:L)'
  );
}

/**
 * Fórmula de la columna de referencia del Historial: traduce los IDs de
 * los 4 jugadores (columnas E..H) a nombres legibles, para que quien
 * abra la planilla no vea "J007 + J002 vs J011 + J004".
 *
 * Si un ID no está en Jugadores (jugador borrado a mano) se muestra el
 * ID crudo en vez de romper la fila con un #N/A.
 */
function formulaNombresHistorial_(fila) {
  const nombreDe = (col) =>
    'IFERROR(VLOOKUP(' + col + fila + ',Jugadores!$A:$B,2,FALSE),' + col + fila + ')';
  return (
    '=' + nombreDe('E') + ' & " + " & ' + nombreDe('F') +
    ' & "  vs  " & ' + nombreDe('G') + ' & " + " & ' + nombreDe('H')
  );
}

/** Escribe (o reescribe) la fila de un jugador con su fórmula de puntaje. */
function escribirFilaJugador_(sheet, fila, jugador) {
  sheet
    .getRange(fila, 1, 1, 4)
    .setValues([[jugador.id, jugador.nombre, jugador.categoria, jugador.puntajeInicial]]);
  sheet.getRange(fila, 5).setFormula(formulaPuntajeActual_(fila));
}

/**
 * Alta de un jugador. Es la única puerta de entrada al ranking: la
 * pantalla de registro de la app la llama por doPost, y el trigger del
 * formulario viejo (si alguien todavía lo usa) también.
 *
 * Rechaza los nombres repetidos en vez de aceptarlos y desambiguar
 * después. El registro es el único momento en que está presente la
 * única persona que sabe que hay dos Juan Pérez distintos -- el segundo
 * Juan. Si lo dejáramos pasar, nadie más podría resolverlo: ni el que
 * carga el resultado (ve dos opciones iguales) ni el admin (no sabe
 * cuál es cuál).
 */
function registrarJugador_(payload) {
  const nombre = limpiarNombre_(payload && payload.nombre);
  const categoriaRaw = String((payload && payload.categoria) || '').trim();

  if (nombre.length < 3) {
    throw errorConCodigo_('NOMBRE_CORTO', 'Escribí tu nombre y apellido para entrar al ranking.');
  }
  if (nombre.length > 60) {
    throw errorConCodigo_('NOMBRE_LARGO', 'El nombre es demasiado largo (máximo 60 caracteres).');
  }
  if (!categoriaRaw) {
    throw errorConCodigo_('FALTA_CATEGORIA', 'Elegí la categoría que considerás tener.');
  }
  // Tira si la categoría no existe en la pestaña Categorías.
  const rango = getCategoryRange_(categoriaRaw);

  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_JUGADORES);

  // Lock: sin esto, dos personas registrándose al mismo tiempo pueden
  // leer la misma lista (y el mismo getLastRow) antes de que cualquiera
  // escriba -- la segunda pisaría la fila de la primera, y además dos
  // nombres repetidos podrían colarse esquivando el chequeo de abajo.
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const existentes = leerJugadores_(sheet);
    const clave = normalizarNombre_(nombre);
    const choque = existentes.find((j) => normalizarNombre_(j.nombre) === clave);

    if (choque) {
      registrarEnLog_(ss, nombre, categoriaRaw, 'Rechazado: ya existe ' + choque.id, '');
      avisarNombreRepetido_(nombre, choque);
      throw errorConCodigo_(
        'NOMBRE_DUPLICADO',
        'Ya hay un jugador registrado como "' + choque.nombre + '". ' +
          'Si sos vos, ya estás en el ranking y no hace falta registrarse de nuevo. ' +
          'Si sos otra persona con el mismo nombre, agregá algo que te distinga ' +
          '(la inicial de tu apellido, un apodo) y probá de nuevo.'
      );
    }

    const id = siguienteIdJugador_(existentes);
    const puntajeInicial = Math.round((rango.min + rango.max) / 2);
    // rango.nombre y no el texto crudo: en Jugadores la categoría tiene
    // que quedar exactamente como figura en Categorías, que es contra lo
    // que la página de ranking arma sus tabs.
    escribirFilaJugador_(sheet, sheet.getLastRow() + 1, {
      id: id,
      nombre: nombre,
      categoria: rango.nombre,
      puntajeInicial: puntajeInicial,
    });

    registrarEnLog_(ss, nombre, categoriaRaw, 'OK', id);

    return { id: id, nombre: nombre, categoria: rango.nombre, puntaje: puntajeInicial };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Bitácora append-only de TODO intento de registro, aceptado o no.
 *
 * Reemplaza el respaldo que daba la pestaña de respuestas del Google
 * Form: una lista cruda que no depende de que el resto del código
 * funcione. Ya hizo falta una vez (ver RecuperarRegistros.js, que
 * rescató altas que nunca llegaron a Jugadores), así que al sacar el
 * formulario había que reponer la red.
 */
function registrarEnLog_(ss, nombre, categoria, resultado, id) {
  try {
    let sheet = ss.getSheetByName(SHEET_REGISTROS);
    if (!sheet) sheet = crearHojaRegistros_(ss);
    sheet.appendRow([new Date(), nombre, categoria, resultado, id || '']);
  } catch (err) {
    // Nunca tumbar un alta válida porque falló la bitácora.
    Logger.log('No se pudo escribir en ' + SHEET_REGISTROS + ': ' + err.message);
  }
}

function crearHojaRegistros_(ss) {
  const sheet = ss.insertSheet(SHEET_REGISTROS);
  sheet
    .getRange('A1:E1')
    .setValues([['Timestamp', 'Nombre enviado', 'Categoría enviada', 'Resultado', 'ID asignado']])
    .setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(4, 220);
  return sheet;
}

/**
 * Avisa al dueño de la planilla que alguien quiso registrarse con un
 * nombre que ya existe. Puede ser la misma persona registrándose dos
 * veces (inofensivo) o dos personas distintas -- el club es el único
 * que puede saber cuál de las dos, y solo se entera si se le avisa.
 *
 * Si el mail falla (cuota, permiso no otorgado todavía) no pasa nada:
 * el rechazo del registro ya ocurrió y queda en la bitácora.
 */
function avisarNombreRepetido_(nombreIntentado, existente) {
  try {
    const destino = Session.getEffectiveUser().getEmail();
    if (!destino) return;
    MailApp.sendEmail(
      destino,
      'Ranking del club: intento de registro con un nombre que ya existe',
      'Alguien intentó registrarse como "' + nombreIntentado + '".\n\n' +
        'Ya hay un jugador con ese nombre: ' + existente.nombre + ' (' + existente.id + ', ' +
        existente.categoria + ').\n\n' +
        'El registro fue rechazado y se le pidió que agregue algo que lo distinga.\n\n' +
        'Si son dos personas distintas y la segunda no vuelve a intentar, podés darla de alta ' +
        'vos desde la pestaña Jugadores (poniéndole un ID nuevo) o pedirle que se registre con ' +
        'un nombre distinguible.\n\n' +
        'Queda registrado en la pestaña "' + SHEET_REGISTROS + '" de la planilla.'
    );
  } catch (err) {
    Logger.log('No se pudo enviar el aviso de nombre repetido: ' + err.message);
  }
}
