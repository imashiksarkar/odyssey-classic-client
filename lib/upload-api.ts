import axios from "axios";
import type { UploadFormData, InitResponse } from "./upload";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:5001/api/v1";

console.log(API_BASE);

const generateCuid = () =>
  "c" + Date.now().toString(36) + Math.random().toString(36).substring(2, 15);

export const uploadApi = {
  generateOrgId: generateCuid,

  initiate: async (
    file: File,
    formData: UploadFormData,
  ): Promise<InitResponse & { orgId: string }> => {
    const orgId = generateCuid();
    const payload: Record<string, unknown> = {
      assetType: formData.assetType,
      assetFilename: file.name,
      orgId,
    };

    if (formData.assetType === "UNREAL_PROJECT") {
      payload.unrealProjectDisplayName = formData.displayName || file.name;
      payload.unrealEngineVersion = formData.unrealEngineVersion;
      payload.target = formData.target;
      payload.selfPackaged = formData.selfPackaged;
      payload.volumeRegions = formData.volumeRegions;
    } else {
      payload.other_3dDisplayName = formData.displayName || file.name;
    }

    const res = await axios.post(`${API_BASE}/uploader/initiate`, payload);
    const { assetId, assetVersionId, uploadUrl } = res.data.data;
    return { assetId, assetVersionId, uploadUrl, orgId };
  },

  resume: async (
    assetType: string,
    orgId: string,
    assetId: string,
    assetVersionId: string,
  ): Promise<string> => {
    const payload: Record<string, unknown> = {
      assetType,
      orgId,
      assetVersionId,
      ...(assetType === "UNREAL_PROJECT"
        ? { unrealProjectId: assetId }
        : { other_3dId: assetId }),
    };
    const res = await axios.post(`${API_BASE}/uploader/resume`, payload);
    return res.data.uploadUrl;
  },

  complete: async (
    assetType: string,
    orgId: string,
    assetId: string,
    assetVersionId: string,
    sha256Sum: string,
  ) => {
    await axios.post(`${API_BASE}/uploader/complete`, {
      assetType,
      orgId,
      assetId,
      assetVersionId,
      failed: false,
      sha256Sum,
    });
  },

  abort: async (
    assetType: string,
    orgId: string,
    assetId: string,
    assetVersionId: string,
  ) => {
    await axios.post(`${API_BASE}/uploader/abort`, {
      assetType,
      orgId,
      assetId,
      assetVersionId,
    });
  },

  delete: async (
    assetType: string,
    orgId: string,
    assetId: string,
    assetVersionId: string,
  ) => {
    await axios.delete(`${API_BASE}/uploader/delete`, {
      data: { assetType, orgId, assetId, assetVersionId },
    });
  },

  queryGCSOffset: async (
    uploadUrl: string,
    totalBytes: number,
  ): Promise<number> => {
    try {
      const res = await axios.put(uploadUrl, null, {
        headers: { "Content-Range": `bytes */${totalBytes}` },
        validateStatus: (s) => s === 308 || s === 200 || s === 201,
      });
      if (res.status === 308) {
        const range = res.headers["range"];
        if (range) {
          const match = range.match(/bytes=0-(\d+)/);
          if (match) return parseInt(match[1]) + 1;
        }
        return 0;
      }
      return 0;
    } catch {
      return 0;
    }
  },

  uploadChunk: async (
    uploadUrl: string,
    chunk: Blob,
    start: number,
    end: number,
    total: number,
    sha256: string,
  ) => {
    return axios.put(uploadUrl, chunk, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Range": `bytes ${start}-${end - 1}/${total}`,
        "X-SHA256": sha256,
      },
      validateStatus: (s) => (s >= 200 && s < 300) || s === 308,
    });
  },
};
