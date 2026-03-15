"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { assetApi } from "@/lib/asset-api";
import {
  INITIAL_UPLOAD_STATE,
  getChunkSize,
  type UploadState,
  type UploadFormData,
} from "@/lib/asset.type";

// 10 concurrent part-upload workers. Each uploads directly to GCS in parallel.
// The bottleneck is outbound bandwidth, not CPU, so more workers = faster uploads.
const MAX_WORKERS = 10;
const MAX_RETRIES = 6; // Higher to survive a brief wifi drop + reconnect

export const useFileUpload = (userId: string | null) => {
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

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

  // ─── File Select & Session Recovery ────────────────────────────────────────

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);

    console.log(`[handleFileSelect] ─────────────────────────────────────────`);
    console.log(
      `[handleFileSelect] File selected: "${selected.name}" | Size: ${(selected.size / 1024 / 1024).toFixed(2)} MB`,
    );
    console.log(
      `[handleFileSelect] Chunk size will be: ${(getChunkSize(selected.size) / 1024 / 1024).toFixed(0)} MB | Est. parts: ${Math.ceil(selected.size / getChunkSize(selected.size))}`,
    );
    console.log(
      `[handleFileSelect] Querying backend for active session: "${selected.name}"`,
    );

    const session = await assetApi.getSession(selected.name);

    if (!session) {
      console.log(
        `[handleFileSelect] No active session found — starting fresh`,
      );
      setState({ ...INITIAL_UPLOAD_STATE, totalBytes: selected.size });
      return;
    }

    console.log(`[handleFileSelect] Session found in DB — verifying GCS state`);
    console.log(`[handleFileSelect] Session:`, {
      assetId: session.assetId,
      assetVersionId: session.assetVersionId,
      uploadId: session.uploadId,
      objectName: session.objectName,
    });

    // Verify the GCS multipart session is actually alive by listing parts.
    // The DB session could be stale if: upload completed but state update failed,
    // GCS expired the uploadId, or abort was called without DB cleanup.
    const completedParts = await assetApi.listParts(
      session.objectName,
      session.uploadId,
    );

    if (completedParts.length === 0) {
      // GCS returned 0 parts — the uploadId is dead on GCS regardless of what
      // the DB says. Could be a completed, aborted, or GCS-expired session.
      // Do not recover — start completely fresh.
      console.log(
        `[handleFileSelect] Session found in DB but GCS returned 0 parts — uploadId is dead, starting fresh`,
      );
      setState({ ...INITIAL_UPLOAD_STATE, totalBytes: selected.size });
      return;
    }

    // GCS confirmed live parts — genuine in-progress session, recover it.
    const chunkSize = getChunkSize(selected.size);
    const uploadedBytes = completedParts.length * chunkSize;

    console.log(
      `[handleFileSelect] ✅ GCS confirmed ${completedParts.length} completed parts | ${(uploadedBytes / 1024 / 1024).toFixed(2)} MB recovered — ready to resume`,
    );

    setState({
      ...INITIAL_UPLOAD_STATE,
      orgId: session.orgId,
      assetId: session.assetId,
      assetVersionId: session.assetVersionId,
      uploadId: session.uploadId,
      objectName: session.objectName,
      completedParts,
      totalBytes: selected.size,
      uploadedBytes,
      status: "paused",
      fileName: selected.name,
      createdAt: Date.now(),
      sessionRecovered: true,
    });
  };

  // ─── Core Upload Logic ──────────────────────────────────────────────────────

  const performUpload = useCallback(
    async (fileOverride?: File, stateOverride?: UploadState) => {
      const activeFile = fileOverride ?? file;
      const activeState = stateOverride ?? state;
      if (!activeFile) return;

      controlRef.current.shouldStop = false;

      const chunkSize = getChunkSize(activeFile.size);
      const totalParts = Math.ceil(activeFile.size / chunkSize);

      console.log(
        `[performUpload] ─────────────────────────────────────────────`,
      );
      console.log(
        `[performUpload] Starting upload: "${activeFile.name}" | ${(activeFile.size / 1024 / 1024).toFixed(2)} MB | chunkSize: ${(chunkSize / 1024 / 1024).toFixed(0)} MB | totalParts: ${totalParts}`,
      );

      try {
        let uploadId = activeState.uploadId;
        let objectName = activeState.objectName;
        let assetId = activeState.assetId;
        let versionId = activeState.assetVersionId;
        let orgId = activeState.orgId;
        let completedParts = activeState.completedParts ?? [];

        // Initiate a new upload if no session exists in state
        if (!uploadId || !assetId || !versionId || !orgId) {
          console.log(
            `[performUpload] No existing session — initiating new upload`,
          );
          const initiated = await assetApi.initiate(
            activeFile,
            formDataRef.current,
            userIdRef.current ?? "",
          );
          uploadId = initiated.uploadId;
          objectName = initiated.objectName;
          assetId = initiated.assetId;
          versionId = initiated.assetVersionId;
          orgId = initiated.orgId;
          completedParts = [];
          console.log(
            `[performUpload] ✅ Upload initiated | assetId: ${assetId} | versionId: ${versionId} | uploadId: ${uploadId}`,
          );
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
        } else {
          console.log(
            `[performUpload] Resuming existing session | assetId: ${assetId} | versionId: ${versionId} | uploadId: ${uploadId} | completedParts: ${completedParts.length}/${totalParts}`,
          );
        }

        if (!uploadId || !objectName || !assetId || !versionId || !orgId) {
          throw new Error("Upload session could not be established");
        }

        // Build the queue of parts not yet uploaded
        const completedPartNumbers = new Set(
          completedParts.map((p) => p.partNumber),
        );
        const queue: number[] = [];
        for (let i = 1; i <= totalParts; i++) {
          if (!completedPartNumbers.has(i)) queue.push(i);
        }

        console.log(
          `[performUpload] Parts queue built | remaining: ${queue.length} | already done: ${completedParts.length} | total: ${totalParts}`,
        );

        // Tracks in-flight bytes for each part currently being uploaded.
        const partProgressMap = new Map<number, number>();

        patchState({ status: "uploading" });

        // Pre-fetch signed URLs for ALL pending parts in a single request.
        let signedUrlMap: Record<number, string> = {};

        if (queue.length > 0) {
          console.log(
            `[performUpload] Fetching signed URLs for ${queue.length} parts...`,
          );
          const urlFetchStart = Date.now();
          signedUrlMap = await assetApi.batchGetSignedUrls(
            orgId,
            assetId,
            versionId,
            uploadId,
            objectName,
            queue,
          );
          console.log(
            `[performUpload] ✅ Signed URLs fetched in ${Date.now() - urlFetchStart}ms`,
          );
        } else {
          console.log(
            `[performUpload] All parts already uploaded — skipping signed URL fetch, proceeding to complete`,
          );
        }
        // ── Part upload with retry ────────────────────────────────────────────
        const uploadPart = async (partNumber: number): Promise<void> => {
          const start = (partNumber - 1) * chunkSize;
          const end = Math.min(start + chunkSize, activeFile.size);
          const chunk = activeFile.slice(start, end);

          console.log(
            `[uploadPart] Starting part ${partNumber}/${totalParts} | ${(chunk.size / 1024 / 1024).toFixed(2)} MB | bytes ${start}–${end}`,
          );

          let attempts = 0;
          while (attempts < MAX_RETRIES) {
            try {
              const signedUrl =
                attempts === 0
                  ? signedUrlMap[partNumber]
                  : await assetApi.getSignedUrl(
                      orgId!,
                      assetId!,
                      versionId!,
                      uploadId!,
                      objectName!,
                      partNumber,
                    );

              if (attempts > 0) {
                console.log(
                  `[uploadPart] Retry ${attempts}/${MAX_RETRIES} for part ${partNumber} — fresh signed URL fetched`,
                );
              }

              const { promise, xhr } = assetApi.uploadPart(
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
                if (err instanceof Error && err.message === "__ABORTED__") {
                  console.log(
                    `[uploadPart] Part ${partNumber} aborted (pause) — will re-queue on resume`,
                  );
                  return;
                }
                throw err;
              }

              activeXhrsRef.current.delete(xhr);
              partProgressMap.delete(partNumber);
              completedParts = [...completedParts, { partNumber, etag }];

              console.log(
                `[uploadPart] ✅ Part ${partNumber}/${totalParts} done | etag: ${etag} | progress: ${completedParts.length}/${totalParts} (${((completedParts.length / totalParts) * 100).toFixed(1)}%)`,
              );

              patchState({
                completedParts,
                uploadedBytes: completedParts.length * chunkSize,
              });
              return;
            } catch (err) {
              attempts++;
              const errMsg = err instanceof Error ? err.message : String(err);
              console.warn(
                `[uploadPart] ⚠️ Part ${partNumber} attempt ${attempts}/${MAX_RETRIES} failed: ${errMsg}`,
              );
              if (attempts >= MAX_RETRIES) {
                console.error(
                  `[uploadPart] ❌ Part ${partNumber} permanently failed after ${MAX_RETRIES} retries`,
                );
                throw err;
              }
              if (!navigator.onLine) {
                console.log(
                  `[uploadPart] Offline — waiting for reconnect before retry (part ${partNumber}, attempt ${attempts})`,
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
                const delay = 1000 * attempts;
                console.log(
                  `[uploadPart] Waiting ${delay}ms before retry (part ${partNumber}, attempt ${attempts})`,
                );
                await new Promise((r) => setTimeout(r, delay));
              }
            }
          }
        };

        // ── Concurrency pool ──────────────────────────────────────────────────
        const runPool = async (): Promise<void> => {
          let index = 0;
          const workerCount = Math.min(MAX_WORKERS, queue.length);

          console.log(
            `[runPool] Starting ${workerCount} concurrent workers for ${queue.length} parts`,
          );

          const worker = async (workerId: number): Promise<void> => {
            while (true) {
              const i = index++;
              if (i >= queue.length) {
                console.log(
                  `[runPool] Worker ${workerId} finished — no more parts`,
                );
                return;
              }
              if (controlRef.current.shouldStop) {
                console.log(
                  `[runPool] Worker ${workerId} stopped (pause signal)`,
                );
                return;
              }
              await uploadPart(queue[i]);
            }
          };

          const workers = Array.from({ length: workerCount }, (_, i) =>
            worker(i + 1),
          );
          await Promise.all(workers);
        };

        const poolStart = Date.now();
        await runPool();
        console.log(
          `[performUpload] Pool finished in ${((Date.now() - poolStart) / 1000).toFixed(1)}s`,
        );

        if (controlRef.current.shouldStop) {
          console.log(
            `[performUpload] Upload paused — ${completedParts.length}/${totalParts} parts completed`,
          );
          patchState({ status: "paused" });
          return;
        }

        // All parts done — assemble on GCS
        console.log(
          `[performUpload] All ${totalParts} parts uploaded — calling complete`,
        );
        const sortedParts = [...completedParts].sort(
          (a, b) => a.partNumber - b.partNumber,
        );

        await assetApi.complete(
          formDataRef.current.assetType,
          orgId,
          assetId,
          versionId,
          uploadId,
          objectName,
          sortedParts,
        );

        console.log(
          `[performUpload] ✅ Upload complete | assetId: ${assetId} | versionId: ${versionId} | file: "${activeFile.name}"`,
        );
        patchState({ uploadedBytes: activeFile.size, status: "completed" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`[performUpload] ❌ Upload failed: ${message}`);
        patchState({ status: "failed", error: message });
      }
    },
    [file, state, patchState],
  );

  // ─── Form Data Ref ──────────────────────────────────────────────────────────

  const formDataRef = useRef<UploadFormData>({
    orgId: "",
    assetType: "UNREAL_PROJECT",
    displayName: "",
    selfPackaged: true,
    volumeRegions: ["ORD1", "LGA1", "LAS1"],
  });

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

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleStart = () => {
    console.log(`[handleStart] Starting upload for "${file?.name}"`);
    patchState({ status: "uploading", error: null });
    performUpload();
  };

  const handlePause = () => {
    console.log(
      `[handlePause] Pausing — aborting ${activeXhrsRef.current.size} in-flight XHRs`,
    );
    controlRef.current.shouldStop = true;
    activeXhrsRef.current.forEach((xhr) => xhr.abort());
    activeXhrsRef.current.clear();
    patchState({ status: "paused" });
  };

  const handleResume = () => {
    if (state.uploadId && state.assetId) {
      console.log(
        `[handleResume] Resuming upload from ${state.completedParts?.length ?? 0} completed parts`,
      );
      performUpload(file ?? undefined, state);
    } else {
      console.log(`[handleResume] No session in state — resetting`);
      setState(INITIAL_UPLOAD_STATE);
    }
  };

  const handleRetry = () => {
    console.log(`[handleRetry] Retrying upload for "${file?.name}"`);
    patchState({ error: null });
    performUpload();
  };

  const handleAbort = async () => {
    console.log(
      `[handleAbort] Aborting — killing ${activeXhrsRef.current.size} in-flight XHRs`,
    );
    activeXhrsRef.current.forEach((xhr) => xhr.abort());
    activeXhrsRef.current.clear();
    controlRef.current.shouldStop = true;

    const { orgId, assetId, assetVersionId, uploadId, objectName } = state;
    if (!orgId || !assetId || !assetVersionId || !uploadId || !objectName) {
      console.log(`[handleAbort] No active session to abort — resetting state`);
      setState(INITIAL_UPLOAD_STATE);
      return;
    }

    console.log(
      `[handleAbort] Calling abort API | assetId: ${assetId} | uploadId: ${uploadId}`,
    );
    try {
      await assetApi.abort(
        formData.assetType,
        orgId,
        assetId,
        assetVersionId,
        uploadId,
        objectName,
      );
      console.log(`[handleAbort] ✅ Abort API call successful`);
    } catch (err) {
      console.error(`[handleAbort] ❌ Abort API call failed:`, err);
    } finally {
      setState(INITIAL_UPLOAD_STATE);
    }
  };

  const handleReset = () => {
    console.log(`[handleReset] Resetting upload state`);
    setFile(null);
    setState(INITIAL_UPLOAD_STATE);
  };

  // ─── Wifi Reconnect Auto-Resume ─────────────────────────────────────────────
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
          `[useFileUpload] 🌐 Network reconnected — auto-resuming from ${s.completedParts?.length ?? 0} completed parts`,
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
      const totalParts = Math.ceil(file.size / getChunkSize(file.size));
      const remaining = totalParts - (state.completedParts?.length ?? 0);

      if (remaining <= 0) {
        console.log(
          `[useFileUpload] Status failed but all ${totalParts} parts already uploaded — not auto-resuming (complete call failed, use Retry)`,
        );
        return;
      }

      console.log(
        `[useFileUpload] Status became failed while online — auto-resuming from ${state.completedParts?.length ?? 0} completed parts (${remaining} remaining)`,
      );
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
