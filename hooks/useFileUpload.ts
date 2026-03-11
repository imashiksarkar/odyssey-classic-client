"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { uploadApi } from "@/lib/upload-api";
import {
  INITIAL_UPLOAD_STATE,
  getChunkSize,
  type UploadState,
  type UploadFormData,
} from "@/lib/upload";

// 10 concurrent part-upload workers. Each uploads directly to GCS in parallel.
// The bottleneck is outbound bandwidth, not CPU, so more workers = faster uploads.
const MAX_WORKERS = 10;
const MAX_RETRIES = 3;

export const useFileUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>(INITIAL_UPLOAD_STATE);
  const controlRef = useRef({ shouldStop: false });

  // Stable refs so persistent event listeners (online) always read latest values
  // without needing them in dependency arrays.
  const latestStateRef = useRef(state);
  const latestFileRef = useRef(file);
  latestStateRef.current = state;
  latestFileRef.current = file;

  const patchState = useCallback((patch: Partial<UploadState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  /**
   * On file select, query the backend for an active upload session matching
   * this filename. If found, recover the exact completed parts from GCS.
   * This replaces localStorage — works after page refresh, wifi disconnect,
   * or even switching browsers on the same account.
   */
  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);

    console.log(`[handleFileSelect] Looking for active session: "${selected.name}"`);
    const session = await uploadApi.getSession(selected.name);
    if (session) {
      console.log(`[handleFileSelect] Session found — recovering parts from GCS`, session);
      // Recover actual uploaded parts from GCS — source-of-truth after any disconnect
      const completedParts = await uploadApi.listParts(
        session.objectName,
        session.uploadId,
      );
      console.log(`[handleFileSelect] Recovered ${completedParts.length} completed parts — ready to resume`);
      const chunkSize = getChunkSize(selected.size);
      setState({
        ...INITIAL_UPLOAD_STATE,
        orgId: session.orgId,
        assetId: session.assetId,
        assetVersionId: session.assetVersionId,
        uploadId: session.uploadId,
        objectName: session.objectName,
        completedParts,
        totalBytes: selected.size,
        uploadedBytes: completedParts.length * chunkSize,
        status: "paused",
        fileName: selected.name,
        createdAt: Date.now(),
      });
    } else {
      console.log(`[handleFileSelect] No active session found for "${selected.name}" — starting fresh`);
      setState({ ...INITIAL_UPLOAD_STATE, totalBytes: selected.size });
    }
  };

  const performUpload = useCallback(
    async (fileOverride?: File, stateOverride?: UploadState) => {
      const activeFile = fileOverride ?? file;
      const activeState = stateOverride ?? state;
      if (!activeFile) return;

      controlRef.current.shouldStop = false;

      // Dynamic chunk size: fewer parts for large files = less overhead
      const chunkSize = getChunkSize(activeFile.size);

      try {
        let uploadId = activeState.uploadId;
        let objectName = activeState.objectName;
        let assetId = activeState.assetId;
        let versionId = activeState.assetVersionId;
        let orgId = activeState.orgId;
        let completedParts = activeState.completedParts ?? [];

        // Initiate a new upload if no session exists in state
        if (!uploadId || !assetId || !versionId || !orgId) {
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

        // Build the queue of parts not yet uploaded
        const totalParts = Math.ceil(activeFile.size / chunkSize);
        const completedPartNumbers = new Set(
          completedParts.map((p) => p.partNumber),
        );
        const queue: number[] = [];
        for (let i = 1; i <= totalParts; i++) {
          if (!completedPartNumbers.has(i)) queue.push(i);
        }

        // Tracks in-flight bytes for each part currently being uploaded.
        // Summed with completed-parts bytes to give real-time progress.
        const partProgressMap = new Map<number, number>();
        console.log(`[useFileUpload] Starting upload — totalParts: ${totalParts}, pending: ${queue.length}, chunkSize: ${chunkSize} bytes`);

        patchState({ status: "uploading" });

        // Pre-fetch signed URLs for ALL pending parts in a single request.
        // Previously: N round-trips to backend (one per part per worker).
        // Now: 1 request → backend generates all URLs in parallel → workers
        //      start uploading immediately without waiting for auth round-trips.
        const signedUrlMap = await uploadApi.batchGetSignedUrls(
          orgId,
          assetId,
          versionId,
          uploadId,
          objectName,
          queue,
        );

        const uploadPart = async (partNumber: number): Promise<void> => {
          const start = (partNumber - 1) * chunkSize;
          const end = Math.min(start + chunkSize, activeFile.size);
          const chunk = activeFile.slice(start, end);

          let attempts = 0;
          while (attempts < MAX_RETRIES) {
            try {
              // First attempt: use pre-fetched URL (no backend round-trip).
              // Retry: fetch a fresh URL in case the pre-fetched one expired.
              const signedUrl =
                attempts === 0
                  ? signedUrlMap[partNumber]
                  : await uploadApi.getSignedUrl(
                      orgId!,
                      assetId!,
                      versionId!,
                      uploadId!,
                      objectName!,
                      partNumber,
                    );

              const etag = await uploadApi.uploadPart(
                signedUrl,
                chunk,
                (loaded) => {
                  partProgressMap.set(partNumber, loaded);
                  const inFlight = [...partProgressMap.values()].reduce(
                    (sum, v) => sum + v,
                    0,
                  );
                  const uploadedBytes = completedParts.length * chunkSize + inFlight;
                  console.log(`[useFileUpload] part ${partNumber} in-flight: ${loaded}B | total uploadedBytes: ${uploadedBytes}`);
                  patchState({ uploadedBytes });
                },
              );
              partProgressMap.delete(partNumber);
              completedParts = [...completedParts, { partNumber, etag }];
              console.log(`[useFileUpload] part ${partNumber} complete — ${completedParts.length}/${totalParts} done`);
              patchState({
                completedParts,
                uploadedBytes: completedParts.length * chunkSize,
              });
              return;
            } catch (err) {
              attempts++;
              if (attempts >= MAX_RETRIES) throw err;
              await new Promise((r) => setTimeout(r, 1000 * attempts));
            }
          }
        };

        // Concurrency pool — MAX_WORKERS (10) parts upload simultaneously
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

        // All parts done — assemble on GCS
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

  // Keep a stable ref to performUpload so the wifi-reconnect handler
  // (registered once with empty deps) can always call the latest version.
  const performUploadRef = useRef(performUpload);
  performUploadRef.current = performUpload;

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
    // Set status immediately so the Resume button appears right away.
    // Workers will finish their current in-flight part then stop — the
    // completed bytes from those parts are saved normally.
    patchState({ status: "paused" });
  };

  const handleResume = () => {
    // State is held in-memory. If it was lost (page refresh), handleFileSelect
    // already recovered it from the backend + GCS.
    if (state.uploadId && state.assetId) {
      performUpload(file ?? undefined, state);
    } else {
      setState(INITIAL_UPLOAD_STATE);
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
      setState(INITIAL_UPLOAD_STATE);
    }
  };

  const handleReset = () => {
    setFile(null);
    setState(INITIAL_UPLOAD_STATE);
  };

  // ── Wifi reconnect: auto-resume if upload was interrupted by network loss ──
  // Registered once (empty deps). Reads latest state/file from refs to avoid
  // stale closures. Only fires when the browser transitions from offline→online.
  useEffect(() => {
    const onOnline = () => {
      const s = latestStateRef.current;
      const f = latestFileRef.current;
      if (s.status === "failed" && s.uploadId && s.assetId && f) {
        console.log(
          `[useFileUpload] Network reconnected — auto-resuming from ${
            s.completedParts?.length ?? 0
          } completed parts`,
        );
        // Resume using current completed parts as checkpoint.
        // GCS is the source of truth: any part that received an ETag before
        // the disconnect is in completedParts and won't be re-uploaded.
        performUploadRef.current(f, { ...s, error: null });
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []); // stable — reads from refs, no deps needed

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
