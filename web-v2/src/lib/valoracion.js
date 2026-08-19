/**
 * Reglas de la valoración entre jugadores, sin JSX.
 *
 * Al terminar un partido, los cuatro reparten 6 puntos cada uno entre
 * los dos rivales. Esos puntos NO suman al ranking: deciden cómo se
 * reparte, entre los dos compañeros, lo que el partido ya le dio a esa
 * pareja. Por eso se valora a los rivales y nunca al compañero -- opinar
 * sobre el reparto de tu propia pareja sería opinar sobre tu puntaje.
 *
 * Votan los DOS rivales y no uno solo: con un único votante, esa persona
 * decidía sola el reparto de sus rivales y podía castigar a uno sin que
 * nadie lo diluyera. Con dos votos independientes, un rencor pesa la
 * mitad.
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
 * Arma el objeto que espera el backend a partir de los votos emitidos.
 *
 * `votosA` son los repartos que los rivales hicieron sobre la pareja A:
 * cada número es lo que ese votante le dio al PRIMER jugador de A, y el
 * resto de sus 6 puntos fue al segundo. Puede haber 0, 1 o 2 votos --
 * cada quien puede saltarse su turno.
 *
 * El backend sólo mira la proporción entre los dos compañeros, así que
 * que voten uno o dos no cambia la escala: cambia cuánto pesa cada
 * opinión suelta.
 */
export function armarValoraciones(votosA, votosB) {
  const sumar = (votos) => {
    const alPrimero = votos.reduce((total, v) => total + v, 0);
    return [alPrimero, PUNTOS_VALORACION * votos.length - alPrimero];
  };
  const [a1, a2] = sumar(votosA || []);
  const [b1, b2] = sumar(votosB || []);
  return { a1, a2, b1, b2 };
}
