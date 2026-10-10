import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './ui/Home';
import Room from './ui/Room';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:id" element={<Room />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
