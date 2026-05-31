export const CALM_CRYPTO_STATUS = 'local-only-phase';

export function describeCryptoPlan() {
  return {
    current: 'Phase one stores only this-browser demo data in localStorage.',
    next: 'Shared household records should be encrypted with a household key before Gun writes.',
    grounding: 'Grounding notes remain local-only by default and should not be synced automatically.'
  };
}

export async function encryptSharedRecord() {
  throw new Error('Shared encryption is intentionally not enabled in the local-only MVP.');
}

export async function decryptSharedRecord() {
  throw new Error('Shared encryption is intentionally not enabled in the local-only MVP.');
}
