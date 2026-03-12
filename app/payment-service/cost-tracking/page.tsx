"use client";

import { AuthContext } from "@/app/auth-wrapper";
import useAccessToken from "@/lib/use-access-token";
import axios from "axios";
import { CalendarDays, Search } from "lucide-react";
import { use, useMemo, useState } from "react";

type CostTrackingItem = {
  id: string;
  customerId: string;
  userId: string;
  productId: string;
  costOfUsage: number;
  costOfSdk: number;
  usage: number;
  timeTracker: number;
  serviceType: string;
  usageType: string;
  date: string;
  isBillingToStripe: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type UsageEventItem = {
  id: string;
  userId: string;
  productId: string;
  usage: number;
  timeTracker: number;
  cost: number;
  serviceType: string;
  usageType: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ApiResponse<T> = {
  statusCode?: number;
  success?: boolean;
  message?: string;
  data?: T | { data?: T };
};

type FormState = {
  fromDate: string;
  toDate: string;
};

const modalBaseClass =
  "fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4";

const today = new Date();
const defaultToDate = today.toISOString().slice(0, 10);
const defaultFromDate = new Date(
  today.getFullYear(),
  today.getMonth(),
  1
)
  .toISOString()
  .slice(0, 10);

const normalizeList = <T,>(payload: ApiResponse<T[]> | T[] | null | undefined): T[] => {
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

  return [];
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const formatDateLabel = (value?: string | null) => {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
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

const formatCurrency = (value?: number | null) => `$${Number(value || 0).toFixed(2)}`;

const formatNumber = (value?: number | null) =>
  Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });

const getCurrentUserId = (user: unknown) => {
  if (!user || typeof user !== "object") {
    return "";
  }

  const source = user as Record<string, unknown>;
  for (const key of ["id", "userId", "_id", "sub"]) {
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

const CostTrackingPage = () => {
  const { user } = use(AuthContext);
  const { accessToken, isTokenLoading, tokenError } = useAccessToken();
  const currentUserId = useMemo(
    () => getCurrentUserId(user) || getUserIdFromAccessToken(accessToken),
    [accessToken, user]
  );

  const [form, setForm] = useState<FormState>({
    fromDate: defaultFromDate,
    toDate: defaultToDate,
  });
  const [records, setRecords] = useState<CostTrackingItem[]>([]);
  const [details, setDetails] = useState<UsageEventItem[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<CostTrackingItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const getAuthHeaders = () =>
    accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : undefined;

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSearch = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    if (!form.fromDate || !form.toDate) {
      setErrorMessage("From date and to date are required.");
      return;
    }

    if (!accessToken) {
      setErrorMessage(tokenError || "Access token not found. Please login again.");
      return;
    }

    if (!currentUserId) {
      setErrorMessage("User profile is missing an id. Refresh profile and try again.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.get<ApiResponse<CostTrackingItem[]>>(
        `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL}/customer/get-cost-tracking/${currentUserId}`,
        {
          params: {
            fromDate: form.fromDate,
            toDate: form.toDate,
          },
          headers: getAuthHeaders(),
        }
      );

      setRecords(normalizeList(response.data));
      setSuccessMessage("Cost tracking retrieved successfully.");
    } catch (error: unknown) {
      console.error("Failed to fetch cost tracking", error);
      if (axios.isAxiosError(error)) {
        setErrorMessage(error.response?.data?.message || "Failed to load cost tracking.");
      } else {
        setErrorMessage("Failed to load cost tracking.");
      }
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDetails = async (record: CostTrackingItem) => {
    setSelectedRecord(record);
    setDetails([]);
    setIsDetailsLoading(true);

    try {
      const response = await axios.get<ApiResponse<UsageEventItem[]>>(
        `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL}/customer/get-cost-details/${record.id}`,
        {
          headers: getAuthHeaders(),
        }
      );

      setDetails(normalizeList(response.data));
    } catch (error) {
      console.error("Failed to fetch cost tracking details", error);
      setDetails([]);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  return (
    <>
      <section className="px-4 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">Cost Tracking</h1>
          <p className="mt-1 text-sm text-slate-600">
            Select a date range to view your cost tracking records and inspect event
            details.
          </p>
        </div>

        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <CalendarDays className="h-4 w-4" />
                From Date
              </span>
              <input
                type="date"
                value={form.fromDate}
                onChange={(event) => handleChange("fromDate", event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                <CalendarDays className="h-4 w-4" />
                To Date
              </span>
              <input
                type="date"
                value={form.toDate}
                onChange={(event) => handleChange("toDate", event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleSearch}
                disabled={isLoading || isTokenLoading}
                className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-black px-4 py-2 text-sm text-white transition-colors hover:bg-[#111] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Search className="h-4 w-4" />
                {isLoading ? "Loading..." : "Search"}
              </button>
            </div>
          </div>
        </div>

        {errorMessage && <p className="mb-3 text-sm text-red-600">{errorMessage}</p>}
        {successMessage && (
          <p className="mb-3 text-sm text-green-600">{successMessage}</p>
        )}

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Service</th>
                  <th className="px-4 py-3 text-left font-medium">Usage Type</th>
                  <th className="px-4 py-3 text-left font-medium">Usage</th>
                  <th className="px-4 py-3 text-left font-medium">Cost Of Usage</th>
                  <th className="px-4 py-3 text-left font-medium">Cost Of SDK</th>
                  <th className="px-4 py-3 text-left font-medium">Billing</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-slate-600" colSpan={8}>
                      Loading cost tracking...
                    </td>
                  </tr>
                )}

                {!isLoading && records.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-slate-600" colSpan={8}>
                      No cost tracking records found for the selected range.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  records.map((record) => (
                    <tr
                      key={record.id}
                      className="border-b border-gray-100 last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {formatLabel(record.serviceType)}
                        </p>
                        <p className="text-xs text-slate-500">{record.productId}</p>
                      </td>
                      <td className="px-4 py-3">{formatLabel(record.usageType)}</td>
                      <td className="px-4 py-3">{formatNumber(record.usage)}</td>
                      <td className="px-4 py-3">{formatCurrency(record.costOfUsage / 100)}</td>
                      <td className="px-4 py-3">{formatCurrency(record.costOfSdk / 100)}</td>
                      <td className="px-4 py-3">
                        {record.isBillingToStripe ? "Billed" : "Pending"}
                      </td>
                      <td className="px-4 py-3">{formatDateLabel(record.date)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenDetails(record)}
                          className="cursor-pointer rounded-md border border-gray-300 px-3 py-2 text-sm transition-colors hover:bg-slate-50"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {selectedRecord && (
        <div className={modalBaseClass}>
          <div className="w-full max-w-4xl rounded-lg bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Cost Tracking Details</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {formatLabel(selectedRecord.serviceType)} on{" "}
                  {formatDateLabel(selectedRecord.date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="cursor-pointer rounded-md px-2 py-1 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mb-4 grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-500">Cost Of Usage</p>
                <p className="mt-1 font-medium text-slate-900">
                  {formatCurrency(selectedRecord.costOfUsage / 100)}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-500">Cost Of SDK</p>
                <p className="mt-1 font-medium text-slate-900">
                  {formatCurrency(selectedRecord.costOfSdk / 100)}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-500">Usage</p>
                <p className="mt-1 font-medium text-slate-900">
                  {formatNumber(selectedRecord.usage)}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-gray-200 bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Service</th>
                      <th className="px-4 py-3 text-left font-medium">Usage Type</th>
                      <th className="px-4 py-3 text-left font-medium">Usage</th>
                      <th className="px-4 py-3 text-left font-medium">Time Tracker</th>
                      <th className="px-4 py-3 text-left font-medium">Cost</th>
                      <th className="px-4 py-3 text-left font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isDetailsLoading && (
                      <tr>
                        <td className="px-4 py-6 text-slate-600" colSpan={6}>
                          Loading cost details...
                        </td>
                      </tr>
                    )}

                    {!isDetailsLoading && details.length === 0 && (
                      <tr>
                        <td className="px-4 py-6 text-slate-600" colSpan={6}>
                          No usage events returned for this cost tracking record.
                        </td>
                      </tr>
                    )}

                    {!isDetailsLoading &&
                      details.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-gray-100 last:border-b-0"
                        >
                          <td className="px-4 py-3">{formatLabel(item.serviceType)}</td>
                          <td className="px-4 py-3">{formatLabel(item.usageType)}</td>
                          <td className="px-4 py-3">{formatNumber(item.usage)}</td>
                          <td className="px-4 py-3">
                            {formatNumber(item.timeTracker)}
                          </td>
                          <td className="px-4 py-3">{formatCurrency(item.cost /100)}</td>
                          <td className="px-4 py-3">
                            {formatDateTime(item.createdAt)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CostTrackingPage;
