import { api } from '/js/api.js';

export const shortAddr = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// Vincula la wallet del jugador demostrando que la controla (firma de un mensaje: gratis, sin gas)
export async function linkWallet() {
  if (!window.ethereum) {
    throw new Error('No se detectó ninguna wallet. Abre esta página desde el navegador de tu wallet (MetaMask, Trust Wallet, Coinbase Wallet…).');
  }
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  const address = accounts && accounts[0];
  if (!address) throw new Error('No se seleccionó ninguna cuenta.');
  const { message } = await api('/api/wallet/nonce', { method: 'POST', body: { address } });
  const signature = await window.ethereum.request({ method: 'personal_sign', params: [message, address] });
  return api('/api/wallet/link', { method: 'POST', body: { address, signature } });
}
