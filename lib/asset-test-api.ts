import axios from "axios";
import type {
  InitResponse,
  ProjectVersionInfo,
  UploadFormData,
} from "./asset.type";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

const generateCuid = () => {
  return (
    "c" + Date.now().toString(36) + Math.random().toString(36).substring(2, 15)
  );
};

// ─── Asset & Version types ────────────────────────────────────────────────────

export interface Asset {
  id: string;
  name: string;
  orgId: string;
  assetType: "UNREAL_PROJECT" | "OTHER_3D";
  sourceType: string;
  uploadStatus: string;
  validationStatus: string;
  buildStatus: string;
  storageBucket: string;
  storagePath: string;
  createdAt: string;
  updatedAt: string;
  unrealProjects?: UnrealProject[];
  other3d?: Other3d[];
}

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

// ─── Upload API ───────────────────────────────────────────────────────────────

export const uploadApi = {
  // ── Asset list & detail ──────────────────────────────────────────────────

  getAllAssets: async (): Promise<Asset[]> => {
    const res = await axios.get(`${API_BASE}/assets`);
    return res.data.data;
  },

  getAsset: async (assetId: string): Promise<Asset> => {
    const res = await axios.get(`${API_BASE}/assets/${assetId}`);
    return res.data.data;
  },

  getVersionsByAsset: async (
    assetId: string,
  ): Promise<UnrealProjectVersion[]> => {
    const res = await axios.get(
      `${API_BASE}/unrealProjectVersion/asset/${assetId}`,
    );
    return res.data.data;
  },

  // ── Upload flow ──────────────────────────────────────────────────────────

  initiate: async (
    file: File,
    formData: UploadFormData,
  ): Promise<InitResponse> => {
    const orgId = generateCuid();
    const body: Record<string, unknown> = {
      orgId,
      assetType: formData.assetType,
      assetFilename: file.name,
      unrealProjectDisplayName: formData.displayName || file.name,
    };

    if (formData.assetType === "UNREAL_PROJECT") {
      body.unrealEngineVersion = formData.unrealEngineVersion;
      body.target = formData.target;
      body.selfPackaged = formData.selfPackaged;
      body.volumeRegions = ["ORD1", "LGA1", "LAS1"];
    }

    const res = await axios.post(`${API_BASE}/uploader/initiate`, body);
    return res.data.data;
  },

  getSignedUrl: async (
    orgId: string,
    assetId: string,
    assetVersionId: string,
    uploadId: string,
    objectName: string,
    partNumber: number,
  ): Promise<string> => {
    const res = await axios.post(`${API_BASE}/uploader/signed-url`, {
      orgId,
      assetId,
      assetVersionId,
      uploadId,
      objectName,
      partNumber,
    });
    return res.data.data.signedUrl;
  },

  /**
   * Get signed URLs for multiple parts in one request.
   * Returns a map of partNumber → signedUrl.
   */
  batchGetSignedUrls: async (
    orgId: string,
    assetId: string,
    assetVersionId: string,
    uploadId: string,
    objectName: string,
    partNumbers: number[],
  ): Promise<Record<number, string>> => {
    const res = await axios.post(`${API_BASE}/uploader/batch-signed-urls`, {
      orgId,
      assetId,
      assetVersionId,
      uploadId,
      objectName,
      partNumbers,
    });
    return res.data.data.signedUrls;
  },

  uploadPart: async (signedUrl: string, chunk: Blob): Promise<string> => {
    const res = await fetch(signedUrl, {
      method: "PUT",
      body: chunk,
    });

    if (!res.ok) {
      throw new Error(`Part upload failed with status ${res.status}`);
    }

    const etag = res.headers.get("ETag");
    if (!etag) {
      throw new Error("No ETag in response — check CORS exposes ETag header");
    }

    return etag.replace(/"/g, "");
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
    await axios.post(`${API_BASE}/uploader/complete`, {
      assetType,
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
    await axios.post(`${API_BASE}/uploader/abort`, {
      assetType,
      orgId,
      assetId,
      assetVersionId,
      uploadId,
      objectName,
    });
  },

  /**
   * Check the backend for an in-progress upload session matching this filename.
   * Returns session info if found, null otherwise.
   * Used on file-select to enable resume without localStorage.
   */
  getSession: async (
    filename: string,
  ): Promise<{
    orgId: string;
    assetId: string;
    assetVersionId: string;
    uploadId: string;
    objectName: string;
  } | null> => {
    try {
      const res = await axios.get(`${API_BASE}/uploader/session`, {
        params: { filename },
      });
      return res.data.data;
    } catch {
      return null;
    }
  },

  /**
   * List parts already uploaded to GCS for a multipart upload.
   * Gives the exact progress after a wifi disconnect or page refresh.
   */
  listParts: async (
    objectName: string,
    uploadId: string,
  ): Promise<{ partNumber: number; etag: string }[]> => {
    try {
      const res = await axios.post(`${API_BASE}/uploader/list-parts`, {
        objectName,
        uploadId,
      });
      return res.data.data.parts ?? [];
    } catch {
      return [];
    }
  },

  getProjectVersion: async (
    assetVersionId: string,
  ): Promise<ProjectVersionInfo> => {
    const res = await axios.get(
      `${API_BASE}/unrealProjectVersion/${assetVersionId}`,
    );
    return res.data.data;
  },
};