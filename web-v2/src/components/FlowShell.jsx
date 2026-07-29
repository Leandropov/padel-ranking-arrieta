import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const ANCHOS = {
  md: 'max-w-md',
  '2xl': 'max-w-2xl',
};

/**
 * Contenedor de las pantallas del flujo: el ancho máximo centrado más la
 * Card. Antes esto estaba repetido a mano en cada página.
 *
 * En celular no hay caja: todo lo que la dibuja se apaga con `max-sm:`
 * --el margen exterior, el borde, el radio, la sombra y el pseudo del
 * borde interno-- y la superficie ocupa la pantalla completa
 * (`min-h-svh`). La app se usa casi solo desde el celular, y ahí una
 * card flotando se comía ~40px de ancho por lado para dejar ver una
 * franja de fondo que no comunicaba nada.
 *
 * El `[&>:first-child]` es la portada de cada pantalla: como está
 * redondeada arriba por su propia clase, hay que ganarle desde el padre
 * con un selector de descendiente, que es más específico.
 *
 * De `sm` para arriba no se toca nada, así que en desktop --que es el
 * caso borde-- sigue apareciendo la card de siempre.
 */
export function FlowShell({ ancho = 'md', className, children }) {
  return (
    <div className={cn('mx-auto p-4 max-sm:p-0', ANCHOS[ancho])}>
      <Card
        className={cn(
          'max-sm:min-h-svh max-sm:rounded-none max-sm:border-0 max-sm:shadow-none max-sm:before:hidden max-sm:[&>:first-child]:rounded-none',
          className,
        )}
      >
        {children}
      </Card>
    </div>
  );
}
