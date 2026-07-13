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
 * `exclude` son nombres que no deben aparecer como sugerencia (ej. los
 * ya elegidos en el equipo contrario).
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
  const excludeSet = new Set(exclude);
  const items = players.filter((n) => !excludeSet.has(n)).map((n) => ({ label: n, value: n }));

  if (multiple) {
    const values = (value || []).map((n) => ({ label: n, value: n }));
    return (
      <Combobox
        items={items}
        multiple
        value={values}
        onValueChange={(nuevo) => {
          if (nuevo.length <= max) onChange(nuevo.map((v) => v.value));
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
                  placeholder={values.length >= max ? 'Máximo alcanzado' : placeholder}
                  disabled={values.length >= max}
                />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxPopup>
          <ComboboxEmpty>Sin resultados</ComboboxEmpty>
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

  const selected = value ? { label: value, value } : null;
  return (
    <Combobox
      items={items}
      value={selected}
      onValueChange={(nuevo) => onChange(nuevo ? nuevo.value : '')}
    >
      <ComboboxInput placeholder={placeholder} />
      <ComboboxPopup>
        <ComboboxEmpty>Sin resultados</ComboboxEmpty>
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
