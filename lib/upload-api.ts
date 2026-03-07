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
    // backend wraps response in { data, message, statusCode, success }
    return res.data.data;
  },

  resume: async (
    assetType: string,
    orgId: string,
    assetId: string,
    assetVersionId: string,
  ): Promise<string> => {
    const res = await axios.post(`${API_BASE}/uploader/resume`, {
      assetType,
      orgId,
      assetId,
      assetVersionId,
    });
    return res.data.data.uploadUrl;
  },

  complete: async (
    assetType: string,
    orgId: string,
    assetId: string,
    assetVersionId: string,
    sha256Sum: string,
  ): Promise<void> => {
    await axios.post(`${API_BASE}/uploader/complete`, {
      assetType,
      orgId,
      assetId,
      assetVersionId,
      sha256Sum,
    });
  },

  abort: async (
    assetType: string,
    orgId: string,
    assetId: string,
    assetVersionId: string,
  ): Promise<void> => {
    await axios.post(`${API_BASE}/uploader/abort`, {
      assetType,
      orgId,
      assetId,
      assetVersionId,
    });
  },

  queryGCSOffset: async (
    uploadUrl: string,
    totalSize: number,
  ): Promise<number> => {
    try {
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Range": `bytes */${totalSize}` },
      });
      if (res.status === 308) {
        const range = res.headers.get("range");
        if (range) {
          const match = range.match(/bytes=0-(\d+)/);
          if (match) return parseInt(match[1]) + 1;
        }
        return 0;
      }
      if (res.status === 200 || res.status === 201) return totalSize;
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
    return fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Range": `bytes ${start}-${end - 1}/${total}`,
        "X-SHA256": sha256,
      },
      body: chunk,
    }).then((res) => ({ status: res.status, headers: res.headers }));
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
