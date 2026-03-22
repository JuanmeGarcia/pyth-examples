import { MeshWallet, resolvePaymentKeyHash } from "@meshsdk/core";
import { getScript } from "./script.js";
import { getProvider } from "./txBuilder.js";
import { NETWORK, WALLET_MNEMONIC } from "../config.js";

let wallet: MeshWallet | null = null;

function getMnemonicWords(): string[] {
  const words = WALLET_MNEMONIC.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    throw new Error("WALLET_MNEMONIC is not configured");
  }
  return words;
}

export function getWallet(): MeshWallet {
  if (!wallet) {
    wallet = new MeshWallet({
      networkId: NETWORK === "mainnet" ? 1 : 0,
      fetcher: getProvider(),
      submitter: getProvider(),
      key: {
        type: "mnemonic",
        words: getMnemonicWords(),
      },
    });
  }
  return wallet;
}

export async function getWalletInfo() {
  const instance = getWallet();
  const address = await instance.getChangeAddress();
  const pkh = resolvePaymentKeyHash(address);
  const { scriptAddress } = getScript();

  return {
    address,
    pkh,
    scriptAddress,
    network: NETWORK[0].toUpperCase() + NETWORK.slice(1),
  };
}

export async function getWalletUtxos() {
  const instance = getWallet();
  return instance.getUtxos();
}

export async function signAndSubmit(unsignedTx: string) {
  const instance = getWallet();
  const signedTx = await instance.signTx(unsignedTx);
  return instance.submitTx(signedTx);
}
