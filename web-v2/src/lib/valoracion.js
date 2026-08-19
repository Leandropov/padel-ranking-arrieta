/**
 * Reglas de la valoración entre jugadores, sin JSX.
 *
 * Al terminar un partido, una persona de cada pareja reparte 6 puntos
 * entre los dos rivales. Esos puntos NO suman al ranking: deciden cómo
 * se reparte, entre los dos compañeros, lo que el partido ya le dio a esa
 * pareja. Por eso se valora a los rivales y nunca al compañero -- opinar
 * sobre el reparto de tu propia pareja sería opinar sobre tu puntaje.
 *
 * El cálculo del reparto vive en el backend (repartoPorValoracion_ en
 * Elo.js); acá solo está lo que hace falta para la pantalla.
 */

export const PUNTOS_VALORACION = 6;

/** El reparto parejo, que es con el que arranca el control. */
export const REPARTO_PAREJO = PUNTOS_VALORACION / 2;

/**
 * Qué significa, en palabras, darle `puntos` al primero de los dos. Es lo
 * que se lee bajo el control mientras se arrastra: sin esto el jugador ve
 * dos números y tiene que deducir la escala solo.
 */
export function fraseDelReparto(puntos, nombreUno, nombreOtro) {
  const diferencia = puntos - REPARTO_PAREJO;
  if (diferencia === 0) return 'Jugaron parejo';

  const mejor = diferencia > 0 ? nombreUno : nombreOtro;
  const cuanto = Math.abs(diferencia);
  if (cuanto === 1) return mejor + ' jugó un poco mejor';
  if (cuanto === 2) return mejor + ' jugó bastante mejor';
  return mejor + ' jugó muchísimo mejor';
}

/**
 * Arma el objeto que espera el backend a partir de los dos repartos.
 * `puntosA` son los que recibió el primer jugador del equipo A (el resto
 * va al segundo), y lo mismo con `puntosB`. Un `null` significa que esa
 * pareja no se valoró: se manda 0 y 0, y el backend la reparte mitad y
 * mitad.
 */
export function armarValoraciones(puntosA, puntosB) {
  const par = (p) => (p === null || p === undefined ? [0, 0] : [p, PUNTOS_VALORACION - p]);
  const [a1, a2] = par(puntosA);
  const [b1, b2] = par(puntosB);
  return { a1, a2, b1, b2 };
}
