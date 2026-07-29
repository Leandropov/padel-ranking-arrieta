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

/**
 * `?mock=1`: lee el ranking de una copia guardada en public/ en vez de
 * pedírselo a Apps Script. Es para poder mirar diseño en el celular
 * cuando el backend está caído --como pasó el 29/07/2026, que devolvía
 * 302 y se colgaba--. Solo existe en esta rama de pruebas.
 */
export const MOCK = params.has('mock');

/**
 * `?sinflecha=1`: la tendencia queda solo con el signo y el color, sin
 * la flecha. Es para probar si la flecha, que cae entre el puntaje y el
 * delta, es lo que hace que los dos números se lean pegados.
 */
export const SIN_FLECHA = params.has('sinflecha');
