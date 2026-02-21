import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage/HomePage';
import { History } from './pages/History/History';
import './App.css'
import { HandReplayer } from './pages/HandReplayer/HandReplayer';
import { HandCreator } from './pages/HandCreator/HandCreator';
import { Clock } from './pages/Clock/Clock';
import { Players } from './pages/Players/Players';
import { Study } from './pages/Study/Study';
import { Profile } from './pages/Profile/Profile';
import { Login } from './pages/Login/Login';

function App() {
  return (
    <Routes>
      <Route index element={<HomePage />}/>
      <Route path="/dashboard" element={<HomePage />} />
      <Route path="/history" element={<History />}/> 
      <Route path="/clock" element={<Clock />}/>
      <Route path="hand-replay" element={<HandReplayer />}/>
      <Route path="/hands/hand-creator" element={<HandCreator />}/>
      <Route path="/players" element={<Players />} />
      <Route path="/study" element={<Study />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/login" element={<Login />} />
    </Routes>
  )
}

export default App