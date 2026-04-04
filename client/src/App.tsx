import { Routes, Route, Navigate } from 'react-router-dom';
import { HostApp } from '@/host/HostApp';
import { PhoneApp } from '@/phone/PhoneApp';
import { GameProvider } from '@/context/GameProvider';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { AuthView } from '@/auth/views/AuthView';
import { RequireAuth } from '@/auth/components/RequireAuth';
import { AppFlowProvider, useAppFlow } from '@/app/AppFlowContext';
import { StartFlowView } from '@/app/views/StartFlowView';
import { RealStartView } from '@/app/views/RealStartView';
import { AudioSettingsProvider } from '@/shared/context/AudioSettingsContext';
import { useAccentButtonClickSound } from '@/shared/hooks/useAccentButtonClickSound';

function AccentButtonClickSound() {
  useAccentButtonClickSound();
  return null;
}

function RootRedirect() {
  const { user, isLoading } = useAuth();
  const { isReady } = useAppFlow();

  if (isLoading || !isReady) {
    return null;
  }

  return <Navigate to={user ? '/host' : '/auth'} replace />;
}

function StartRoute() {
  return <StartFlowView />;
}

function RealRoute() {
  return <RealStartView />;
}

function AuthRoute() {
  return <AuthView />;
}

function HostRoute() {
  return (
    <RequireAuth>
      <HostApp />
    </RequireAuth>
  );
}

export function App() {
  return (
    <AudioSettingsProvider>
      <AppFlowProvider>
        <AuthProvider>
          <GameProvider>
            <AccentButtonClickSound />
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/start" element={<StartRoute />} />
              <Route path="/real" element={<RealRoute />} />
              <Route path="/auth" element={<AuthRoute />} />
              <Route path="/host/*" element={<HostRoute />} />
              <Route path="/play/*" element={<PhoneApp />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </GameProvider>
        </AuthProvider>
      </AppFlowProvider>
    </AudioSettingsProvider>
  );
}
