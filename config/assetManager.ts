import { AssetManagerSDK } from "@newgameplusinc/odyssey-asset-manager-sdk";

const assetManager = new AssetManagerSDK({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE!,
  timeout: 30000,
  sdkKey: process.env.NEXT_PUBLIC_ASSET_SDK_KEY,
});

export default assetManager;
