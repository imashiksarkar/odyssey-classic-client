export interface DBRes {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  photoURL: string | null;
  pending: boolean;
  anonymous: boolean;
  bodyHeight: string | null;
  bodyShape: string | null;
  clothingIdBottom: string | null;
  clothingIdShoes: string | null;
  clothingIdTop: string | null;
  clothingIdMaterial: string | null;
  skullId: string | null;
  additionalInfo: Record<string, unknown> | null;
  skull: string | null;
  clothingTop: string | null;
  clothingBottom: string | null;
  clothingShoes: string | null;
  clothingMaterial: string | null;
  deviceId: string;
  userId: string;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface ProfileRes {
  statusCode: number;
  success: boolean;
  message: string;
  data: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    photoURL: null;
    pending: boolean;
    anonymous: boolean;
    bodyHeight: null;
    bodyShape: null;
    clothingIdBottom: null;
    clothingIdShoes: null;
    clothingIdTop: null;
    clothingIdMaterial: null;
    skullId: null;
    additionalInfo: null;
    bodyId: null;
    skinColor: null;
    eyeColor: null;
    hairId: null;
    hairColor: null;
    clothingIdMaterialBottom: null;
    clothingIdMaterialShoes: null;
    skull: null;
    clothingTop: null;
    clothingBottom: null;
    clothingShoes: null;
    clothingMaterial: null;
    body: null;
    clothingMaterialBottom: null;
    clothingMaterialShoes: null;
    hair: null;
    deviceId: string;
  };
}

export type Profile = ProfileRes["data"];

export interface RefTokenRes {
  statusCode: number;
  success: boolean;
  message: string;
  data: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface SdkKeysRes {
  statusCode: number;
  success: boolean;
  message: string;
  data: {
    id: string;
    subscriptionId: string;
    sdkKey: string;
    userId: string;
    serviceType: string;
    isActive: boolean;
    activateAt: Date;
    expiresAt: null;
    createdAt: Date;
    updatedAt: Date;
  }[];
}
