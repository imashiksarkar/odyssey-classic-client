import type { UploadState } from "./asset.type";

// Upload state is now recovered from the backend on file re-select.
// localStorage is no longer used — this module is kept for API compatibility
// but performs no persistence.
export const uploadStorage = {
  getState: (): UploadState | null => null,
  setState: (_state: UploadState) => {},
  clearState: () => {},
  getOrgId: (): string | null => null,
  setOrgId: (_orgId: string) => {},
  clearOrgId: () => {},
  clearAll: () => {},
};
