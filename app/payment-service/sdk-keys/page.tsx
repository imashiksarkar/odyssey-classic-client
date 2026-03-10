"use client";

import { AuthContext } from "@/app/auth-wrapper";
import useAccessToken from "@/lib/use-access-token";
import axios from "axios";
import { Check, Copy, KeyRound, RefreshCcw, ShieldCheck } from "lucide-react";
import { use, useEffect, useMemo, useState } from "react";

type SdkKeyItem = {
  id: string;
  subscriptionId?: string;
  userId?: string;
  sdkKey: string;
  serviceType?: string | null;
  isActive?: boolean;
  activateAt?: string | null;
  expiresAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
};

type SdkKeysApiResponse = {
  statusCode?: number;
  success?: boolean;
  message?: string;
  data?:
    | SdkKeyItem[]
    | SdkKeyItem
    | {
        data?: SdkKeyItem[] | SdkKeyItem;
      };
};

const modalBaseClass =
  "fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm";

const normalizeSdkKeys = (
  payload: SdkKeysApiResponse | SdkKeyItem[] | null | undefined
): SdkKeyItem[] => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (payload.data && "data" in payload.data && Array.isArray(payload.data.data)) {
    return payload.data.data;
  }

  if (payload.data && !Array.isArray(payload.data) && "id" in payload.data) {
    return [payload.data];
  }

  return [];
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const formatShortDate = (value?: string | null) => {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const formatLabel = (value?: string | null) => {
  if (!value) {
    return "N/A";
  }

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const maskValue = (value?: string | null) => {
  if (!value) {
    return "N/A";
  }

  if (value.length <= 10) {
    return value;
  }

  return `${value.slice(0, 12)}...${value.slice(-8)}`;
};

const getCurrentUserId = (user: unknown) => {
  if (!user || typeof user !== "object") {
    return "";
  }

  const source = user as Record<string, unknown>;
  const keys = ["id", "userId", "_id", "sub"];

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
};

const getUserIdFromAccessToken = (token?: string) => {
  if (!token) {
    return "";
  }

  try {
    const [, payload] = token.split(".");
    if (!payload) {
      return "";
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded) as Record<string, unknown>;

    for (const key of ["sub", "id", "userId"]) {
      const value = parsed[key];
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
  } catch (error) {
    console.error("Failed to parse access token for user id", error);
  }

  return "";
};

const getStatusBadgeClass = (isActive?: boolean) =>
  isActive
    ? "bg-emerald-100 text-emerald-700"
    : "bg-rose-100 text-rose-700";

const getHexString = (size: number) => {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
};

const generateSdkKey = (serviceType?: string | null) => {
  const random = getHexString(32);
  const normalizedServiceType = (serviceType || "service")
    .toLowerCase()
    .replace(/\s+/g, "_");

  return `odyssey_${normalizedServiceType}_sdk_${random}`;
};

const SdkKeysPage = () => {
  const { user } = use(AuthContext);
  const { accessToken, isTokenLoading, tokenError } = useAccessToken();
  const currentUserId = useMemo(
    () => getCurrentUserId(user) || getUserIdFromAccessToken(accessToken),
    [accessToken, user]
  );
  const [sdkKeys, setSdkKeys] = useState<SdkKeyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [savingId, setSavingId] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [confirmItem, setConfirmItem] = useState<SdkKeyItem | null>(null);

  useEffect(() => {
    const fetchSdkKeys = async () => {
      if (isTokenLoading) {
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      if (!accessToken) {
        setSdkKeys([]);
        setErrorMessage(tokenError || "Access token not found. Please login again.");
        setIsLoading(false);
        return;
      }

      if (!currentUserId) {
        setSdkKeys([]);
        setErrorMessage("User profile is missing an id. Refresh profile and try again.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await axios.get<SdkKeysApiResponse>(
          `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL}/sdk-key/user/${currentUserId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        setSdkKeys(normalizeSdkKeys(response.data));
      } catch (error) {
        console.error("Failed to fetch SDK keys", error);
        setSdkKeys([]);
        setErrorMessage("Failed to load SDK keys.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSdkKeys();
  }, [accessToken, currentUserId, isTokenLoading, tokenError]);

  const handleCopySdkKey = async (item: SdkKeyItem) => {
    if (!item.sdkKey) {
      setErrorMessage("SDK key not found.");
      setSuccessMessage("");
      return;
    }

    try {
      await navigator.clipboard.writeText(item.sdkKey);
      setCopiedId(item.id);
      setErrorMessage("");
      setSuccessMessage("SDK key copied to clipboard.");
      window.setTimeout(() => {
        setCopiedId((current) => (current === item.id ? "" : current));
      }, 2000);
    } catch (error) {
      console.error("Failed to copy SDK key", error);
      setErrorMessage("Failed to copy SDK key.");
      setSuccessMessage("");
    }
  };

  const handleUpdateSdkKey = async (item: SdkKeyItem) => {
    if (!accessToken) {
      setErrorMessage("Access token not found. Please login again.");
      setSuccessMessage("");
      return;
    }

    const nextKey = generateSdkKey(item.serviceType?.toString() || "service");

    setSavingId(item.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL}/sdk-key/${item.id}`,
        { key: nextKey },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      setSdkKeys((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                sdkKey: nextKey,
                updatedAt: new Date().toISOString(),
              }
            : entry
        )
      );
      setSuccessMessage("SDK key generated and updated successfully.");
      setConfirmItem(null);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setErrorMessage(error.response?.data?.message || "Failed to update SDK key.");
      } else {
        setErrorMessage("Failed to update SDK key.");
      }
      setSuccessMessage("");
    } finally {
      setSavingId("");
    }
  };

  return (
    <>
      <section className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.15),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.14),_transparent_26%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-6 md:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="relative mb-6 overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur">
            <div className="absolute -left-16 top-12 h-36 w-36 rounded-full bg-amber-300/20 blur-3xl" />
            <div className="absolute right-0 top-0 h-48 w-48 bg-[radial-gradient(circle,_rgba(96,165,250,0.22),_transparent_58%)]" />
            <div className="grid gap-6 border-b border-slate-200/80 bg-[linear-gradient(140deg,_rgba(15,23,42,1)_0%,_rgba(30,41,59,0.98)_46%,_rgba(51,65,85,0.96)_100%)] px-6 py-8 text-white lg:grid-cols-[1.4fr_0.9fr]">
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-slate-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Credential Vault
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
                  Modern SDK key management
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  Rotate live SDK credentials with confirmation, copy per service,
                  and review activation windows in a cleaner developer console.
                </p>
              </div>

              <div className="relative z-10 grid gap-3 self-start rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-300">
                      Rotation Rule
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">
                      Generate on demand
                    </p>
                  </div>
                  <RefreshCcw className="h-4 w-4 text-slate-200" />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-300">
                      Copy Access
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">
                      Per service row
                    </p>
                  </div>
                  <Copy className="h-4 w-4 text-slate-200" />
                </div>
              </div>
            </div>

            <div className="grid gap-4 bg-white/75 px-6 py-5 md:grid-cols-3">
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                Total Keys
              </p>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-3xl font-semibold text-slate-950">
                    {sdkKeys.length}
                  </p>
                  <KeyRound className="h-5 w-5 text-slate-400" />
                </div>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                  Active
                </p>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-3xl font-semibold text-slate-950">
                    {sdkKeys.filter((item) => item.isActive).length}
                  </p>
                  <div className="h-3 w-3 rounded-full bg-emerald-500" />
                </div>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                  Inactive
                </p>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-3xl font-semibold text-slate-950">
                    {sdkKeys.filter((item) => !item.isActive).length}
                  </p>
                  <div className="h-3 w-3 rounded-full bg-rose-400" />
                </div>
              </div>
            </div>
          </div>
          <div className="mb-4 space-y-3">
            {errorMessage && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {successMessage}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {isLoading && (
              <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-8 text-sm text-slate-600 shadow-sm">
                Loading SDK keys...
              </div>
            )}

            {!isLoading && !errorMessage && sdkKeys.length === 0 && (
              <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
                <h2 className="text-lg font-semibold text-slate-950">
                  No SDK keys found
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  SDK credentials will appear here when they are available.
                </p>
              </div>
            )}

            {!isLoading &&
              sdkKeys.map((item) => (
                <article
                  key={item.id}
                  className="group overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/95 shadow-[0_18px_50px_rgba(15,23,42,0.07)] transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div className="grid gap-0 lg:grid-cols-[minmax(0,1.45fr)_340px]">
                    <div className="p-6">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-semibold text-slate-950">
                          {formatLabel(item.serviceType?.toString() || null)}
                        </h2>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(
                            item.isActive
                          )}`}
                        >
                          {item.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        Subscription {item.subscriptionId || item.id}
                      </p>

                      <div className="relative mt-5 overflow-hidden rounded-[24px] border border-slate-800 bg-[linear-gradient(135deg,_#020617_0%,_#0f172a_40%,_#172554_100%)] p-5 text-white">
                        <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-sky-400/10 blur-2xl" />
                        <div className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-amber-300/10 blur-2xl" />
                        <div className="relative z-10 flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
                              Current SDK Key
                            </p>
                            <p className="mt-3 break-all font-mono text-sm leading-6 text-slate-100">
                              {item.sdkKey}
                            </p>
                            <p className="mt-3 text-xs text-slate-400">
                              Masked view: {maskValue(item.sdkKey)}
                            </p>
                          </div>
                          <div className="hidden rounded-2xl border border-white/10 bg-white/5 p-3 lg:block">
                            <KeyRound className="h-5 w-5 text-slate-200" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-200/80 bg-slate-50/80 p-6 lg:border-l lg:border-t-0">
                      <div className="rounded-[24px] border border-white/80 bg-white p-4 shadow-sm">
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                          Active Window
                        </p>
                        <div className="mt-3 space-y-3 text-sm">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500">Activated</span>
                            <span className="font-medium text-slate-900">
                              {formatShortDate(item.activateAt?.toString())}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500">Expires</span>
                            <span className="font-medium text-slate-900">
                              {formatShortDate(item.expiresAt?.toString())}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500">Updated</span>
                            <span className="text-right font-medium text-slate-900">
                              {formatDate(
                                item.updatedAt?.toString() || item.createdAt?.toString()
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3">
                        <button
                          type="button"
                          onClick={() => handleCopySdkKey(item)}
                          className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-100"
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check className="h-4 w-4" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              Copy SDK Key
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setErrorMessage("");
                            setSuccessMessage("");
                            setConfirmItem(item);
                          }}
                          disabled={savingId === item.id}
                          className="inline-flex items-center justify-center gap-2 rounded-[20px] bg-slate-950 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <RefreshCcw className="h-4 w-4" />
                          {savingId === item.id
                            ? "Updating..."
                            : "Generate New SDK Key"}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
          </div>
        </div>
      </section>

      {confirmItem && (
        <div className={modalBaseClass}>
          <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
            <div className="bg-[linear-gradient(135deg,_#0f172a_0%,_#1e293b_100%)] px-6 py-5 text-white">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-slate-200">
                <RefreshCcw className="h-3.5 w-3.5" />
                Confirm Rotation
              </div>
              <h2 className="mt-3 text-xl font-semibold">Change SDK key</h2>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-700">
              Are you sure you want to change the{" "}
              {formatLabel(confirmItem.serviceType?.toString() || null)} SDK key?
              </p>
              <p className="mt-2 text-sm text-slate-500">
                A fresh credential will be generated instantly and the current key
                will stop being the latest saved value for this service.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmItem(null)}
                  className="cursor-pointer rounded-[18px] border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateSdkKey(confirmItem)}
                  disabled={savingId === confirmItem.id}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-[18px] bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCcw className="h-4 w-4" />
                  {savingId === confirmItem.id ? "Updating..." : "Yes, rotate key"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SdkKeysPage;
