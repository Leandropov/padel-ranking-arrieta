import { useEffect, useState } from 'react';
import ResultadoPage from '@/pages/ResultadoPage';
import RankingPage from '@/pages/RankingPage';
import RegistroPage from '@/pages/RegistroPage';
import { cn } from '@/lib/utils';
import { SIN_CAJA } from '@/lib/layout';

const VISTAS = {
  '#ranking': 'ranking',
  '#registro': 'registro',
};

function vistaActual() {
  return VISTAS[window.location.hash] || 'resultado';
}

export default function App() {
  const [vista, setVista] = useState(vistaActual);

  useEffect(() => {
    function onHashChange() {
      setVista(vistaActual());
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <>
      {/* Sin caja, en celular el fondo beige ya no se ve por ningún lado:
          se pinta del color de la superficie para que el rebote del scroll
          en iOS no muestre una franja de otro color. */}
      <div className={cn('fixed inset-0 -z-10 bg-muted', SIN_CAJA && 'max-sm:bg-card')} />
      {vista === 'ranking' && <RankingPage />}
      {vista === 'registro' && <RegistroPage />}
      {vista === 'resultado' && <ResultadoPage />}
    </>
  );
}
