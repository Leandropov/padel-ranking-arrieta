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
  // La pestaña Ranking son fórmulas sobre Jugadores A:E y no arrastra la
  // columna F, así que la categoría vigente se lee de Jugadores. Se
  // prefiere esto a tocar la fórmula QUERY de la pestaña Ranking, que es
  // frágil (el SORT apunta a una columna por número).
  const vigentePorId = {};
  leerJugadores_(ss.getSheetByName(SHEET_JUGADORES)).forEach((j) => {
    vigentePorId[j.id] = j.categoriaVigente;
  });
  const margenCategoria = getConfig_().margenCategoria;

  // Ranking: A=ID, B=Nombre, C=Categoría declarada, D=Puntaje actual, E=Puesto.
  const lastRow = rankingSheet.getLastRow();
  const filas = lastRow >= 2 ? rankingSheet.getRange(2, 1, lastRow - 1, 5).getValues() : [];
  const ultimoPorJugador = ultimoPartidoPorJugador_(historialSheet);
  const rangos = getCategoryRanges_();

  const base = filas
    .filter((row) => row[0] && row[1])
    .map((row) => {
      const [id, nombre, , puntajeRaw, puesto] = row;
      const puntaje = Number(puntajeRaw);
      const ultimo = ultimoPorJugador[String(id).trim()] || null;
      return {
        puesto: Number(puesto),
        id: String(id).trim(),
        nombre: String(nombre).trim(),
        // La categoría no sale de la que se declaró al registrarse
        // (columna C) sino del puntaje de hoy, así alguien que subió o
        // bajó aparece solo en la pestaña que le corresponde, sin que
        // nadie lo reasigne a mano. La guardada es el punto de partida
        // de la histéresis; si falta (jugador anterior a la columna F),
        // se cae al cálculo de siempre. Se aplica la misma función que
        // al guardar un partido, así lo que se muestra y lo que se
        // persiste no pueden discrepar.
        categoria: categoriaConHisteresis_(
          puntaje,
          vigentePorId[String(id).trim()] || categoriaPorPuntaje_(puntaje, rangos),
          rangos,
          margenCategoria
        ),
        puntaje: puntaje,
        deltaUltimoPartido: ultimo ? Math.round(ultimo.delta * 10) / 10 : null,
        fechaUltimoPartido: ultimo ? ultimo.fecha : null,
      };
    });

  // La etiqueta desambigua con la categoría si dos jugadores comparten
  // nombre exacto, para que la tabla nunca muestre dos filas idénticas.
  const jugadores = agregarEtiquetas_(base);

  // El orden de las categorías sale de la pestaña Categorías (de menor a
  // mayor rango de puntos), no de en qué orden aparecen en el ranking --
  // así el frontend arma los tabs en el orden esperado aunque alguna
  // categoría todavía no tenga jugadores.
  const categorias = rangos.map((c) => c.nombre);

  return { jugadores: jugadores, categorias: categorias, actualizado: hoyISO_() };
}

// El ranking de un club cambia poco: solo cuando alguien carga un
// resultado o se registra un jugador, y esos dos caminos borran el cache
// explícitamente. Los 60 segundos son la red de seguridad para el caso
// en que la planilla se edite por fuera de la app (a mano, por ejemplo).
const CACHE_RANKING_CLAVE = 'ranking_v1';
const CACHE_RANKING_SEGUNDOS = 60;

/**
 * getRanking() lee las hojas Ranking, Historial y Categorías enteras y
 * tarda 2-3 segundos. Sin cache, cada jugador que abre la pantalla
 * dispara esa lectura completa; y como la web app corre con la cuenta
 * que la desplegó (executeAs USER_DEPLOYING en appsscript.json), todo el
 * club consume la misma bolsa de cuota. Con varios abriendo el ranking a
 * la vez --lo normal cuando termina una ronda-- eso es un pico de
 * lecturas idénticas que devuelven exactamente lo mismo.
 */
function getRankingCacheado_() {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get(CACHE_RANKING_CLAVE);
  if (guardado) {
    try {
      return JSON.parse(guardado);
    } catch (err) {
      // Si lo guardado quedó ilegible se ignora y se recalcula: un
      // problema del cache no puede hacer fallar el pedido.
    }
  }

  const ranking = getRanking();
  const serializado = JSON.stringify(ranking);
  // CacheService rechaza valores de más de 100 KB. Con 16 jugadores esto
  // pesa unos 3,5 KB, pero si el club creciera mucho conviene dejar de
  // cachear antes que hacer fallar la respuesta.
  if (serializado.length < 90000) {
    cache.put(CACHE_RANKING_CLAVE, serializado, CACHE_RANKING_SEGUNDOS);
  }
  return ranking;
}

/**
 * Hay que llamarla después de cada escritura que mueve el ranking. Sin
 * esto, quien carga su resultado y toca "Ver ranking" podría ver hasta
 * un minuto los puntajes viejos -- justo en el momento en que más le
 * importa verlos actualizados.
 *
 * Ojo con el orden: el ranking se deriva por fórmulas (Historial ->
 * Jugadores!E -> Ranking), así que primero hay que forzar que la
 * escritura se aplique con SpreadsheetApp.flush() y recién después
 * borrar el cache. Al revés, el próximo lector puede alcanzar a guardar
 * los valores viejos por otro minuto.
 */
