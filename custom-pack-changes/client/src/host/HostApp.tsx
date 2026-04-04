import { AnimatePresence, motion } from 'framer-motion';
import { useGameState } from '@/context/GameContext';
import { DevToolbar } from '@/shared/components/DevToolbar';
import { useAppFlow } from '@/app/AppFlowContext';
import { HomeView } from './views/HomeView';
import { RoomView } from './views/RoomView';
import { IntroView } from './views/IntroView';
import { ProfileView } from './views/ProfileView';
import { QuestionView } from './views/QuestionView';
import { ResultsView } from './views/ResultsView';
import { LeaderboardView } from './views/LeaderboardView';
import { WinView } from './views/WinView';

const PAGE_TRANSITION = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.02 },
  transition: { duration: 0.4, ease: 'easeInOut' as const },
};

function PhaseRenderer({ phase }: { phase: string }) {
  switch (phase) {
    case 'home': return <HomeView />;
    case 'room': return <RoomView />;
    case 'intro': return <IntroView />;
    case 'profile': return <ProfileView />;
    case 'question': return <QuestionView />;
    case 'results': return <ResultsView />;
    case 'leaderboard': return <LeaderboardView />;
    case 'win': return <WinView isGameOver={false} />;
    case 'gameover': return <WinView isGameOver={true} />;
    default: return <HomeView />;
  }
}

export function HostApp() {
  const { phase } = useGameState();
  const { flow } = useAppFlow();

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div key={phase} className="w-full h-full" {...PAGE_TRANSITION}>
          <PhaseRenderer phase={phase} />
        </motion.div>
      </AnimatePresence>
      {flow === 'dev' && <DevToolbar />}
    </>
  );
}
