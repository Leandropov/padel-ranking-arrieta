/**
 * Ranking.js
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
  const rangos = getCategoryRanges_();

  const jugadores = filas
    .filter((row) => row[0])
    .map((row) => {
      const [nombre, , puntajeRaw, puesto] = row;
      const puntaje = Number(puntajeRaw);
      const ultimo = ultimoPorJugador[nombre] || null;
      return {
        puesto: Number(puesto),
        nombre: String(nombre),
        // La categoría se recalcula por puntaje actual, no por la que se
        // declaró al registrarse (columna B de Jugadores) -- así alguien
        // que subió o bajó de rango aparece solo en la pestaña que le
        // corresponde hoy, sin que nadie tenga que reasignarla a mano.
        categoria: categoriaPorPuntaje_(puntaje, rangos),
        puntaje: puntaje,
        deltaUltimoPartido: ultimo ? Math.round(ultimo.delta * 10) / 10 : null,
        fechaUltimoPartido: ultimo ? ultimo.fecha : null,
      };
    });

  // El orden de las categorías sale de la pestaña Categorías (de menor a
  // mayor rango de puntos), no de en qué orden aparecen en el ranking --
  // así el frontend arma los tabs en el orden esperado aunque alguna
  // categoría todavía no tenga jugadores.
  const categorias = rangos.map((c) => c.nombre);

  return { jugadores: jugadores, categorias: categorias, actualizado: hoyISO_() };
}

/**
 * A qué categoría corresponde un puntaje, según los rangos de la
 * pestaña Categorías. Si el puntaje quedó fuera de todos los rangos
 * definidos (por ejemplo, alguien superó el techo de la categoría más
 * alta y el club no cargó una superior), se lo deja en el extremo más
 * cercano en vez de romper -- nunca debería faltarle categoría a nadie.
 */
function categoriaPorPuntaje_(puntaje, rangos) {
  const enRango = rangos.find((r) => puntaje >= r.min && puntaje <= r.max);
  if (enRango) return enRango.nombre;
  const ordenados = [...rangos].sort((a, b) => a.min - b.min);
  return puntaje < ordenados[0].min ? ordenados[0].nombre : ordenados[ordenados.length - 1].nombre;
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
