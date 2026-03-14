"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import assetManager from "@/config/assetManager";
import {
  getStateLabel,
  mapStateToStatus,
  mapStateToPercent,
} from "@/lib/asset.type";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HealthData {
  timestamp: string;
  uptime: number;
  environment: string;
  redis: { status: string; connected: boolean };
}

interface RedisHealthData {
  connected: boolean;
  message: string;
  ping: string;
}

interface StateSnapshot {
  time: string;
  state: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {ok && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
      )}
      <span
        className={`relative inline-flex rounded-full h-2.5 w-2.5 ${ok ? "bg-emerald-500" : "bg-red-500"}`}
      />
    </span>
  );
}

function Badge({
  label,
  variant,
}: {
  label: string;
  variant: "ok" | "error" | "warn" | "idle";
}) {
  const cls = {
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
    error: "bg-red-50 text-red-600 border-red-200",
    warn: "bg-amber-50 text-amber-600 border-amber-200",
    idle: "bg-gray-100 text-gray-500 border-gray-200",
  }[variant];
  return (
    <span
      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${cls}`}
    >
      {label}
    </span>
  );
}

// ─── Health Section ───────────────────────────────────────────────────────────

function HealthSection() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [redis, setRedis] = useState<RedisHealthData | null>(null);
  const [healthErr, setHealthErr] = useState(false);
  const [redisErr, setRedisErr] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const check = async () => {
    setLoading(true);
    setHealthErr(false);
    setRedisErr(false);
    try {
      const h = await assetManager.getHealth();
      setHealth(h as unknown as HealthData);
    } catch {
      setHealthErr(true);
    }
    try {
      const r = await assetManager.getRedisHealth();
      setRedis(r as unknown as RedisHealthData);
    } catch {
      setRedisErr(true);
    }
    setLastChecked(new Date().toLocaleTimeString());
    setLoading(false);
  };

  useEffect(() => {
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apiOk = !healthErr && !!health?.timestamp;
  const redisOk = !redisErr && redis?.connected === true;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Service Health
        </h2>
        <div className="flex items-center gap-3">
          {lastChecked && (
            <span className="text-xs text-gray-400">checked {lastChecked}</span>
          )}
          <button
            onClick={check}
            disabled={loading}
            className="text-xs font-semibold text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1 disabled:opacity-40 transition-colors"
          >
            {loading ? "Checking…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {/* API health */}
        <div className="py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <StatusDot ok={apiOk} />
            <span className="text-sm font-medium text-gray-800">
              Asset Manager API
            </span>
          </div>
          <div className="flex items-center gap-2">
            {healthErr ? (
              <Badge label="Unreachable" variant="error" />
            ) : health ? (
              <>
                <Badge label="HEALTHY" variant="ok" />
                <span className="text-xs text-gray-400 font-mono">
                  {new Date(health.timestamp).toLocaleTimeString()}
                </span>
              </>
            ) : (
              <Badge label="…" variant="idle" />
            )}
          </div>
        </div>

        {/* Redis health */}
        <div className="py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <StatusDot ok={redisOk} />
            <span className="text-sm font-medium text-gray-800">
              Redis Pub/Sub
            </span>
          </div>
          <div className="flex items-center gap-2">
            {redisErr ? (
              <Badge label="Unreachable" variant="error" />
            ) : redis ? (
              <>
                <Badge
                  label={redis.connected ? "CONNECTED" : "DISCONNECTED"}
                  variant={redis.connected ? "ok" : "error"}
                />
                <span className="text-xs text-gray-400 font-mono">
                  {redis.ping}
                </span>
              </>
            ) : (
              <Badge label="…" variant="idle" />
            )}
          </div>
        </div>
      </div>

      {/* Overall verdict */}
      {!loading && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium border ${
            apiOk && redisOk
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-red-50 text-red-600 border-red-200"
          }`}
        >
          {apiOk && redisOk
            ? "✓ All systems operational — broker pipeline is reachable"
            : !apiOk
              ? "✗ API is down — cannot verify broker state"
              : "✗ Redis is down — broker pub/sub will not deliver state transitions"}
        </div>
      )}
    </div>
  );
}

