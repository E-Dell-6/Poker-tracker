import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { HomePage } from './pages/HomePage/HomePage';
import { History } from './pages/History/History';
import './App.css'
import { HandReplayer, PublicHandViewer } from './pages/HandReplayer/HandReplayer';
import { Clock } from './pages/Clock/Clock';
import { Players } from './pages/Players/Players';
import { PlayerProfile } from './pages/Players/PlayerProfile';
import { Starred } from './pages/Starred/Starred';
import { SearchResults } from './pages/Search/SearchResults';
import { STUDY_ROUTES } from './pages/Stats/studyRoutes';
import { Profile } from './pages/Profile/Profile';
import { Login } from './pages/Login/Login';
import HandCreator from './pages/HandCreator/HandCreator';
import { LiveSessionProvider } from './context/LiveSessionContext';
import { ImportProvider } from './context/ImportContext';
import { ImportStatus } from './components/ImportStatus';

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
      {/* Above the router for the same reason as LiveSessionProvider, plus
          one of its own: an import has to outlive the page that started it.
          Navigating from History to Study unmounts History and its Layout,
          so anything holding the import state down there would take the
          progress card - and the poll driving it - with it. */}
      <ImportProvider>
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
          {/* Legacy alias - /stats was the original Study URL. */}
          <Route path="/stats" element={<Navigate to="/study" replace />} />
          {STUDY_ROUTES}
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<Login />} />
          <Route path='/hand-creator' element={<HandCreator />}/>
        </Routes>

        {/* Outside <Routes>: the import status card belongs to no page. */}
        <ImportStatus />
      </ImportProvider>
    </LiveSessionProvider>
  )
}

export default App