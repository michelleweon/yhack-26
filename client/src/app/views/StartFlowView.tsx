import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { HostLayout } from '@/shared/components/HostLayout';
import { useAppFlow } from '../AppFlowContext';

export function StartFlowView() {
  const navigate = useNavigate();
  const { selectFlow } = useAppFlow();

  const handleContinue = () => {
    selectFlow('real');
    navigate('/real', { replace: true });
  };

  return (
    <HostLayout settingsGearSide="left">
      <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="soft-glass-panel w-full max-w-6xl rounded-[2.4rem] border border-white/10 p-6 sm:p-8 lg:p-10"
        >
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-ui text-xs uppercase tracking-[0.34em] text-vault-gold/80">
              Startup Flow
            </p>
            <h1 className="mt-4 font-title text-5xl leading-[0.9] text-vault-gold sm:text-6xl lg:text-7xl">
              R.A.C.C.O.O.N.
            </h1>
            <p className="mt-4 font-ui text-lg uppercase tracking-[0.16em] text-white/78 [text-wrap:balance]">
              Risk Arbitrage Calibration &amp; Chaotic Odds Ops Network
            </p>
            <p className="mt-6 font-ui text-lg text-white/68">
              Startup is locked to the real experience so the app opens like a live session, without the dev phase switcher or extra mode controls.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex h-full flex-col rounded-[2rem] border border-white/10 bg-black/25 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
            >
              <p className="font-ui text-xs uppercase tracking-[0.28em] text-white/45">
                Playtest
              </p>
              <h2 className="mt-3 font-title text-4xl text-white">Real Flow</h2>
              <p className="mt-4 font-ui text-base text-white/72">
                Run the app like a player-facing experience with no debug controls and real progression.
              </p>

              <div className="mt-6 flex flex-1 flex-col gap-3">
                {[
                  'No dev phase switcher',
                  'Start from host or join entry',
                  'Question rounds advance automatically',
                ].map(bullet => (
                  <div
                    key={bullet}
                    className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 font-ui text-sm text-white/75"
                  >
                    {bullet}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleContinue}
                className="minimal-button-primary mt-8 w-full py-4 text-lg"
              >
                Continue
              </button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </HostLayout>
  );
}
