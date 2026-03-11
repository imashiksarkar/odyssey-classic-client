import type { UploadState } from "./asset.type";

const STATE_KEY = "uploadState";
const ORG_KEY = "uploadOrgId";

export const uploadStorage = {
  getState: (): UploadState | null => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem(STATE_KEY);
    return saved ? JSON.parse(saved) : null;
  },

  setState: (state: UploadState) => {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  },

  clearState: () => {
    localStorage.removeItem(STATE_KEY);
  },

  getOrgId: (): string | null => {
    return localStorage.getItem(ORG_KEY);
  },

  setOrgId: (orgId: string) => {
    localStorage.setItem(ORG_KEY, orgId);
  },

  clearOrgId: () => {
    localStorage.removeItem(ORG_KEY);
  },

  clearAll: () => {
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(ORG_KEY);
  },
};
