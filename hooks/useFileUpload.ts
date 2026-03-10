"use client";

import { useState, useRef, useCallback } from "react";
import { uploadApi } from "@/lib/upload-api";
import { uploadStorage } from "@/lib/upload-storage";
import {
  INITIAL_UPLOAD_STATE,
  isUploadExpired,
  type UploadState,
  type UploadFormData,
  CHUNK_SIZE,
} from "@/lib/upload";

const MAX_WORKERS = 5;
const MAX_RETRIES = 3;

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

    const saved = uploadStorage.getState();
    if (
      saved &&
      saved.assetId &&
      saved.status === "paused" &&
      !isUploadExpired(saved.createdAt) &&
      saved.fileName === selected.name // match by filename
    ) {
      // Offer resume — don't auto-start, just restore state
      setState({ ...saved, totalBytes: selected.size });
    } else {
      uploadStorage.clearAll();
      patchState({ ...INITIAL_UPLOAD_STATE, totalBytes: selected.size });
    }
  };
  const performUpload = useCallback(
    async (fileOverride?: File, stateOverride?: UploadState) => {
      const activeFile = fileOverride ?? file;
      const activeState = stateOverride ?? state;
      if (!activeFile) return;

      controlRef.current.shouldStop = false;

      try {
        let uploadId = activeState.uploadId;
        let objectName = activeState.objectName;
        let assetId = activeState.assetId;
        let versionId = activeState.assetVersionId;
        let orgId = activeState.orgId;
        let completedParts = activeState.completedParts ?? [];

        // Initiate if no saved session or expired
        if (
          !uploadId ||
          !assetId ||
          !versionId ||
          !orgId ||
          isUploadExpired(activeState.createdAt)
        ) {
          const initiated = await uploadApi.initiate(
            activeFile,
            formDataRef.current,
          );
          uploadId = initiated.uploadId;
          objectName = initiated.objectName;
          assetId = initiated.assetId;
          versionId = initiated.assetVersionId;
          orgId = initiated.orgId;
          completedParts = [];
          patchState({
            orgId,
            assetId,
            assetVersionId: versionId,
            uploadId,
            objectName,
            completedParts: [],
            createdAt: Date.now(),
            fileName: activeFile.name,
            status: "uploading",
          });
        }

        if (!uploadId || !objectName || !assetId || !versionId || !orgId) {
          throw new Error("Upload session could not be established");
        }

        // Build part queue
        const chunkSize = CHUNK_SIZE;
        const totalParts = Math.ceil(activeFile.size / chunkSize);
        const completedPartNumbers = new Set(
          completedParts.map((p) => p.partNumber),
        );
        const queue: number[] = [];
        for (let i = 1; i <= totalParts; i++) {
          if (!completedPartNumbers.has(i)) queue.push(i);
        }

        patchState({ status: "uploading" });

        // Worker function
        const uploadPart = async (partNumber: number): Promise<void> => {
          const start = (partNumber - 1) * chunkSize;
          const end = Math.min(start + chunkSize, activeFile.size);
          const chunk = activeFile.slice(start, end);

          let attempts = 0;
          while (attempts < MAX_RETRIES) {
            try {
              const signedUrl = await uploadApi.getSignedUrl(
                orgId!,
                assetId!,
                versionId!,
                uploadId!,
                objectName!,
                partNumber,
              );

              const etag = await uploadApi.uploadPart(signedUrl, chunk);

              // Save completed part
              completedParts = [...completedParts, { partNumber, etag }];
              patchState({
                completedParts,
                uploadedBytes: completedParts.length * chunkSize,
              });
              return;
            } catch (err) {
              attempts++;
              if (attempts >= MAX_RETRIES) throw err;
              // Wait before retry — exponential backoff
              await new Promise((r) => setTimeout(r, 1000 * attempts));
            }
          }
        };

        // Concurrency pool — max 5 workers
        const runPool = async (): Promise<void> => {
          let index = 0;

          const worker = async (): Promise<void> => {
            while (true) {
              const i = index++;
              if (i >= queue.length) return;
              if (controlRef.current.shouldStop) return;
              await uploadPart(queue[i]);
            }
          };

          const workers = Array.from(
            { length: Math.min(MAX_WORKERS, queue.length) },
            () => worker(),
          );
          await Promise.all(workers);
        };

        await runPool();

        if (controlRef.current.shouldStop) {
          patchState({ status: "paused" });
          return;
        }

        // All parts done — complete upload
        const sortedParts = [...completedParts].sort(
          (a, b) => a.partNumber - b.partNumber,
        );

        await uploadApi.complete(
          formDataRef.current.assetType,
          orgId,
          assetId,
          versionId,
          uploadId,
          objectName,
          sortedParts,
        );

        patchState({ uploadedBytes: activeFile.size, status: "completed" });
        uploadStorage.clearAll();
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
    if (saved && !isUploadExpired(saved.createdAt)) {
      performUpload(file ?? undefined, saved);
    } else {
      uploadStorage.clearAll();
      patchState(INITIAL_UPLOAD_STATE);
    }
  };

  const handleRetry = () => {
    patchState({ error: null });
    performUpload();
  };

  const handleAbort = async () => {
    controlRef.current.shouldStop = true;
    const { orgId, assetId, assetVersionId, uploadId, objectName } = state;
    if (!orgId || !assetId || !assetVersionId || !uploadId || !objectName)
      return;

    try {
      await uploadApi.abort(
        formData.assetType,
        orgId,
        assetId,
        assetVersionId,
        uploadId,
        objectName,
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
    state.totalBytes > 0
      ? Math.min((state.uploadedBytes / state.totalBytes) * 100, 100)
      : 0;

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
