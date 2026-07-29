import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { SIN_CAJA } from '@/lib/layout';

const ANCHOS = {
  md: 'max-w-md',
  '2xl': 'max-w-2xl',
};

/**
 * Contenedor de las pantallas del flujo: el ancho máximo centrado más la
 * Card. Antes esto estaba repetido a mano en cada página.
 *
 * En modo `?sincaja=1` (ver lib/layout.js) todo lo que hace de "caja" se
 * apaga con `max-sm:`, o sea SOLO en celular: se va el margen exterior,
 * el borde, el radio, la sombra y el pseudo-elemento de borde interno de
 * la Card, y la superficie blanca pasa a ocupar la pantalla entera
 * (`min-h-svh`). El `[&>:first-child]` es la portada verde de cada
 * pantalla: como está redondeada arriba por su propia clase, hay que
 * ganarle desde el padre (selector de descendiente, más específico).
 *
 * Desde `sm` hacia arriba no se toca nada, así que desktop queda
 * exactamente igual que hoy.
 */
export function FlowShell({ ancho = 'md', className, children }) {
  return (
    <div className={cn('mx-auto p-4', ANCHOS[ancho], SIN_CAJA && 'max-sm:p-0')}>
      <Card
        className={cn(
          SIN_CAJA &&
            'max-sm:min-h-svh max-sm:rounded-none max-sm:border-0 max-sm:shadow-none max-sm:before:hidden max-sm:[&>:first-child]:rounded-none',
          className,
        )}
      >
        {children}
      </Card>
    </div>
  );
}