// ─── Version Tracer Section ───────────────────────────────────────────────────

function VersionTracer() {
  const [versionId, setVersionId] = useState("");
  const [input, setInput] = useState("");
  const [current, setCurrent] = useState<string | null>(null);
  const [history, setHistory] = useState<StateSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStateRef = useRef<string | null>(null);

  const isDone = (state: string) =>
    state === "volume_copy_complete" ||
    state.includes("failed") ||
    state.includes("expired") ||
    state.includes("invalid");

  const stopPolling = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPolling(false);
  };

  const poll = async (id: string) => {
    try {
      const v = await assetManager.getProjectVersion(id);
      setCurrent(v.state);
      setError(null);
      // Only record a snapshot when state actually changes
      if (v.state !== prevStateRef.current) {
        prevStateRef.current = v.state;
        setHistory((h) => [
          { time: new Date().toLocaleTimeString(), state: v.state },
          ...h,
        ]);
      }
      if (isDone(v.state)) stopPolling();
    } catch {
      setError("Failed to fetch version — check the ID");
      stopPolling();
    }
  };

  const handleStart = () => {
    const id = input.trim();
    if (!id) return;
    setVersionId(id);
    setHistory([]);
    setCurrent(null);
    setError(null);
    prevStateRef.current = null;
    setPolling(true);
    poll(id);
    intervalRef.current = setInterval(() => poll(id), 3000);
  };

  const handleStop = () => stopPolling();

  useEffect(() => () => stopPolling(), []);

  const status = current ? mapStateToStatus(current) : null;
  const percent = current ? mapStateToPercent(current) : 0;

  const barColor = {
    uploading: "bg-blue-500",
    validating: "bg-amber-500",
    building: "bg-purple-500",
    deploying: "bg-cyan-500",
    deployed: "bg-emerald-500",
    failed: "bg-red-500",
    unknown: "bg-gray-400",
  }[status ?? "unknown"];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
        Version State Tracer
      </h2>
      <p className="text-xs text-gray-400">
        Paste a version ID to watch its state advance in real time. Each state
        change logged below confirms the broker is delivering transitions.
      </p>

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !polling && handleStart()}
          placeholder="Paste assetVersionId…"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-gray-400"
        />
        {polling ? (
          <button
            onClick={handleStop}
            className="px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleStart}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors"
          >
            Trace
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Current state */}
      {current && status && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {getStateLabel(current)}
            </span>
            <span className="text-xs font-bold text-gray-700">
              {percent > 0 ? `~${percent}%` : "—"}
            </span>
          </div>
          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${Math.max(percent, 2)}%` }}
            />
          </div>
          <div className="flex items-center gap-2">
            {polling && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
            )}
            <span className="text-xs text-gray-400">
              {polling ? "Polling every 3s" : "Stopped"}
            </span>
          </div>
        </div>
      )}

      {/* State history */}
      {history.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
            State transitions ({history.length})
          </p>
          <div className="rounded-lg border border-gray-100 overflow-hidden divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {history.map((snap, i) => (
              <div
                key={i}
                className="px-3 py-2 flex items-center justify-between gap-4 bg-white"
              >
                <span className="text-sm text-gray-800 font-medium">
                  {getStateLabel(snap.state)}
                </span>
                <span className="text-xs text-gray-400 font-mono shrink-0">
                  {snap.time}
                </span>
              </div>
            ))}
          </div>
          {history.length === 1 && polling && (
            <p className="text-xs text-gray-400">
              Waiting for next transition…
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DebugPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <button
          onClick={() => router.push("/AssetManager")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          All projects
        </button>

        <div>
          <h1 className="text-xl font-bold text-gray-900">Debug Panel</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Verify API health, Redis broker connectivity, and live version state
            transitions
          </p>
        </div>

        <HealthSection />
        <VersionTracer />
      </div>
    </div>
  );
}
