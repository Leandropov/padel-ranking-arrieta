/**
 * Elo.js
 * Implementación de la fórmula tipo Elo para parejas de pádel.
 *
 * Calibración de K y D (ver también los valores en Categorías!B9:B10):
 * - K = ancho de una categoría / cantidad de partidos que querés que le
 *   tome a alguien mal anotado corregir su nivel (4 o 5 es razonable).
 *   Ej: categorías de ancho 10 y 5 partidos de referencia -> K = 2.
 * - D regula qué tan determinante es la diferencia de nivel en el
 *   resultado esperado. D más chico = la diferencia de nivel pesa más
 *   (el favorito "debería" ganar casi siempre). D más grande = los
 *   partidos se consideran más parejos aunque haya diferencia de puntaje.
 *   Un punto de partida razonable es D = 2x el ancho de categoría.
 * - "Peso del margen del resultado" (ver factorMargen_) es aparte de K y
 *   D: no toca el resultado esperado, amplifica el K de ESE partido si
 *   el marcador fue contundente. 0 lo desactiva.
 * - "Peso de confiabilidad" (ver factorConfiabilidad_) es otro ajuste
 *   más sobre K, independiente del margen: un debutante mueve más (para
 *   encontrar su nivel real rápido) y un partido entre puros veteranos
 *   mueve menos (para no dejar que un mal día puntual les arruine el
 *   puntaje). Usa la misma "Partidos de referencia" que ya calibrás a
 *   mano para K.
 */

/**
 * Probabilidad esperada de que la pareja A le gane a la pareja B.
 */
function resultadoEsperadoA_(promedioA, promedioB, D) {
  return 1 / (1 + Math.pow(10, (promedioB - promedioA) / D));
}

/**
 * Devuelve el delta de puntos para la pareja A (la pareja B recibe -delta,
 * porque el sistema es de suma cero: lo que gana un equipo lo pierde el otro).
 *
 * @param promedioA puntaje promedio de la pareja A antes del partido
 * @param promedioB puntaje promedio de la pareja B antes del partido
 * @param ganoA true si la pareja A ganó el partido
 * @param K máximo de puntos que puede mover un solo partido
 * @param D sensibilidad Elo
 */
function calcularDeltaA_(promedioA, promedioB, ganoA, K, D) {
  const esperadoA = resultadoEsperadoA_(promedioA, promedioB, D);
  const realA = ganoA ? 1 : 0;
  return K * (realA - esperadoA);
}

/**
 * Lee "resultado" set por set. Convención: en cada set van primero los
 * juegos del equipo GANADOR del partido, después los del perdedor (ej.
 * un partido ganado 6-4, 3-6, 6-2 se anota así aunque el set del medio
 * se haya perdido) -- así el orden nunca depende de quién ganó ESE set,
 * solo de quién ganó el partido completo. Ver el label del campo
 * "Resultado exacto" en ResultadoPage.jsx, que se lo aclara a quien
 * carga el partido.
 */
function leerSetsGanador_(resultado) {
  return String(resultado)
    .split(',')
    .map((set) => {
      const [ganador, perdedor] = set.trim().split('-').map(Number);
      return { ganador, perdedor };
    });
}

/**
 * Cuánto amplificar el K de un partido puntual según qué tan contundente
 * fue el resultado: un doble 6-0 mueve más puntos que un 7-6 en el
 * tercero, porque un marcador tan parejo o tan lopsided sugiere que la
 * diferencia de nivel real es distinta a la que muestran los puntajes
 * actuales. La proporción se calcula sobre el total de juegos jugados
 * (no sobre un máximo fijo de juegos por set) para no depender de si el
 * partido fue a 2 o 3 sets.
 *
 * Nunca reduce el K por debajo del valor base (mínimo factor = 1): un
 * partido muy parejo se queda en el K normal, no se penaliza -- de eso
 * ya se encarga D. Esto solo suma peso extra a los partidos contundentes.
 *
 * @param resultado string "6-4, 6-3" en la convención de leerSetsGanador_
 * @param pesoMargen cuánto puede llegar a amplificar un partido perfecto
 *   (proporción, ej. 0.3 = hasta 30% más K en el peor de los casos). 0 o
 *   vacío desactiva el ajuste por completo (factor siempre 1).
 */
function factorMargen_(resultado, pesoMargen) {
  if (!pesoMargen) return 1;
  const sets = leerSetsGanador_(resultado);
  if (sets.some((s) => !Number.isFinite(s.ganador) || !Number.isFinite(s.perdedor))) return 1;
  const totalJuegos = sets.reduce((acc, s) => acc + s.ganador + s.perdedor, 0);
  if (totalJuegos === 0) return 1;
  const diferencia = sets.reduce((acc, s) => acc + (s.ganador - s.perdedor), 0);
  const proporcion = Math.max(0, diferencia / totalJuegos); // 0 = parejo, 1 = arrasada
  return 1 + pesoMargen * proporcion;
}

/**
 * Cuánto ajustar el K de un partido según qué tan establecido está el
 * jugador MENOS establecido de los 4 (el mínimo de partidos jugados
 * manda, no el promedio): si hay un debutante en el partido, ese
 * partido mueve más -- aunque los otros 3 sean veteranos -- porque
 * encontrarle el nivel real a él pesa más que proteger a los demás de
 * un resultado ruidoso. Un partido entre puros veteranos mueve menos,
 * para no dejar que un mal día puntual les arruine el puntaje ya
 * asentado.
 *
 * Reutiliza la misma "Partidos de referencia" que ya usás a mano para
 * calibrar K (Categorías): el ajuste llega a exactamente 1 (sin cambio)
 * justo en esa cantidad de partidos, sube hasta el techo en el debut
 * (0 partidos) y baja hasta el piso al doble de esa cantidad -- de ahí
 * en adelante se queda plano, no sigue bajando indefinidamente.
 *
 * @param partidosJugados array con los partidos previos (antes de
 *   este) de los 4 jugadores del partido
 * @param partidosReferencia el mismo valor que ya calibrás a mano
 *   (Categorías, fila "Partidos de referencia...")
 * @param pesoConfiabilidad cuánto puede llegar a mover en cada
 *   dirección (proporción, ej. 0.3 = hasta 30% más en el debut, hasta
 *   30% menos entre veteranos). 0, vacío, o partidosReferencia en 0
 *   desactiva el ajuste (factor siempre 1).
 */
function factorConfiabilidad_(partidosJugados, partidosReferencia, pesoConfiabilidad) {
  if (!pesoConfiabilidad || !partidosReferencia) return 1;
  const minimo = Math.min(...partidosJugados);
  const proporcion = (partidosReferencia - minimo) / partidosReferencia; // 1 en el debut, 0 en partidosReferencia, -1 al doble
  const acotada = Math.max(-1, Math.min(1, proporcion));
  return 1 + pesoConfiabilidad * acotada;
}
