import { useEffect, useState } from 'react';
import ResultadoPage from '@/pages/ResultadoPage';
import RankingPage from '@/pages/RankingPage';

function vistaActual() {
  return window.location.hash === '#ranking' ? 'ranking' : 'resultado';
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
      <div className="fixed inset-0 -z-10 bg-muted" />
      {vista === 'ranking' ? <RankingPage /> : <ResultadoPage />}
    </>
  );
}
