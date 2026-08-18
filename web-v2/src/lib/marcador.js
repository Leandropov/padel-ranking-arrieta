/**
 * Reglas del marcador: cuántos sets están en juego, quién ganó y cómo
 * se serializa para el backend. Sin JSX a propósito -- `factorMargen_`
 * de Elo.js depende del formato que arma `serializarResultado`, así que
 * conviene poder leerlo y probarlo sin la capa visual.
 *
 * Reemplaza al campo de texto "Resultado exacto", que pedía los juegos
 * del GANADOR primero en cada set -- o sea, obligaba al jugador a
 * reordenar el marcador en la cabeza para escribirlo, porque ese es el
 * orden que necesita el backend, no el que se juega. Acá cada equipo
 * anota sus propios juegos en el orden en que se jugaron y el reordenado
 * lo hace `serializarResultado` al enviar. El backend no cambió: sigue
 * recibiendo el mismo string "7-6, 3-6, 3-1".
 *
 * Como el marcador ya dice quién ganó, la pregunta "¿Qué equipo ganó?"
 * dejó de existir como campo: se deduce con `ganadorDe`. Solo reaparece
 * a mano si el marcador NO alcanza para decidirlo (un partido
 * abandonado con los sets 1-1).
 */

export function setsVacios() {
  return [
    { a: '', b: '' },
    { a: '', b: '' },
    { a: '', b: '' },
  ];
}

function completo(s) {
  return /^\d$/.test(s.a) && /^\d$/.test(s.b);
}

/**
 * Cuántas columnas están en juego. El tercer set no se muestra de
 * entrada: aparece solo cuando los dos primeros quedaron repartidos, así
 * el caso normal (2-0) no arranca con dos casillas vacías de más.
 */
export function setsVisibles(sets) {
  const dos = sets.slice(0, 2);
  if (dos.every(completo)) {
    const { a, b } = contarSets(dos);
    if (a === b) return 3;
  }
  return 2;
}

// Todo lo que se calcula ignora el tercer set mientras esté escondido:
// si alguien lo llenó y después corrigió los primeros dos, esos dígitos
// quedan guardados pero no cuentan ni se envían.
function enJuego(sets) {
  return sets.slice(0, setsVisibles(sets));
}

function contarSets(sets) {
  let a = 0;
  let b = 0;
  sets.forEach((s) => {
    if (!completo(s)) return;
    if (Number(s.a) > Number(s.b)) a += 1;
    else if (Number(s.b) > Number(s.a)) b += 1;
  });
  return { a, b };
}

export function setsGanados(sets) {
  return contarSets(enJuego(sets));
}

export function setsCompletos(sets) {
  return enJuego(sets).filter(completo);
}

/** 'A' | 'B' | null -- null mientras el marcador todavía no lo decida. */
export function ganadorDe(sets) {
  const { a, b } = setsGanados(sets);
  if (a > b) return 'A';
  if (b > a) return 'B';
  return null;
}

/**
 * Arma el string que guarda el Historial. Los juegos del ganador del
 * PARTIDO van primero en cada set, incluso en los sets que perdió: así
 * lo espera `leerSetsGanador_` y así `factorMargen_` suma la diferencia
 * con signo (un 7-6, 3-6, 3-1 da margen ~0, que es lo correcto para un
 * partido peleado).
 */
export function serializarResultado(sets, ganador) {
  return setsCompletos(sets)
    .map((s) => (ganador === 'B' ? s.b + '-' + s.a : s.a + '-' + s.b))
    .join(', ');
}
