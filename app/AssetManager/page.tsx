"use client";

import { useFileUpload } from "@/hooks/useFileUpload";
import { Button } from "@/components/ui/button";

export default function AssetManagerPage() {
  const {
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
  } = useFileUpload();

  const isUploading = state.status === "uploading";

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold text-foreground text-center">
          Asset Manager
        </h1>

        {/* Upload Configuration */}
        <section className="border border-border rounded-lg p-6 bg-card space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Upload Configuration
          </h2>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Asset Type
            </label>
            <select
              value={formData.assetType}
              onChange={(e) =>
                setFormData({
                  assetType: e.target.value as "UNREAL_PROJECT" | "OTHER_3D",
                })
              }
              disabled={isUploading}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground disabled:opacity-50"
            >
              <option value="OTHER_3D">Other 3D</option>
              <option value="UNREAL_PROJECT">Unreal Project</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Display Name{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ displayName: e.target.value })}
              disabled={isUploading}
              placeholder="Leave empty to use filename"
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Volume Regions
            </label>
            <div className="flex gap-2">
              {(["ORD1", "LGA1", "LAS1"] as const).map((region) => {
                const selected = formData.volumeRegions.includes(region);
                return (
                  <button
                    key={region}
                    type="button"
                    disabled={isUploading}
                    onClick={() => {
                      const next = selected
                        ? formData.volumeRegions.filter((r) => r !== region)
                        : [...formData.volumeRegions, region];
                      setFormData({ volumeRegions: next });
                    }}
                    className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors disabled:opacity-50 ${
                      selected
                        ? "bg-accent text-accent-foreground border-accent"
                        : "bg-background text-muted-foreground border-border hover:border-accent"
                    }`}
                  >
                    {region}
                  </button>
                );
              })}
            </div>
          </div>

          {formData.assetType === "UNREAL_PROJECT" && (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  Unreal Engine Version
                </label>
                <input
                  type="text"
                  value={formData.unrealEngineVersion}
                  onChange={(e) =>
                    setFormData({ unrealEngineVersion: e.target.value })
                  }
                  disabled={isUploading}
                  placeholder="e.g. 5.2.1"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  Target
                </label>
                <select
                  value={formData.target}
                  onChange={(e) => setFormData({ target: e.target.value })}
                  disabled={isUploading}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground disabled:opacity-50"
                >
                  <option value="Development">Development</option>
                  <option value="Shipping">Shipping</option>
                  <option value="Test">Test</option>
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.selfPackaged}
                  onChange={(e) =>
                    setFormData({ selfPackaged: e.target.checked })
                  }
                  disabled={isUploading}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-foreground">
                  Self Packaged
                </span>
              </label>
            </>
          )}
        </section>

        {/* File Selection */}
        <section className="border border-border rounded-lg p-6 bg-card space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Select File
          </h2>
          <input
            type="file"
            onChange={handleFileSelect}
            disabled={isUploading}
            className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-accent file:text-accent-foreground hover:file:opacity-90 disabled:opacity-50"
          />
          {file && (
            <div className="text-sm text-muted-foreground space-y-1 pt-1">
              <p>
                <span className="font-medium text-foreground">File:</span>{" "}
                {file.name}
              </p>
              <p>
                <span className="font-medium text-foreground">Size:</span>{" "}
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}
        </section>

        {/* Progress */}
        {state.totalBytes > 0 && (
          <section className="border border-border rounded-lg p-6 bg-card space-y-3">
            <div className="flex justify-between text-sm font-medium text-foreground">
              <span>Upload Progress</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  state.status === "failed"
                    ? "bg-destructive"
                    : state.status === "completed"
                      ? "bg-green-500"
                      : "bg-accent"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {(state.uploadedBytes / 1024 / 1024).toFixed(2)} MB /{" "}
              {(state.totalBytes / 1024 / 1024).toFixed(2)} MB
            </p>
          </section>
        )}

        {/* Status */}
        <section
          className={`border rounded-lg p-4 text-sm ${
            state.status === "failed"
              ? "border-destructive bg-destructive/10"
              : state.status === "completed"
                ? "border-green-500 bg-green-500/10"
                : "border-border bg-card"
          }`}
        >
          <p>
            <span className="font-medium text-foreground">Status: </span>
            <span
              className={`uppercase font-semibold ${
                state.status === "failed"
                  ? "text-destructive"
                  : state.status === "completed"
                    ? "text-green-600"
                    : "text-muted-foreground"
              }`}
            >
              {state.status}
            </span>
          </p>
          {state.error && (
            <p className="mt-2 text-destructive">{state.error}</p>
          )}
        </section>

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          {state.status === "idle" && file && (
            <Button onClick={handleStart}>Start Upload</Button>
          )}
          {state.status === "uploading" && (
            <Button variant="outline" onClick={handlePause}>
              Pause
            </Button>
          )}
          {state.status === "paused" && (
            <Button onClick={handleResume}>Resume</Button>
          )}
          {state.status === "failed" && (
            <Button variant="outline" onClick={handleRetry}>
              Retry
            </Button>
          )}
          {(state.status === "uploading" || state.status === "paused") && (
            <Button variant="destructive" onClick={handleAbort}>
              Abort
            </Button>
          )}
          {state.status === "completed" && (
            <Button onClick={handleReset}>Upload New File</Button>
          )}
        </div>
      </div>
    </div>
  );
}
