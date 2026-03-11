"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { uploadApi } from "@/lib/asset-api";
import {
  INITIAL_UPLOAD_STATE,
  getChunkSize,
  type UploadState,
  type UploadFormData,
  ,
} from "@/lib/asset.type";

// 10 concurrent part-upload workers. Each uploads directly to GCS in parallel.
// The bottleneck is outbound bandwidth, not CPU, so more workers = faster uploads.
const MAX_WORKERS = 10;
const MAX_RETRIES = 6; // Higher to survive a brief wifi drop + reconnect

export const useFileUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>(INITIAL_UPLOAD_STATE);
  const controlRef = useRef({ shouldStop: false });
  // All XHRs that are currently in-flight. Abort all of them on pause.
  const activeXhrsRef = useRef<Set<XMLHttpRequest>>(new Set());

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
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);

    console.log(
      `[handleFileSelect] Looking for active session: "${selected.name}"`,
    );
    const session = await uploadApi.getSession(selected.name);
    if (session) {
      console.log(
        `[handleFileSelect] Session found — recovering parts from GCS`,
        session,
      );
      // Recover actual uploaded parts from GCS — source-of-truth after any disconnect
      const completedParts = await uploadApi.listParts(
        session.objectName,
        session.uploadId,
      );
      console.log(
        `[handleFileSelect] Recovered ${completedParts.length} completed parts — ready to resume`,
      );
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
        sessionRecovered: true,
      });
    } else {
      console.log(
        `[handleFileSelect] No active session found for "${selected.name}" — starting fresh`,
      );
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
        console.log(
          `[useFileUpload] Starting upload — totalParts: ${totalParts}, pending: ${queue.length}, chunkSize: ${chunkSize} bytes`,
        );

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

              const { promise, xhr } = uploadApi.uploadPart(
                signedUrl,
                chunk,
                (loaded) => {
                  partProgressMap.set(partNumber, loaded);
                  const inFlight = [...partProgressMap.values()].reduce(
                    (sum, v) => sum + v,
                    0,
                  );
                  const uploadedBytes =
                    completedParts.length * chunkSize + inFlight;
                  console.log(
                    `[useFileUpload] part ${partNumber} in-flight: ${loaded}B | total uploadedBytes: ${uploadedBytes}`,
                  );
                  patchState({ uploadedBytes });
                },
              );
              activeXhrsRef.current.add(xhr);
              let etag: string;
              try {
                etag = await promise;
              } catch (err) {
                activeXhrsRef.current.delete(xhr);
                partProgressMap.delete(partNumber);
                // __ABORTED__ means pause was clicked — stop silently, part not saved.
                // Worker exits; resume will re-queue this part.
                if (err instanceof Error && err.message === "__ABORTED__")
                  return;
                throw err;
              }
              activeXhrsRef.current.delete(xhr);
              partProgressMap.delete(partNumber);
              completedParts = [...completedParts, { partNumber, etag }];
              console.log(
                `[useFileUpload] part ${partNumber} complete — ${completedParts.length}/${totalParts} done`,
              );
              patchState({
                completedParts,
                uploadedBytes: completedParts.length * chunkSize,
              });
              return;
            } catch (err) {
              attempts++;
              if (attempts >= MAX_RETRIES) throw err;
              // If we're offline, wait until the browser reports online before
              // retrying — no point hammering with retries while disconnected.
              if (!navigator.onLine) {
                console.log(
                  `[uploadPart] Offline — waiting for reconnect before retry (attempt ${attempts})`,
                );
                await new Promise<void>((resolve) => {
                  const onOnline = () => {
                    window.removeEventListener("online", onOnline);
                    resolve();
                  };
                  window.addEventListener("online", onOnline);
                });
                console.log(
                  `[uploadPart] Back online — retrying part ${partNumber}`,
                );
              } else {
                await new Promise((r) => setTimeout(r, 1000 * attempts));
              }
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
    // Abort all in-flight XHRs immediately — stops progress events and frees bandwidth.
    // Each aborted XHR resolves to __ABORTED__ error which is caught silently in uploadPart.
    // Completed parts are already saved in completedParts; aborted parts will be re-uploaded on resume.
    console.log(
      `[handlePause] Aborting ${activeXhrsRef.current.size} in-flight XHRs`,
    );
    activeXhrsRef.current.forEach((xhr) => xhr.abort());
    activeXhrsRef.current.clear();
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
    // Kill all in-flight XHRs immediately — stops data flowing to GCS right now.
    console.log(
      `[handleAbort] Aborting ${activeXhrsRef.current.size} in-flight XHRs`,
    );
    activeXhrsRef.current.forEach((xhr) => xhr.abort());
    activeXhrsRef.current.clear();

    controlRef.current.shouldStop = true;
    const { orgId, assetId, assetVersionId, uploadId, objectName } = state;
    if (!orgId || !assetId || !assetVersionId || !uploadId || !objectName) {
      setState(INITIAL_UPLOAD_STATE);
      return;
    }

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
  // TWO mechanisms to guarantee no upload stays stuck after reconnect:
  //
  // 1) window.online fires while status is already "failed" → resume immediately
  // 2) status transitions to "failed" while browser is already online
  //    (online fired before retries exhausted) → resume immediately
  //
  // The uploadPart retry loop also waits for online before each retry, so
  // short disconnects (< MAX_RETRIES attempts) auto-recover without ever
  // reaching "failed" status at all.
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
        performUploadRef.current(f, { ...s, error: null });
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  // Mechanism 2: status just became "failed" and we're already online
  useEffect(() => {
    if (
      state.status === "failed" &&
      state.uploadId &&
      state.assetId &&
      file &&
      navigator.onLine
    ) {
      console.log(
        `[useFileUpload] Status became failed while online — auto-resuming from ${
          state.completedParts?.length ?? 0
        } completed parts`,
      );
      // Small delay to let React finish the current render cycle
      const timer = setTimeout(() => {
        performUploadRef.current(file, { ...state, error: null });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [state.status]); // eslint-disable-line react-hooks/exhaustive-deps

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
