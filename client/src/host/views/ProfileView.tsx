import { HostLayout } from '@/shared/components/HostLayout';
import { CharacterAvatar } from '@/shared/components/CharacterAvatar';
import { LockTimer } from '@/shared/components/LockTimer';
import { useGameState } from '@/context/GameContext';
import bankBg from '@/assets/backgrounds/bank.png';

export function ProfileView() {
  const {
    players,
    profileAssignments,
    profileResponses,
    activeFriendGroupPackSettings,
    roundDeadlineAt,
    timerDuration,
  } = useGameState();

  const activePlayers = players.filter(player => !player.isEliminated);
  const assignedProfileCount = activePlayers.reduce((maxCount, player) => (
    Math.max(maxCount, profileAssignments[player.id]?.length ?? 0)
  ), 0);
  const profileCount = Math.max(
    assignedProfileCount,
    activeFriendGroupPackSettings?.numQuestions ?? 0
  );
  const totalExpectedResponses = activePlayers.reduce((sum, player) => {
    const assignedQuestions = profileAssignments[player.id] ?? [];
    return sum + assignedQuestions.length;
  }, 0);
  const submittedResponses = activePlayers.reduce((sum, player) => {
    const answers = profileResponses[player.id] ?? [];
    return sum + answers.length;
  }, 0);
  const shouldUseTwoColumnPlayerGrid = activePlayers.length > 4;

  return (
    <HostLayout backgroundImage={bankBg} minimalSettingsGear>
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center">
        {roundDeadlineAt && (
          <div
            className="absolute z-10"
            style={{
              top: 36,
              left: 0,
            }}
          >
            <div style={{ transform: 'scale(0.7)', transformOrigin: 'top left' }}>
              <LockTimer deadlineAt={roundDeadlineAt} totalTime={timerDuration} size={200} />
            </div>
          </div>
        )}

        <div className="max-w-4xl rounded-[2rem] border border-violet-300/35 bg-black/30 px-10 py-10">
          <p className="font-ui text-xs uppercase tracking-[0.35em] text-violet-200/85">
            Friend Group Survey In Progress
          </p>
          <h2 className="mt-3 font-title text-4xl text-vault-gold">
            Collecting {profileCount} Responses Per Player
          </h2>
          <p className="mt-4 font-ui text-lg text-white/80">
            Players are sending short answers before the main round starts.
          </p>

          <p className="mx-auto mt-8 max-w-3xl font-ui text-2xl text-white">
            {submittedResponses} / {totalExpectedResponses} responses submitted
          </p>

          <div
            className={`mx-auto mt-8 grid w-full gap-3 ${
              shouldUseTwoColumnPlayerGrid ? 'max-w-4xl grid-cols-2' : 'max-w-3xl grid-cols-1'
            }`}
          >
            {activePlayers.map(player => {
              const assignedCount = profileAssignments[player.id]?.length ?? profileCount;
              const submittedCount = profileResponses[player.id]?.length ?? 0;
              const isComplete = assignedCount > 0 && submittedCount >= assignedCount;

              return (
                <div
                  key={player.id}
                  className="flex items-center justify-between rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-left font-ui text-lg text-white/85"
                >
                  <div className="flex items-center gap-3">
                    <CharacterAvatar
                      characterIndex={player.characterIndex}
                      size={44}
                      isDisconnected={!player.isConnected}
                      isEliminated={player.isEliminated}
                    />
                    <span>
                      {player.name} - {submittedCount} / {assignedCount}
                    </span>
                  </div>
                  {isComplete ? (
                    <span className="font-title text-xl text-vault-gold">✓</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </HostLayout>
  );
}