function invalidarCacheRanking_() {
  CacheService.getScriptCache().remove(CACHE_RANKING_CLAVE);
}

/**
 * A qué categoría corresponde un puntaje, según los rangos de la
 * pestaña Categorías.
 *
 * Clasifica por el PISO de cada rango, nunca por el par piso/techo. El
 * club escribe los rangos como "0 a 10", "11 a 20", "21 a 30"..., así
 * que entre el techo de uno y el piso del siguiente queda un hueco de
 * un punto. Los puntajes, en cambio, son decimales -- salen de sumar
 * deltas --, de modo que caer adentro de un hueco no es un caso raro de
 * borde: con las categorías cada 10 puntos le toca a cerca de uno de
 * cada diez jugadores. Buscando por piso, "hasta 30" y "desde 31"
 * describen el mismo corte y no queda agujero posible.
 *
 * Antes se buscaba el rango con min <= puntaje <= max y, al no
 * encontrarlo, un fallback mandaba al jugador a la categoría MÁS ALTA
 * (estaba pensado para quien superara el techo de la última). En
 * producción eso puso en Segunda a un jugador de 30,362 puntos, por
 * encima de otro de 33,787 que sí figuraba en Tercera.
 *
 * El techo de cada rango (columna C) sigue haciendo falta para otra
 * cosa: Jugadores.js calcula con él el puntaje inicial de quien se
 * registra, que es el medio del rango que declaró.
 */
function categoriaPorPuntaje_(puntaje, rangos) {
  const ordenados = [...rangos].sort((a, b) => a.min - b.min);
  // Por debajo del piso más bajo se queda en la categoría más baja:
  // nunca debería faltarle categoría a nadie.
  let elegida = ordenados[0];
  for (const rango of ordenados) {
    if (puntaje >= rango.min) elegida = rango;
  }
  return elegida.nombre;
}

/**
 * La categoría de alguien teniendo en cuenta en cuál estaba antes.
 *
 * Sin esto, la categoría es una función del puntaje y nada más, así que
 * quien queda parado justo sobre una frontera rebota entre dos
 * categorías partido por medio: pierde y baja, gana y sube, y cada
 * cambio le llega como la noticia de que subió o bajó de nivel. Con el
 * margen puesto, la frontera deja de ser una raya y pasa a ser una
 * banda: para subir hay que superar el piso de la categoría de arriba
 * POR el margen, y para bajar hay que quedar debajo del piso propio por
 * el mismo margen. Adentro de la banda no pasa nada.
 *
 * Esto es lo que hace que la categoría necesite memoria (columna F de
 * Jugadores): con el mismo puntaje, quien venía de arriba y quien venía
 * de abajo pueden quedar en categorías distintas, y eso es lo correcto
 * -- es justamente lo que evita el rebote.
 *
 * Con margen 0, vacío, o sin categoría anterior conocida, se comporta
 * exactamente como categoriaPorPuntaje_.
 *
 * @param margen en puntos, leído de la pestaña Categorías
 */
function categoriaConHisteresis_(puntaje, categoriaAnterior, rangos, margen) {
  if (!margen || margen <= 0) return categoriaPorPuntaje_(puntaje, rangos);
  const ordenados = [...rangos].sort((a, b) => a.min - b.min);
  const buscada = normalizarNombreCategoria_(categoriaAnterior);
  let i = ordenados.findIndex((r) => normalizarNombreCategoria_(r.nombre) === buscada);
  if (i === -1) return categoriaPorPuntaje_(puntaje, rangos);
  // Los while (y no un if) son para el caso raro de un salto de más de
  // una categoría: pasa si el admin corrige el Historial a mano y el
  // puntaje se mueve mucho de golpe.
  while (i < ordenados.length - 1 && puntaje >= ordenados[i + 1].min + margen) i++;
  while (i > 0 && puntaje < ordenados[i].min - margen) i--;
  return ordenados[i].nombre;
}

/**
 * Para cada jugador que aparece en Historial, se queda con el delta del
 * partido más reciente (por fecha del partido + hora fin, no por cuándo
 * se cargó el resultado -- una carga por administración de un partido
 * viejo no debe pisar la tendencia de un partido más nuevo real).
 *
 * El mapa está indexado por ID de jugador, no por nombre: si dos
 * personas se llamaran igual, un mapa por nombre les mostraría a las
 * dos la flecha del partido de una sola.
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

    [row[3], row[4]].forEach((id) => registrarSiMasReciente_(mapa, id, clave, fecha, deltaA));
    [row[5], row[6]].forEach((id) => registrarSiMasReciente_(mapa, id, clave, fecha, deltaB));
  });

  return mapa;
}

function registrarSiMasReciente_(mapa, idRaw, clave, fecha, delta) {
  // trim(): el ID viene de una celda y getRanking lo busca ya recortado.
  // Un espacio de más en la planilla dejaría la flecha de tendencia en
  // blanco sin ningún error visible.
  const id = String(idRaw || '').trim();
  if (!id) return;
  const actual = mapa[id];
  if (!actual || clave > actual.clave) {
    mapa[id] = { clave: clave, fecha: fecha, delta: delta };
  }
}
