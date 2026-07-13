/**
 * Ranking.gs
 * Backend de la página de ranking (solo lectura). getRanking() arma la
 * lista ya ordenada (leyendo directamente la pestaña Ranking, que son
 * fórmulas sobre Jugadores) y le agrega, por jugador, el delta de su
 * último partido jugado -- para mostrar la flechita de tendencia sin
 * que el cliente tenga que descargar todo el Historial.
 */

function getRanking() {
  const ss = getSpreadsheet_();
  const rankingSheet = ss.getSheetByName(SHEET_RANKING);
  const historialSheet = ss.getSheetByName(SHEET_HISTORIAL);

  const lastRow = rankingSheet.getLastRow();
  const filas = lastRow >= 2 ? rankingSheet.getRange(2, 1, lastRow - 1, 4).getValues() : [];
  const ultimoPorJugador = ultimoPartidoPorJugador_(historialSheet);

  const jugadores = filas
    .filter((row) => row[0])
    .map((row) => {
      const [nombre, categoria, puntaje, puesto] = row;
      const ultimo = ultimoPorJugador[nombre] || null;
      return {
        puesto: Number(puesto),
        nombre: String(nombre),
        categoria: String(categoria),
        puntaje: Number(puntaje),
        deltaUltimoPartido: ultimo ? Math.round(ultimo.delta * 10) / 10 : null,
        fechaUltimoPartido: ultimo ? ultimo.fecha : null,
      };
    });

  return { jugadores: jugadores, actualizado: hoyISO_() };
}

/**
 * Para cada jugador que aparece en Historial, se queda con el delta del
 * partido más reciente (por fecha del partido + hora fin, no por cuándo
 * se cargó el resultado -- una carga por administración de un partido
 * viejo no debe pisar la tendencia de un partido más nuevo real).
 */
function ultimoPartidoPorJugador_(historialSheet) {
  const lastRow = historialSheet.getLastRow();
  if (lastRow < 2) return {};

  // Columnas B..L: Fecha, Cancha, Hora, EquipoA1, EquipoA2, EquipoB1, EquipoB2, Ganador, Resultado, DeltaA, DeltaB
  const values = historialSheet.getRange(2, 2, lastRow - 1, 11).getValues();
  const mapa = {};

  values.forEach((row) => {
    const fechaRaw = row[0];
    const fecha =
      fechaRaw instanceof Date ? Utilities.formatDate(fechaRaw, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(fechaRaw);
    const hora = String(row[2]);
    const clave = fecha + ' ' + hora; // "yyyy-MM-dd HH:MM" ordena bien como texto
    const deltaA = Number(row[9]);
    const deltaB = Number(row[10]);

    [row[3], row[4]].forEach((nombre) => registrarSiMasReciente_(mapa, nombre, clave, fecha, deltaA));
    [row[5], row[6]].forEach((nombre) => registrarSiMasReciente_(mapa, nombre, clave, fecha, deltaB));
  });

  return mapa;
}

function registrarSiMasReciente_(mapa, nombre, clave, fecha, delta) {
  if (!nombre) return;
  const actual = mapa[nombre];
  if (!actual || clave > actual.clave) {
    mapa[nombre] = { clave: clave, fecha: fecha, delta: delta };
  }
}
