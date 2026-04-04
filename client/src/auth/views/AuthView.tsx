import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { HostLayout } from '@/shared/components/HostLayout';
import { useAuth } from '../AuthContext';

type AuthMode = 'sign-in' | 'sign-up';
const LIVE_CATEGORY_PILLS = ['Polymarket', 'Friend Group', 'Coursework', 'Misc Scraps'];

function getFriendlyErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

export function AuthView() {
  const location = useLocation();
  const { user, isLoading, isConfigured, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null;
    return state?.from?.pathname || '/host';
  }, [location.state]);

  if (!isLoading && user) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === 'sign-in') {
        await signIn(email.trim(), password);
        return;
      }

      await signUp({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
      });
      setSuccessMessage('Account created. Check your inbox if your Supabase project requires email confirmation.');
      setMode('sign-in');
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <HostLayout settingsGearSide="left">
      <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="soft-glass-panel grid w-full max-w-6xl gap-10 overflow-hidden rounded-[2.25rem] border border-white/10 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10"
        >
          <div className="flex flex-col justify-between">
            <div>
              <p className="font-ui text-xs uppercase tracking-[0.34em] text-vault-gold/80">
                Host Access
              </p>
              <h1 className="mt-4 font-title text-5xl leading-[0.9] text-vault-gold sm:text-6xl">
                R.A.C.C.O.O.N.
              </h1>
              <p className="mt-4 max-w-xl font-ui text-lg uppercase tracking-[0.16em] text-white/78 [text-wrap:balance]">
                Risk Arbitrage Calibration &amp; Chaotic Odds Ops Network
              </p>
              <p className="mt-6 max-w-2xl font-ui text-lg text-white/68">
                Sign in before hosting a room. Live Polymarket categories now seed the question deck, while the rest of the game flow keeps the existing vault look and feel.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-5">
                <p className="font-ui text-xs uppercase tracking-[0.28em] text-white/45">
                  Live Categories
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {LIVE_CATEGORY_PILLS.map(pill => (
                    <span
                      key={pill}
                      className="inline-flex items-center justify-center rounded-full border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-3 py-1 text-center font-ui text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f3c77a]"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-5">
                <p className="font-ui text-xs uppercase tracking-[0.28em] text-white/45">
                  Join Room
                </p>
                <Link to="/play" className="mt-3 inline-flex font-ui text-base uppercase tracking-[0.16em] text-vault-gold transition-opacity hover:opacity-80">
                  Open player entry
                </Link>
              </div>
            </div>
          </div>

          <motion.div
            layout
            transition={{ type: 'spring', stiffness: 220, damping: 24 }}
            className="rounded-[2rem] border border-white/10 bg-black/30 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
          >
            <div className="mb-6 flex rounded-full border border-white/10 bg-black/20 p-1">
              {([
                ['sign-in', 'Sign In'],
                ['sign-up', 'Create Account'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setMode(value);
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className={`flex-1 rounded-full px-4 py-3 font-ui text-sm font-semibold uppercase tracking-[0.18em] transition-colors ${
                    mode === value
                      ? 'bg-vault-gold text-[#111827]'
                      : 'text-white/70 hover:bg-white/5'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {!isConfigured && (
              <div className="mb-5 rounded-[1.4rem] border border-vault-red/35 bg-vault-red/10 px-4 py-3">
                <p className="font-ui text-sm text-white/85">
                  Supabase is not configured yet. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` or their `VITE_` equivalents in `.env`.
                </p>
              </div>
            )}

            <motion.form layout onSubmit={handleSubmit} className="flex flex-col gap-4">
              <AnimatePresence initial={false}>
                {mode === 'sign-up' && (
                  <motion.div
                    layout
                    initial={{ opacity: 0, height: 0, y: -8 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -8 }}
                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2">
                      <label className="block font-ui text-xs uppercase tracking-[0.24em] text-white/55">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={event => setDisplayName(event.target.value.slice(0, 32))}
                        className="minimal-input font-ui text-lg"
                        placeholder="How the crew should know you"
                        autoComplete="name"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div layout className="space-y-2">
                <label className="block font-ui text-xs uppercase tracking-[0.24em] text-white/55">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  className="minimal-input font-ui text-lg"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </motion.div>

              <motion.div layout className="space-y-2">
                <label className="block font-ui text-xs uppercase tracking-[0.24em] text-white/55">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  className="minimal-input font-ui text-lg"
                  placeholder="Enter password"
                  autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                />
              </motion.div>

              {errorMessage && (
                <motion.p
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-[1.2rem] border border-vault-red/35 bg-vault-red/10 px-4 py-3 font-ui text-sm text-white/85"
                >
                  {errorMessage}
                </motion.p>
              )}

              {successMessage && (
                <motion.p
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-[1.2rem] border border-vault-green/35 bg-vault-green/10 px-4 py-3 font-ui text-sm text-white/85"
                >
                  {successMessage}
                </motion.p>
              )}

              <motion.button
                layout
                type="submit"
                disabled={!isConfigured || isSubmitting || !email.trim() || !password.trim() || (mode === 'sign-up' && !displayName.trim())}
                className="minimal-button-primary mt-2 w-full py-4 text-lg"
              >
                {isSubmitting ? 'Working...' : mode === 'sign-in' ? 'Enter Vault' : 'Create Account'}
              </motion.button>
            </motion.form>
          </motion.div>
        </motion.div>
      </div>
    </HostLayout>
  );
}
