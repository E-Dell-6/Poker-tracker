import { useStudyContext } from './StudyLayout';
import { HandClassBreakdown } from './HandClassBreakdown';

export function StudyHands() {
  const { stats } = useStudyContext();
  return (
    <HandClassBreakdown byHandClass={stats.byHandClass} byHandClassCategory={stats.byHandClassCategory} />
  );
}

export default StudyHands;
