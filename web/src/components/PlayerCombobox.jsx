import { useMemo, useState } from 'react';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxValue,
} from '@/components/ui/combobox';

/**
 * Buscador con autocompletar para elegir jugadores entre cientos de
 * opciones, en vez de un <select>/checkboxes gigante. Con multiple=true
 * permite hasta `max` jugadores con chips removibles (para un equipo);
 * sin multiple, un solo valor (para "¿Quién eres?").
 *
 * `players` son objetos {id, nombre, etiqueta}. Lo que entra y sale por
 * `value`/`onChange`/`exclude` son SIEMPRE ids, nunca nombres: dos
 * personas pueden llamarse igual y hay que poder elegir a una sola.
 * `etiqueta` es lo único que se muestra -- normalmente el nombre, y el
 * nombre más la categoría si justo hay otro jugador con el mismo nombre.
 */
export function PlayerCombobox({
  players,
  value,
  onChange,
  exclude = [],
  multiple = false,
  max = 2,
  placeholder = 'Buscar jugador…',
}) {
  // Memoizado: sin esto, tipear en cualquier otro campo del formulario
  // (ej. el motivo o el resultado) volvía a filtrar+mapear la lista
  // completa de jugadores en cada uno de los 3 buscadores montados.
  // También se excluyen los ya elegidos en este mismo combobox, para no
  // poder repetir un jugador dentro del mismo equipo.
  const excludeSet = useMemo(
    () => new Set([...exclude, ...(multiple ? value || [] : [])]),
    [exclude, multiple, value]
  );
  const items = useMemo(
    () =>
      players
        .filter((j) => !excludeSet.has(j.id))
        .map((j) => ({ label: j.etiqueta, value: j.id })),
    [players, excludeSet]
  );
  // Para reconstruir el item completo a partir de un id ya elegido: el
  // componente necesita {label, value} y el formulario solo guarda ids.
  const itemPorId = useMemo(() => {
    const mapa = new Map();
    players.forEach((j) => mapa.set(j.id, { label: j.etiqueta, value: j.id }));
    return mapa;
  }, [players]);
  // Solo se usa en el combobox multiple: cierra el popup solo al llegar
  // al máximo de jugadores, para no obligar a un clic extra afuera.
  const [open, setOpen] = useState(false);

  if (multiple) {
    const values = (value || [])
      .map((id) => itemPorId.get(id))
      .filter(Boolean);
    return (
      <Combobox
        items={items}
        multiple
        value={values}
        open={open}
        onOpenChange={setOpen}
        onValueChange={(nuevo) => {
          if (nuevo.length <= max) onChange(nuevo.map((v) => v.value));
          if (nuevo.length >= max) setOpen(false);
        }}
      >
        <ComboboxChips>
          <ComboboxValue>
            {(seleccionados) => (
              <>
                {seleccionados?.map((item) => (
                  <ComboboxChip key={item.value} aria-label={item.label}>
                    {item.label}
                  </ComboboxChip>
                ))}
                <ComboboxChipsInput
                  placeholder={values.length >= max ? `Ya elegiste los ${max} jugadores` : placeholder}
                  disabled={values.length >= max}
                  size="lg"
                />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxPopup>
          {/* Este punto muerto es lo único que tienen cuatro personas
              paradas en el club cuando falta uno de los que jugó, así que
              tiene que resolver el caso entero, no sólo avisar que no hay
              resultados. Las dos salidas son las únicas posibles: o es
              socio y se registra, o es invitado y el partido no cuenta. */}
          <ComboboxEmpty className="text-left">
            <p className="font-medium text-foreground">Solo aparecen los jugadores ya registrados.</p>
            <p className="mt-1 text-sm">Si es socio, tiene que registrarse antes de que puedas cargar el partido.</p>
            <p className="text-sm">Si es invitado, este partido no suma al ranking.</p>
          </ComboboxEmpty>
          <ComboboxList>
            {(item) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>
    );
  }

  const selected = (value && itemPorId.get(value)) || null;
  return (
    <Combobox
      items={items}
      value={selected}
      onValueChange={(nuevo) => onChange(nuevo ? nuevo.value : '')}
    >
      <ComboboxInput placeholder={placeholder} size="lg" />
      <ComboboxPopup>
        {/* Acá quien busca se busca a sí mismo, así que la salida es una
            sola: registrarse. */}
        <ComboboxEmpty className="text-left">
          <p className="font-medium text-foreground">Solo aparecen los jugadores ya registrados.</p>
          <p className="mt-1 text-sm">Si todavía no estás en el ranking, regístrate primero.</p>
        </ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}
