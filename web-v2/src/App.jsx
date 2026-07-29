import { useEffect, useState } from 'react';
import ResultadoPage from '@/pages/ResultadoPage';
import RankingPage from '@/pages/RankingPage';
import RegistroPage from '@/pages/RegistroPage';

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
      {/* En celular el fondo beige no se ve por ningún lado (la pantalla
          la ocupa entera la superficie de la card), así que se pinta del
          mismo color para que el rebote del scroll en iOS no muestre una
          franja distinta. */}
      <div className="fixed inset-0 -z-10 bg-muted max-sm:bg-card" />
      {vista === 'ranking' && <RankingPage />}
      {vista === 'registro' && <RegistroPage />}
      {vista === 'resultado' && <ResultadoPage />}
    </>
  );
}
