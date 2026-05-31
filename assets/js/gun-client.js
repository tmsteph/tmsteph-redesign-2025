export const GUN_PEERS = ['https://peer.tmsteph.com/gun'];

export function createGunClient({ Gun: GunLib = globalThis.Gun, peers = GUN_PEERS } = {}) {
  if (!GunLib) {
    return {
      gun: null,
      user: null,
      available: false,
      reason: 'Gun is not loaded in this local-only phase.'
    };
  }

  const gun = GunLib({
    peers,
    localStorage: true
  });

  return {
    gun,
    user: gun.user(),
    available: true,
    reason: ''
  };
}
