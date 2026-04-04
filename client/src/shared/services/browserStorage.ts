type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const noopStorage: BrowserStorage = {
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {},
};

export function getBrowserStorage(): BrowserStorage {
  if (typeof window === 'undefined') {
    return noopStorage;
  }

  return window.sessionStorage;
}

