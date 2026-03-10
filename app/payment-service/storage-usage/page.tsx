"use client";

import { AuthContext } from "@/app/auth-wrapper";
import useAccessToken from "@/lib/use-access-token";
import axios from "axios";
import { use, useEffect, useMemo, useState } from "react";

type ServiceType = "AVATAR_SSO" | "ASSETS_MANAGER";

type StorageUsage = {
  id: string;
  customerId: string;
  productId: string;
  userId: string;
  serviceType: ServiceType;
  totalUsages: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type TrialStorageUsage = {
  id: string;
  customerId: string;
  userId: string;
  serviceType: ServiceType;
  totalStorage: number;
  totalCpu: number;
  totalGpu: number;
  isActive: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type StorageUsagePayload = {
  storageUsages?: StorageUsage[];
  trialUsageUsage?: TrialStorageUsage[];
};

type StorageUsageApiResponse = {
  statusCode?: number;
  success?: boolean;
  message?: string;
  data?:
    | StorageUsagePayload
    | {
        data?: StorageUsagePayload;
      };
};

type ActiveTab = "storage" | "trial";

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

const normalizeStorageUsage = (
  payload: StorageUsageApiResponse | StorageUsagePayload | null | undefined
): StorageUsagePayload => {
  if (!payload) {
    return {
      storageUsages: [],
      trialUsageUsage: [],
    };
  }

  if (
    "storageUsages" in payload ||
    "trialUsageUsage" in payload
  ) {
    return {
      storageUsages: payload.storageUsages || [],
      trialUsageUsage: payload.trialUsageUsage || [],
    };
  }

  if (payload.data && !Array.isArray(payload.data) && "storageUsages" in payload.data) {
    return {
      storageUsages: payload.data.storageUsages || [],
      trialUsageUsage: payload.data.trialUsageUsage || [],
    };
  }

  if (
    payload.data &&
    !Array.isArray(payload.data) &&
    "data" in payload.data &&
    payload.data.data
  ) {
    return {
      storageUsages: payload.data.data.storageUsages || [],
      trialUsageUsage: payload.data.data.trialUsageUsage || [],
    };
  }

  return {
    storageUsages: [],
    trialUsageUsage: [],
  };
};

const StorageUsagePage = () => {
  const { user } = use(AuthContext);
  const { accessToken, isTokenLoading, tokenError } = useAccessToken();
  const currentUserId = useMemo(
    () => getCurrentUserId(user) || getUserIdFromAccessToken(accessToken),
    [accessToken, user]
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>("storage");
  const [storageUsages, setStorageUsages] = useState<StorageUsage[]>([]);
  const [trialStorageUsages, setTrialStorageUsages] = useState<TrialStorageUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchStorageUsage = async () => {
      if (isTokenLoading) {
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      if (!accessToken) {
        setStorageUsages([]);
        setTrialStorageUsages([]);
        setErrorMessage(tokenError || "Access token not found. Please login again.");
        setIsLoading(false);
        return;
      }

      if (!currentUserId) {
        setStorageUsages([]);
        setTrialStorageUsages([]);
        setErrorMessage("User profile is missing an id. Refresh profile and try again.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await axios.get<StorageUsageApiResponse>(
          `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL}/customer/get-storage-usage/${currentUserId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const nextData = normalizeStorageUsage(response.data);
        setStorageUsages(nextData.storageUsages || []);
        setTrialStorageUsages(nextData.trialUsageUsage || []);
      } catch (error) {
        console.error("Failed to fetch storage usage", error);
        setStorageUsages([]);
        setTrialStorageUsages([]);
        setErrorMessage("Failed to load storage usage.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStorageUsage();
  }, [accessToken, currentUserId, isTokenLoading, tokenError]);

  const currentStorageCount = storageUsages.length;
  const currentTrialCount = trialStorageUsages.length;

  return (
    <section className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Storage Usage</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review your current storage usage and trial storage usage by service.
        </p>
      </div>

      {errorMessage && <p className="mb-3 text-sm text-red-600">{errorMessage}</p>}

      <div className="mb-4 inline-flex rounded-lg border border-gray-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setActiveTab("storage")}
          className={`cursor-pointer rounded-md px-4 py-2 text-sm transition-colors ${
            activeTab === "storage"
              ? "bg-black text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          Storage Usage ({currentStorageCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("trial")}
          className={`cursor-pointer rounded-md px-4 py-2 text-sm transition-colors ${
            activeTab === "trial"
              ? "bg-black text-white"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          Trial Storage Usage ({currentTrialCount})
        </button>
      </div>

      {activeTab === "storage" && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Service</th>
                  <th className="px-4 py-3 text-left font-medium">Customer</th>
                  <th className="px-4 py-3 text-left font-medium">Product</th>
                  <th className="px-4 py-3 text-left font-medium">Total Usage</th>
                  <th className="px-4 py-3 text-left font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-slate-600" colSpan={5}>
                      Loading storage usage...
                    </td>
                  </tr>
                )}

                {!isLoading && !errorMessage && storageUsages.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-slate-600" colSpan={5}>
                      No storage usage found.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  storageUsages.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 last:border-b-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {formatLabel(item.serviceType)}
                        </p>
                        <p className="text-xs text-slate-500">{item.id}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.customerId}</td>
                      <td className="px-4 py-3 text-slate-700">{item.productId}</td>
                      <td className="px-4 py-3 text-slate-700">{item.totalUsages}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(item.updatedAt || item.createdAt)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "trial" && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Service</th>
                  <th className="px-4 py-3 text-left font-medium">Customer</th>
                  <th className="px-4 py-3 text-left font-medium">Storage</th>
                  <th className="px-4 py-3 text-left font-medium">CPU</th>
                  <th className="px-4 py-3 text-left font-medium">GPU</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-slate-600" colSpan={7}>
                      Loading trial storage usage...
                    </td>
                  </tr>
                )}

                {!isLoading && !errorMessage && trialStorageUsages.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-slate-600" colSpan={7}>
                      No trial storage usage found.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  trialStorageUsages.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 last:border-b-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {formatLabel(item.serviceType)}
                        </p>
                        <p className="text-xs text-slate-500">{item.id}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.customerId}</td>
                      <td className="px-4 py-3 text-slate-700">{item.totalStorage}</td>
                      <td className="px-4 py-3 text-slate-700">{item.totalCpu}</td>
                      <td className="px-4 py-3 text-slate-700">{item.totalGpu}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            item.isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {item.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(item.updatedAt || item.createdAt)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};

export default StorageUsagePage;
