import { useStudyContext } from './StudyLayout';
import { BoardTexture } from './BoardTexture';
import { PostflopPositionMatrix } from './PostflopPositionMatrix';

export function StudyFlop() {
  const { stats } = useStudyContext();
  return (
    <>
      <BoardTexture byBoardTexture={stats.byBoardTexture} />
      <PostflopPositionMatrix positional={stats.positional} />
    </>
  );
}

export default StudyFlop;
