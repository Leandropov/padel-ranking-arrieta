/**
 * Elo.gs
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
