import { NavLink, Route, Routes } from 'react-router-dom';
import PainelGeral from './pages/PainelGeral';
import ObraDetalhe from './pages/ObraDetalhe';
import Dados from './pages/Dados';

export default function App() {
  return (
    <>
      <header className="topo">
        <span className="marca">Gestão de Obras</span>
        <nav>
          <NavLink to="/" end>
            Painel das obras
          </NavLink>
          <NavLink to="/dados">Backup e dados</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<PainelGeral />} />
          <Route path="/obra/:id" element={<ObraDetalhe />} />
          <Route path="/dados" element={<Dados />} />
          <Route path="*" element={<PainelGeral />} />
        </Routes>
      </main>
    </>
  );
}
