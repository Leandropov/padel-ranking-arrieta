/**
 * Prueba de diseño (rama prueba/mobile-sin-caja).
 *
 * Con `?sincaja=1` en la URL, el flujo deja de dibujarse dentro de una
 * caja flotante en el celular y pasa a ocupar la pantalla completa
 * (full-bleed). En desktop no cambia nada: la caja sigue estando.
 *
 * Se lee una sola vez al cargar, no en cada render: la idea es comparar
 * dos versiones abriendo dos URLs, no cambiar de modo en caliente.
 */
const params = new URLSearchParams(window.location.search);

export const SIN_CAJA = params.has('sincaja');

/**
 * Segunda prueba: la fila del ranking en celular con todo en una sola
 * línea (puesto, nombre, categoría, puntaje y tendencia), donde el único
 * que puede partirse en dos renglones es el nombre. Se activa con
 * `?horizontal=1`.
 */
export const FILA_HORIZONTAL = params.has('horizontal');

/**
 * Tercera prueba (`?ref=1`), sobre el listado de la referencia de
 * leaderboard que trajo Leandro (solo el listado: el podio de los tres
 * primeros queda afuera a propósito). Las filas no se separan con
 * bordes sino con aire, el nombre manda y todo lo demás --puesto,
 * categoría, puntaje, tendencia-- baja de peso a gris.
 */
export const ESTILO_REFERENCIA = params.has('ref');
