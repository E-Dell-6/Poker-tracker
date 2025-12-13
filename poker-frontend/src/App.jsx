import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { History } from './pages/History/History';
import './App.css'


function App() {
  return (
    <Routes>
      <Route index element={<HomePage />}/>
      <Route path="/dashboard" element={<HomePage />} />
      <Route path="/history" element={<History />}/> 
    </Routes>
  )
}

export default App