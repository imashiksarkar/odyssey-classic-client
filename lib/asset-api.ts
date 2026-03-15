import type {
  InitResponse,
  ProjectVersionInfo,
  UploadFormData,
} from "./asset.type";
import assetManager from "@/config/assetManager";
import type {
  AssetWithRelations,
  UnrealProjectVersion as SDKUnrealProjectVersion,
} from "@newgameplusinc/odyssey-asset-manager-sdk";

export type { AssetWithRelations as Asset } from "@newgameplusinc/odyssey-asset-manager-sdk";

export interface UnrealProject {
  assetId: string;
  orgId: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  unrealProjectVersion: string;
  unrealPluginVersion: string;
  versions?: UnrealProjectVersion[];
}

export interface Other3d {
  assetId: string;
  orgId: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  unrealPluginVersion: string;
}

export interface UnrealProjectVersion {
  id: string;
  orgId: string;
  name: string;
  state: string;
  selfPackaged: boolean;
  target: string;
  unrealEngineVersion?: string;
  volumeRegions: string[];
  volumeCopyRegionsComplete: string[];
  volumeSizeGb: number;
  appType: string;
  buildRegion?: string;
  levelName?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** SDK returns Date objects; pages expect ISO strings. Normalise here. */
function normaliseVersion(v: SDKUnrealProjectVersion): UnrealProjectVersion {
  return {
    ...v,
    createdAt:
      v.createdAt instanceof Date ? v.createdAt.toISOString() : v.createdAt,
    updatedAt:
      v.updatedAt instanceof Date ? v.updatedAt.toISOString() : v.updatedAt,
    unrealEngineVersion: v.unrealEngineVersion ?? undefined,
    buildRegion: v.buildRegion ?? undefined,
    levelName: v.levelName ?? undefined,
  };
}

// ─── Asset API ───────────────────────────────────────────────────────────────

export const assetApi = {
  // ── Asset list & detail ──────────────────────────────────────────────────

  getAllAssets: (): Promise<AssetWithRelations[]> =>
    assetManager.getAllAssets(),

  getAsset: (assetId: string): Promise<AssetWithRelations> =>
    assetManager.getAsset(assetId),

  getVersionsByAsset: async (
    assetId: string,
  ): Promise<UnrealProjectVersion[]> => {
    const versions = await assetManager.getVersionsByAsset(assetId);
    return versions.map(normaliseVersion);
  },

  // ── Upload flow ──────────────────────────────────────────────────────────

  /**
   * Initiates a multipart upload session.
   * Requires orgId and userId from credentials — both must be set in formData
   * before this is called.
   */
  initiate: async (
    file: File,
    formData: UploadFormData,
    userId: string,
  ): Promise<InitResponse> => {
    if (!formData.orgId)
      throw new Error("orgId is required to initiate upload");

    const res = await assetManager.initiateUpload({
      orgId: formData.orgId,
      userId: userId,
      assetType: formData.assetType,
      assetFilename: file.name,
      unrealProjectDisplayName: formData.displayName || file.name,
      ...(formData.assetType === "UNREAL_PROJECT" && {
        selfPackaged: formData.selfPackaged,
        volumeRegions: ["ORD1", "LGA1", "LAS1"],
      }),
    });

    return {
      uploadId: res.uploadId,
      objectName: res.objectName,
      assetId: res.assetId,
      assetVersionId: res.assetVersionId,
      orgId: res.orgId,
    };
  },

  getSignedUrl: (
    orgId: string,
    assetId: string,
    assetVersionId: string,
    uploadId: string,
    objectName: string,
    partNumber: number,
  ): Promise<string> =>
    assetManager.getSignedUrl(
      orgId,
      assetId,
      assetVersionId,
      uploadId,
      objectName,
      partNumber,
    ),

  batchGetSignedUrls: (
    orgId: string,
    assetId: string,
    assetVersionId: string,
    uploadId: string,
    objectName: string,
    partNumbers: number[],
  ): Promise<Record<number, string>> =>
    assetManager.batchGetSignedUrls(
      orgId,
      assetId,
      assetVersionId,
      uploadId,
      objectName,
      partNumbers,
    ),

  /**
   * XHR-based part upload — kept outside the SDK because it needs
   * fine-grained progress events and an abortable handle.
   */
  uploadPart: (
    signedUrl: string,
    chunk: Blob,
    onProgress?: (loaded: number) => void,
  ): { promise: Promise<string>; xhr: XMLHttpRequest } => {
    const xhr = new XMLHttpRequest();
    const promise = new Promise<string>((resolve, reject) => {
      xhr.open("PUT", signedUrl);

      console.log(
        `[uploadPart] Starting XHR PUT, chunk size: ${chunk.size} bytes`,
      );

      if (onProgress) {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) onProgress(e.loaded);
        });
      }

      xhr.upload.addEventListener("loadstart", () =>
        console.log("[uploadPart] XHR upload loadstart"),
      );
      xhr.upload.addEventListener("loadend", () =>
        console.log("[uploadPart] XHR upload loadend"),
      );

      xhr.addEventListener("load", () => {
        console.log(`[uploadPart] XHR load — status: ${xhr.status}`);
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader("ETag");
          if (!etag) {
            reject(
              new Error("No ETag in response — check CORS exposes ETag header"),
            );
            return;
          }
          resolve(etag.replace(/"/g, ""));
        } else {
          reject(new Error(`Part upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () =>
        reject(new Error("Part upload network error")),
      );
      xhr.addEventListener("abort", () => reject(new Error("__ABORTED__")));

      xhr.send(chunk);
    });
    return { promise, xhr };
  },

  complete: async (
    assetType: string,
    orgId: string,
    assetId: string,
    assetVersionId: string,
    uploadId: string,
    objectName: string,
    parts: { partNumber: number; etag: string }[],
  ): Promise<void> => {
    await assetManager.completeUpload({
      assetType: assetType as "UNREAL_PROJECT" | "OTHER_3D",
      orgId,
      assetId,
      assetVersionId,
      uploadId,
      objectName,
      parts,
    });
  },

  abort: async (
    assetType: string,
    orgId: string,
    assetId: string,
    assetVersionId: string,
    uploadId: string,
    objectName: string,
  ): Promise<void> => {
    await assetManager.abortUpload({
      assetType: assetType as "UNREAL_PROJECT" | "OTHER_3D",
      orgId,
      assetId,
      assetVersionId,
      uploadId,
      objectName,
    });
  },

  getSession: (
    filename: string,
  ): Promise<{
    orgId: string;
    assetId: string;
    assetVersionId: string;
    uploadId: string;
    objectName: string;
  } | null> => assetManager.getUploadSession(filename),

  listParts: (
    objectName: string,
    uploadId: string,
  ): Promise<{ partNumber: number; etag: string }[]> =>
    assetManager.listUploadedParts(objectName, uploadId),

  getProjectVersion: async (
    assetVersionId: string,
  ): Promise<ProjectVersionInfo> => {
    const v = await assetManager.getProjectVersion(assetVersionId);
    return {
      id: v.id,
      state: v.state,
      selfPackaged: v.selfPackaged,
      name: v.name,
      unrealEngineVersion: v.unrealEngineVersion ?? undefined,
      target: v.target,
      volumeRegions: v.volumeRegions,
      volumeCopyRegionsComplete: v.volumeCopyRegionsComplete,
      createdAt:
        v.createdAt instanceof Date ? v.createdAt.toISOString() : v.createdAt,
      updatedAt:
        v.updatedAt instanceof Date ? v.updatedAt.toISOString() : v.updatedAt,
    };
  },
};
