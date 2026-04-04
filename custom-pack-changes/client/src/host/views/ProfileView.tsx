import { HostLayout } from '@/shared/components/HostLayout';
import { useGameState } from '@/context/GameContext';
import v4RoofBg from '@/assets/optimized/v4roof.webp';

export function ProfileView() {
  const { players, questionDeck, profileAssignments, profileResponses } = useGameState();

  const profileCount = Math.min(3, questionDeck.length);
  const activePlayers = players.filter(player => !player.isEliminated);
  const totalExpected = activePlayers.reduce((acc, player) => {
    const assigned = profileAssignments[player.id] ?? [];
    return acc + assigned.length;
  }, 0);
  const submittedCount = activePlayers.reduce((acc, player) => {
    const responses = profileResponses[player.id] ?? [];
    return acc + responses.length;
  }, 0);

  return (
    <HostLayout backgroundImage={v4RoofBg} minimalSettingsGear>
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="max-w-4xl rounded-[2rem] border border-violet-300/35 bg-black/30 px-10 py-10">
          <p className="font-ui text-xs uppercase tracking-[0.35em] text-violet-200/85">
            Profile Survey In Progress
          </p>
          <h2 className="mt-3 font-title text-4xl text-vault-gold">
            Collecting {profileCount} Preferences Per Player
          </h2>
          <p className="mt-4 font-ui text-lg text-white/80">
            Players are answering individual preference questions.
          </p>

          <p className="mx-auto mt-8 max-w-3xl font-ui text-2xl text-white">
            {submittedCount} / {totalExpected} responses submitted
          </p>

          <div className="mx-auto mt-8 grid w-full max-w-3xl grid-cols-1 gap-3">
            {activePlayers.map(player => (
              <div
                key={player.id}
                className="rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-left font-ui text-lg text-white/85"
              >
                <span className="mr-3 font-title text-vault-gold">
                  {(profileResponses[player.id]?.length ?? 0) >= (profileAssignments[player.id]?.length ?? profileCount)
                    ? '✓'
                    : '…'}
                </span>
                {player.name} - {profileResponses[player.id]?.length ?? 0} / {profileAssignments[player.id]?.length ?? profileCount}
              </div>
            ))}
          </div>
        </div>
      </div>
    </HostLayout>
  );
}
