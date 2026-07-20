import { Input } from '@/components/ui/input';

const MAX_DIGITOS = 6; // hasta 3 sets

function formatear(digitos) {
  const sets = [];
  for (let i = 0; i < digitos.length; i += 2) {
    const par = digitos.slice(i, i + 2);
    sets.push(par.length === 2 ? par[0] + '-' + par[1] : par[0]);
  }
  return sets.join(', ');
}

/**
 * Campo "Resultado exacto": solo dígitos, arma el formato "D-D, D-D"
 * solo (guion y coma se insertan solos), tope de 3 sets.
 */
export function ResultadoInput({ value, onChange }) {
  return (
    <Input
      value={value}
      placeholder="6-4, 6-3"
      inputMode="numeric"
      pattern="[0-9]*"
      size="lg"
      className="font-mono tracking-wide"
      onKeyDown={(e) => {
        if (e.key.length === 1 && !/[0-9]/.test(e.key)) {
          e.preventDefault();
        }
      }}
      onChange={(e) => {
        const digitos = e.target.value.replace(/\D/g, '').slice(0, MAX_DIGITOS).split('');
        onChange(formatear(digitos));
      }}
    />
  );
}
