import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameState } from '@/context/GameContext';
import { DevToolbar } from '@/shared/components/DevToolbar';
import { useAppFlow } from '@/app/AppFlowContext';
import { useLoopingAudio } from '@/shared/hooks/useLoopingAudio';
import { useAudioSettings } from '@/shared/context/AudioSettingsContext';
import { stopQuestionNarration } from '@/services/questionNarration';
import introMusicSrc from '@/assets/audio/intro-music.mp3';
import levelMusicSrc from '@/assets/audio/level-music.mp3';
import levelMusic2Src from '@/assets/audio/level-music-2.mp3';
import levelMusic3Src from '@/assets/audio/level-music-3.mp3';
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

const LEVEL_MUSIC_TRACKS = [levelMusicSrc, levelMusic2Src, levelMusic3Src];

function pickRandomTrack(excluding?: string) {
  const availableTracks = excluding
    ? LEVEL_MUSIC_TRACKS.filter(track => track !== excluding)
    : LEVEL_MUSIC_TRACKS;
  const trackPool = availableTracks.length > 0 ? availableTracks : LEVEL_MUSIC_TRACKS;

  return trackPool[Math.floor(Math.random() * trackPool.length)] ?? LEVEL_MUSIC_TRACKS[0];
}

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
  const { phase, currentQuestion } = useGameState();
  const { flow } = useAppFlow();
  const { musicEnabled } = useAudioSettings();
  const shouldPlayLobbyMusic = phase === 'home' || phase === 'room';
  const shouldPlayQuestionMusic = phase === 'question' || phase === 'profile';
  const [activeQuestionMusicSrc, setActiveQuestionMusicSrc] = useState(() => pickRandomTrack());

  useEffect(() => {
    if (!shouldPlayQuestionMusic || !currentQuestion?.id) {
      return;
    }

    setActiveQuestionMusicSrc(currentTrack => pickRandomTrack(currentTrack));
  }, [currentQuestion?.id, shouldPlayQuestionMusic]);

  useEffect(() => {
    if (phase !== 'question') {
      stopQuestionNarration();
    }
  }, [phase]);

  useLoopingAudio({
    enabled: musicEnabled && shouldPlayLobbyMusic,
    src: introMusicSrc,
    volume: 0.45,
  });

  useLoopingAudio({
    enabled: musicEnabled && shouldPlayQuestionMusic,
    src: activeQuestionMusicSrc,
    volume: 0.35,
  });

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
