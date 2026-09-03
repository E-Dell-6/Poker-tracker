import { Route } from 'react-router-dom';
import { StudyLayout } from './StudyLayout';
import { StudyOverview } from './StudyOverview';
import { StudyHands } from './StudyHands';
import { StudyFlop } from './StudyFlop';
import { PreflopMatrixPage } from './PreflopMatrix/PreflopMatrixPage';

// Exported as an element tree (not mounted here) so App.jsx and the test
// helper that renders it (see __tests__/helpers/heroStats.jsx) share the
// exact same route structure - the whole point of the StudyLayout route is
// that its shared header/useHeroStats instance survives subpage
// navigation, which only a real nested route tree exercises in a test.
export const STUDY_ROUTES = (
  <Route path="/study" element={<StudyLayout />}>
    <Route index element={<StudyOverview />} />
    <Route path="hands" element={<StudyHands />} />
    <Route path="range-matrix" element={<PreflopMatrixPage />} />
    <Route path="flop" element={<StudyFlop />} />
  </Route>
);
