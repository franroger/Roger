import { NavLink, Route, Routes } from 'react-router-dom';
import ListaObras from './pages/ListaObras';
import ObraDetalhe from './pages/ObraDetalhe';
import Dados from './pages/Dados';

export default function App() {
  return (
    <>
      <header className="topo">
        <span className="marca">Gestão de Obras</span>
        <nav>
          <NavLink to="/" end>
            Obras
          </NavLink>
          <NavLink to="/dados">Backup e dados</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<ListaObras />} />
          <Route path="/obra/:id" element={<ObraDetalhe />} />
          <Route path="/dados" element={<Dados />} />
          <Route path="*" element={<ListaObras />} />
        </Routes>
      </main>
    </>
  );
}
