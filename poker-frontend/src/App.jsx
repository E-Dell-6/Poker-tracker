import { Routes, Route, useSearchParams } from 'react-router-dom';
import { HomePage } from './pages/HomePage/HomePage';
import { History } from './pages/History/History';
import './App.css'
import { HandReplayer, PublicHandViewer } from './pages/HandReplayer/HandReplayer';
import { Clock } from './pages/Clock/Clock';
import { Players } from './pages/Players/Players';
import { PlayerProfile } from './pages/Players/PlayerProfile';
import { Starred } from './pages/Starred/Starred';
import { SearchResults } from './pages/Search/SearchResults';
import { Stats } from './pages/Stats/Stats';
import { PreflopMatrixPage } from './pages/Stats/PreflopMatrix/PreflopMatrixPage';
import { Profile } from './pages/Profile/Profile';
import { Login } from './pages/Login/Login';
import HandCreator from './pages/HandCreator/HandCreator';
import { LiveSessionProvider } from './context/LiveSessionContext';

function HandReplayRoute() {
  const [searchParams] = useSearchParams();
  return searchParams.get('hand') ? <PublicHandViewer /> : <HandReplayer />;
}

function App() {
  return (
    // Above the router (not inside Layout) so a page that both renders
    // <Layout> AND reads/writes this context (Clock.jsx) is a descendant
    // of the provider rather than its ancestor - a page calling
    // useLiveSession() in its own body while also being the one that
    // creates the provider (via Layout) throws, since the provider it
    // renders is a child in the tree, not yet a parent when its own hooks run.
    <LiveSessionProvider>
      <Routes>
        <Route index element={<HomePage />}/>
        <Route path="/dashboard" element={<HomePage />} />
        <Route path="/history" element={<History />}/>
        <Route path="/clock" element={<Clock />}/>
        <Route path="hand-replay" element={<HandReplayRoute />}/>
        <Route path="/players" element={<Players />} />
        <Route path="/players/:personId" element={<PlayerProfile />} />
        <Route path="/starred" element={<Starred />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/study" element={<Stats />} />
        <Route path="/study/range-matrix" element={<PreflopMatrixPage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<Login />} />
        <Route path='/hand-creator' element={<HandCreator />}/>
      </Routes>
    </LiveSessionProvider>
  )
}

export default App