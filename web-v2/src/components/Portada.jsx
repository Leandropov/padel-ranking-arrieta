/**
 * La portada de las tres pantallas de entrada: cargar resultado, ranking
 * y registro. Antes cada una dibujaba su propio SVG.
 *
 * Va en un solo componente porque el redondeo de arriba es fácil de
 * perder: la card tiene 1px de borde, así que la portada necesita un
 * radio 1px menor que el de la card o asoma una uña del fondo en las
 * esquinas. En celular no hay card y el redondeo se apaga desde
 * FlowShell, que lo pisa con `[&>:first-child]`.
 *
 * `aspect-[21/9]` es la misma proporción que la imagen (1915x821), así
 * que `cover` nunca recorta nada: sólo escala. El ancho real va de 360px
 * en un celular chico a 639px en el ranking, y esa proporción fija es lo
 * que hace que una sola imagen sirva para todos los tamaños.
 */
export function Portada() {
  return (
    <img
      src="/portada.webp"
      alt=""
      /* Decorativa: el nombre del club no aporta nada a quien usa lector
         de pantalla y ya está en el título de cada pantalla. */
      aria-hidden="true"
      width={1915}
      height={821}
      /* Las medidas explícitas reservan el alto antes de que la imagen
         baje, así el contenido no salta cuando entra. */
      className="aspect-[21/9] w-full rounded-t-[calc(var(--radius-2xl)-1px)] object-cover"
    />
  );
}
