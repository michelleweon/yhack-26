import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-vault-darker px-6">
      <div className="soft-glass-panel rounded-[2rem] px-8 py-6 text-center">
        <p className="font-ui text-xs uppercase tracking-[0.32em] text-white/45">
          Syncing Session
        </p>
        <h1 className="mt-3 font-title text-4xl text-vault-gold">R.A.C.C.O.O.N.</h1>
      </div>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
