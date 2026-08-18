import { useEffect, useRef } from 'react';
import { CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ganadorDe, setsVisibles } from '@/lib/marcador';

/**
 * Marcador tipo transmisión: una fila por equipo, una columna por set.
 *
 * Reemplaza al campo de texto "Resultado exacto", que pedía los juegos
 * del GANADOR primero en cada set -- o sea, obligaba al jugador a
 * reordenar el marcador en la cabeza para escribirlo, porque ese es el
 * orden que necesita el backend, no el que se juega. Acá cada equipo
 * anota sus propios juegos en el orden en que se jugaron y el reordenado
 * lo hace `serializarResultado` al enviar. El backend no cambió.
 *
 * Como el marcador ya dice quién ganó, la pregunta "¿Qué equipo ganó?"
 * dejó de existir como campo: se deduce con `ganadorDe`. Solo reaparece
 * a mano si el marcador NO alcanza para decidirlo (un partido
 * abandonado con los sets 1-1).
 */

const CAJA =
  'size-11 rounded-lg border border-input bg-background text-center font-mono text-lg ' +
  'text-foreground outline-none transition-shadow ring-ring/24 ' +
  'focus-visible:z-10 focus-visible:border-ring focus-visible:ring-[3px]';

const APAGADA =
  'border-dashed border-input/50 bg-muted/40 text-transparent shadow-none ' +
  'disabled:cursor-default';

export function Marcador({ sets, onChange, labelA, labelB, readOnly = false }) {
  const refs = useRef([]);
  const foco = useRef(null);
  const visibles = setsVisibles(sets);
  const ganador = ganadorDe(sets);

  // El foco baja por la columna antes de pasar al set siguiente (A1, B1,
  // A2, B2...), que es el orden en que se dice un resultado en voz alta:
  // "siete seis, tres seis".
  function posicion(indice, fila) {
    return indice * 2 + (fila === 'a' ? 0 : 1);
  }

  useEffect(() => {
    if (foco.current === null) return;
    enfocar(foco.current);
    foco.current = null;
  });

  function enfocar(pos) {
    const caja = refs.current[pos];
    if (caja) {
      caja.focus();
      caja.select();
    }
  }

  function escribir(indice, fila, crudo) {
    const digito = crudo.replace(/\D/g, '').slice(-1);
    let siguientes = sets.map((s, i) => (i === indice ? { ...s, [fila]: digito } : s));
    // Si al corregir un set anterior el tercero deja de hacer falta, se
    // borra. Guardarlo escondido era inofensivo cuando la columna
    // desaparecía, pero ahora quedaría a la vista dentro de una casilla
    // apagada: un número que no cuenta y que igual se lee.
    if (setsVisibles(siguientes) < 3) {
      siguientes = siguientes.map((s, i) => (i === 2 ? { a: '', b: '' } : s));
    }
    onChange(siguientes);
    // El foco se pide acá pero se mueve en el efecto de abajo, no en el
    // acto: al completar el segundo set 1-1 aparece la columna del
    // tercero, y esa casilla todavía no existe en el DOM en este punto
    // -- enfocarla de inmediato no hacía nada y el jugador tenía que
    // tocarla a mano justo cuando el partido se pone interesante.
    if (digito) foco.current = posicion(indice, fila) + 1;
  }

  function alTeclear(e, indice, fila) {
    if (e.key === 'Backspace' && !sets[indice][fila]) {
      e.preventDefault();
      enfocar(posicion(indice, fila) - 1);
    }
  }

  // La grilla SIEMPRE mide 3 sets, se jueguen o no. Cuando la tercera
  // columna aparecía y desaparecía, la de nombres se encogía 2,75rem, los
  // nombres largos se re-acomodaban y las filas cambiaban de alto -- un
  // salto debajo de los dedos de alguien que está escribiendo. Reservar
  // el ancho de entrada también deja claro que el partido es al mejor de
  // 3 antes de empezar a llenar.
  const columnas = {
    gridTemplateColumns: '1rem minmax(0,1fr) repeat(3, 2.75rem)',
  };

  // Función que devuelve JSX, NO un componente: definir un componente
  // acá adentro lo recrea en cada render y React remontaría los inputs
  // en cada tecla, perdiendo el foco justo cuando el auto-avance acaba
  // de moverlo.
  function filaDe(fila, label) {
    const esGanador = ganador === (fila === 'a' ? 'A' : 'B');
    const hayGanador = ganador !== null;
    return (
      <>
        {/* El check va en su propia columna, reservada también para el
            perdedor: si se dibujara junto al nombre, la fila ganadora se
            correría respecto de la otra. Marca explícita porque el
            ganador es el único dato de la pantalla que el sistema dedujo
            en vez de que lo escribiera el jugador -- negrita contra
            apagado es una señal relativa, y hay que saber leerla. */}
        <div className="flex items-center">
          {esGanador && <CheckIcon className="size-4 text-success" strokeWidth={3} />}
        </div>
        <div
          className={cn(
            'flex min-w-0 items-center pr-2 text-sm break-words',
            esGanador && 'font-bold text-foreground',
            hayGanador && !esGanador && 'text-muted-foreground'
          )}
        >
          {label}
        </div>
        {sets.map((s, i) => {
          // Apagado, no ausente: una casilla vacía igual a las demás se
          // leería como "te faltó llenar esto" en un 6-0 6-0, y volvería
          // indistinguible "no se jugó" de "me olvidé". Se enciende sola
          // en cuanto los dos primeros sets quedan 1-1.
          const inactivo = i >= visibles;
          return readOnly ? (
            <div
              key={i}
              className={cn(
                CAJA,
                'flex items-center justify-center',
                hayGanador && !esGanador && 'text-muted-foreground',
                inactivo && APAGADA
              )}
            >
              {inactivo ? '' : s[fila] || '–'}
            </div>
          ) : (
            <input
              key={i}
              ref={(el) => {
                refs.current[posicion(i, fila)] = el;
              }}
              value={s[fila]}
              onChange={(e) => escribir(i, fila, e.target.value)}
              onKeyDown={(e) => alTeclear(e, i, fila)}
              onFocus={(e) => e.target.select()}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              disabled={inactivo}
              aria-label={'Juegos de ' + label + ' en el set ' + (i + 1)}
              className={cn(
                CAJA,
                hayGanador && !esGanador && 'text-muted-foreground',
                inactivo && APAGADA
              )}
            />
          );
        })}
      </>
    );
  }

  return (
    <div className="grid gap-1.5" style={columnas}>
      <div />
      <div />
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className={cn(
            'text-center font-mono text-[10px] tracking-widest text-muted-foreground uppercase',
            i >= visibles && 'opacity-40'
          )}
        >
          S{i + 1}
        </div>
      ))}
      {filaDe('a', labelA)}
      {filaDe('b', labelB)}
    </div>
  );
}
