import { Slider } from '@/components/ui/slider';
import { PUNTOS_VALORACION, fraseDelReparto } from '@/lib/valoracion';

/**
 * El control con el que una persona reparte sus 6 puntos entre los dos
 * jugadores de la pareja rival.
 *
 * Es una barra y no dos campos numéricos porque la decisión real es una
 * sola —hacia qué lado se inclina— y con 7 posiciones posibles se
 * resuelve en un gesto. Arranca en el medio, que significa "jugaron
 * parejo": quien no tenga opinión no tiene que hacer nada.
 *
 * Los dos números que se ven a los costados son los puntos que le tocan a
 * cada uno. Suman siempre 6, y esa es toda la regla.
 */
export function RepartoValoracion({ nombreUno, nombreOtro, puntos, onChange }) {
  const alOtro = PUNTOS_VALORACION - puntos;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <Extremo nombre={nombreUno} puntos={puntos} />
        <Extremo nombre={nombreOtro} puntos={alOtro} alineado="derecha" />
      </div>

      {/* El valor de la barra es lo que le toca al de la DERECHA, no al de
          la izquierda. Sin invertir, arrastrar hacia la derecha le sumaba
          puntos al nombre de la izquierda: el pulgar y el nombre que gana
          apuntaban a lados opuestos. Ahora el pulgar se mueve hacia quien
          jugó mejor, que es lo que la mano espera. */}
      <Slider
        min={0}
        max={PUNTOS_VALORACION}
        step={1}
        value={alOtro}
        onValueChange={(v) => onChange(PUNTOS_VALORACION - (Array.isArray(v) ? v[0] : v))}
        aria-label={'Repartir ' + PUNTOS_VALORACION + ' puntos entre ' + nombreUno + ' y ' + nombreOtro}
      />

      {/* min-h para que el bloque no cambie de alto al pasar de "Jugaron
          parejo" a un nombre largo y la barra no salte bajo el dedo. */}
      <p className="min-h-[2.5em] text-center text-sm text-muted-foreground">
        {fraseDelReparto(puntos, nombreUno, nombreOtro)}
      </p>
    </div>
  );
}

function Extremo({ nombre, puntos, alineado }) {
  const derecha = alineado === 'derecha';
  return (
    <div className={'min-w-0 flex-1 ' + (derecha ? 'text-right' : 'text-left')}>
      <div className="font-mono text-3xl leading-none font-semibold tabular-nums">{puntos}</div>
      <div className="mt-1.5 text-sm break-words text-muted-foreground">{nombre}</div>
    </div>
  );
}
