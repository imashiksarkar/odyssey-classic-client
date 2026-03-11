import axios from "axios";
import type {
  InitResponse,
  ProjectVersionInfo,
  UploadFormData,
} from "./upload";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

const generateCuid = () => {
  return (
    "c" + Date.now().toString(36) + Math.random().toString(36).substring(2, 15)
  );
};

export const uploadApi = {
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

  uploadPart: (
    signedUrl: string,
    chunk: Blob,
    onProgress?: (loaded: number) => void,
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", signedUrl);

      if (onProgress) {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) onProgress(e.loaded);
        });
      }

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader("ETag");
          if (!etag) {
            reject(new Error("No ETag in response — check CORS exposes ETag header"));
            return;
          }
          resolve(etag.replace(/"/g, ""));
        } else {
          reject(new Error(`Part upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => reject(new Error("Part upload network error")));
      xhr.addEventListener("abort", () => reject(new Error("Part upload aborted")));

      xhr.send(chunk);
    });
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
