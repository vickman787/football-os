export const X_LAYER = {
  chainId: 196,
  chainIdHex: '0xc4',
  chainName: 'X Layer Mainnet',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: ['https://rpc.xlayer.tech'],
  blockExplorerUrls: ['https://www.okx.com/web3/explorer/xlayer'],
};

export const X_LAYER_TESTNET = {
  chainId: 195,
  chainIdHex: '0xc3',
  chainName: 'X Layer Testnet',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: ['https://testrpc.xlayer.tech'],
  blockExplorerUrls: ['https://www.okx.com/web3/explorer/xlayer-test'],
};

export async function connectAndSwitch(target = X_LAYER) {
  if (!window.ethereum) throw new Error('No EVM wallet detected. Install MetaMask or OKX Wallet.');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  const current = await window.ethereum.request({ method: 'eth_chainId' });
  if (current !== target.chainIdHex) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: target.chainIdHex }],
      });
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: target.chainIdHex,
            chainName: target.chainName,
            nativeCurrency: target.nativeCurrency,
            rpcUrls: target.rpcUrls,
            blockExplorerUrls: target.blockExplorerUrls,
          }],
        });
      } else {
        throw err;
      }
    }
  }
  return { address: accounts[0], chainId: target.chainId };
}
