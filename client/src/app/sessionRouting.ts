import { getBrowserStorage } from '@/shared/services/browserStorage';

const STORAGE_KEYS = {
  roomCode: 'heist_room_code',
  playerId: 'heist_player_id',
  playerName: 'heist_player_name',
  hostRoomCode: 'heist_host_room_code',
} as const;

export interface StoredPlayerSession {
  roomCode: string;
  playerId: string;
  playerName: string;
}

export function getStoredPlayerSession(): StoredPlayerSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storage = getBrowserStorage();
  const roomCode = storage.getItem(STORAGE_KEYS.roomCode)?.trim().toUpperCase() ?? '';
  const playerId = storage.getItem(STORAGE_KEYS.playerId)?.trim() ?? '';
  const playerName = storage.getItem(STORAGE_KEYS.playerName)?.trim() ?? '';
  const hostRoomCode = storage.getItem(STORAGE_KEYS.hostRoomCode)?.trim().toUpperCase() ?? '';

  if (!roomCode || !playerId || !playerName || hostRoomCode === roomCode) {
    return null;
  }

  return {
    roomCode,
    playerId,
    playerName,
  };
}

export function getStoredPlayerRoute() {
  return getStoredPlayerSession() ? '/play' : null;
}
