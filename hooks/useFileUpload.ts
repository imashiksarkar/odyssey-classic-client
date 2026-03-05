"use client";

import { useState, useRef, useCallback } from "react";
import * as crypto from "crypto-js";
import { AxiosError } from "axios";
import { uploadApi } from "@/lib/upload-api";
import { uploadStorage } from "@/lib/upload-storage";
import {
  CHUNK_SIZE,
  INITIAL_UPLOAD_STATE,
  type UploadState,
  type UploadFormData,
} from "@/lib/upload";

export const useFileUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>(INITIAL_UPLOAD_STATE);
  const controlRef = useRef({ shouldStop: false });

  const patchState = useCallback((patch: Partial<UploadState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      uploadStorage.setState(next);
      return next;
    });
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    patchState({ ...INITIAL_UPLOAD_STATE, totalBytes: selected.size });
  };

  const computeSha256 = async (blob: Blob): Promise<string> => {
    const buf = await blob.arrayBuffer();
    const wordArray = crypto.lib.WordArray.create(buf);
    return crypto.SHA256(wordArray).toString();
  };

  const performUpload = useCallback(
    async (fileOverride?: File, stateOverride?: UploadState) => {
      const activeFile = fileOverride ?? file;
      const activeState = stateOverride ?? state;
      if (!activeFile) return;

      controlRef.current.shouldStop = false;

      try {
        let uploadUrl = activeState.uploadUrl;
        let assetId = activeState.assetId;
        let versionId = activeState.assetVersionId;
        let orgId = activeState.orgId;

        if (!uploadUrl || !assetId || !versionId || !orgId) {
          const formSnapshot = formDataRef.current;
          const initiated = await uploadApi.initiate(activeFile, formSnapshot);
          uploadUrl = initiated.uploadUrl;
          assetId = initiated.assetId;
          versionId = initiated.assetVersionId;
          orgId = initiated.orgId;
          patchState({ orgId, assetId, assetVersionId: versionId, uploadUrl });
        }

        if (!uploadUrl || !assetId || !versionId || !orgId) {
          throw new Error("Upload session could not be established");
        }

        let uploadedBytes = await uploadApi.queryGCSOffset(
          uploadUrl,
          activeFile.size,
        );
        patchState({ uploadedBytes, status: "uploading" });

        while (
          uploadedBytes < activeFile.size &&
          !controlRef.current.shouldStop
        ) {
          const start = uploadedBytes;
          const end = Math.min(start + CHUNK_SIZE, activeFile.size);
          const chunk = activeFile.slice(start, end);
          const sha256 = await computeSha256(chunk);

          try {
            const res = await uploadApi.uploadChunk(
              uploadUrl,
              chunk,
              start,
              end,
              activeFile.size,
              sha256,
            );

            if (res.status === 200 || res.status === 201) {
              patchState({
                uploadedBytes: activeFile.size,
                status: "completed",
              });
              const fullSha = await computeSha256(activeFile);
              await uploadApi.complete(
                formDataRef.current.assetType,
                orgId,
                assetId,
                versionId,
                fullSha,
              );
              uploadStorage.clearAll();
              return;
            }

            if (res.status === 308) {
              const range = res.headers.get("range");
              if (range) {
                const match = range.match(/bytes=0-(\d+)/);
                if (match) {
                  uploadedBytes = parseInt(match[1]) + 1;
                } else {
                  uploadedBytes = end;
                }
              } else {
                uploadedBytes = end;
              }
              patchState({ uploadedBytes });
            }
          } catch (err) {
            if (err instanceof AxiosError && err.response?.status === 410) {
              uploadUrl = await uploadApi.resume(
                formDataRef.current.assetType,
                orgId,
                assetId,
                versionId,
              );
              patchState({ uploadUrl });
              continue;
            }
            throw err;
          }
        }

        if (controlRef.current.shouldStop) {
          patchState({ status: "paused" });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        patchState({ status: "failed", error: message });
      }
    },
    [file, state, patchState],
  );

  const formDataRef = useRef<UploadFormData>({
    assetType: "UNREAL_PROJECT",
    displayName: "",
    unrealEngineVersion: "5.2.1",
    target: "Development",
    selfPackaged: true,
    volumeRegions: ["ORD1", "LGA1", "LAS1"],
  });

  const [formData, setFormDataState] = useState<UploadFormData>(
    formDataRef.current,
  );

  const setFormData = (patch: Partial<UploadFormData>) => {
    const next = { ...formDataRef.current, ...patch };
    formDataRef.current = next;
    setFormDataState(next);
  };

  const handleStart = () => {
    patchState({ status: "uploading", error: null });
    performUpload();
  };

  const handlePause = () => {
    controlRef.current.shouldStop = true;
  };

  const handleResume = () => {
    const saved = uploadStorage.getState();
    if (saved) performUpload(file ?? undefined, saved);
  };

  const handleRetry = () => {
    patchState({ error: null });
    performUpload();
  };

  const handleAbort = async () => {
    controlRef.current.shouldStop = true;
    const orgId = state.orgId; // ✅ read from state
    if (!orgId || !state.assetId || !state.assetVersionId) return;

    try {
      await uploadApi.abort(
        formData.assetType,
        orgId,
        state.assetId,
        state.assetVersionId,
      );
    } finally {
      uploadStorage.clearAll();
      setState(INITIAL_UPLOAD_STATE);
    }
  };

  const handleReset = () => {
    setFile(null);
    uploadStorage.clearAll();
    setState(INITIAL_UPLOAD_STATE);
  };

  const progress =
    state.totalBytes > 0 ? (state.uploadedBytes / state.totalBytes) * 100 : 0;

  return {
    file,
    formData,
    state,
    progress,
    setFormData,
    handleFileSelect,
    handleStart,
    handlePause,
    handleResume,
    handleRetry,
    handleAbort,
    handleReset,
  };
};
