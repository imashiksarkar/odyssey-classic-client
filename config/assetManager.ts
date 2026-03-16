import { AssetManagerSDK } from "@newgameplusinc/odyssey-asset-manager-sdk";

let assetManager: AssetManagerSDK | null = null;

const getAssetManager = (sdkKey?: string | null) => {
  if (assetManager) return assetManager;

  if (!sdkKey) return null;

  assetManager = new AssetManagerSDK({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE!,
    timeout: 30000,
    sdkKey,
  });

  return assetManager;
};

export default getAssetManager;
