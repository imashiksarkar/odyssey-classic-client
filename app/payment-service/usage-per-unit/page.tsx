"use client";

import useAccessToken from "@/lib/use-access-token";
import axios from "axios";
import { Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type UsagePerUnit = {
  id: string;
  storage: number;
  cpu: number;
  gpu: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type UsagePerUnitApiResponse = {
  statusCode?: number;
  success?: boolean;
  message?: string;
  data?:
    | UsagePerUnit
    | {
        data?: UsagePerUnit;
      };
};

type FormValues = {
  storage: string;
  cpu: string;
  gpu: string;
};

const emptyForm: FormValues = {
  storage: "",
  cpu: "",
  gpu: "",
};

const normalizeUsagePerUnit = (
  payload: UsagePerUnitApiResponse | UsagePerUnit | null | undefined
) => {
  if (!payload) {
    return null;
  }

  if ("id" in payload) {
    return payload;
  }

  if (payload.data && !Array.isArray(payload.data) && "id" in payload.data) {
    return payload.data;
  }

  if (
    payload.data &&
    !Array.isArray(payload.data) &&
    "data" in payload.data &&
    payload.data.data &&
    "id" in payload.data.data
  ) {
    return payload.data.data;
  }

  return null;
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

const toFormValues = (value: UsagePerUnit | null): FormValues =>
  value
    ? {
        storage: String(value.storage),
        cpu: String(value.cpu),
        gpu: String(value.gpu),
      }
    : emptyForm;

const formatNumber = (value?: number | string | null) => {
  const number = Number(value ?? 0);

  if (Number.isNaN(number)) {
    return "0";
  }

  return number.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
};

const UsagePerUnitPage = () => {
  const { accessToken, isTokenLoading, tokenError } = useAccessToken();
  const [record, setRecord] = useState<UsagePerUnit | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const hasRecord = Boolean(record?.id);

  const isDirty = useMemo(() => {
    const baseline = toFormValues(record);
    return (
      form.storage !== baseline.storage ||
      form.cpu !== baseline.cpu ||
      form.gpu !== baseline.gpu
    );
  }, [form, record]);

  useEffect(() => {
    const fetchUsagePerUnit = async () => {
      if (isTokenLoading) {
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      if (!accessToken) {
        setRecord(null);
        setForm(emptyForm);
        setErrorMessage(tokenError || "Access token not found. Please login again.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await axios.get<UsagePerUnitApiResponse>(
          `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL}/usage-per-unit`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const nextRecord = normalizeUsagePerUnit(response.data);
        setRecord(nextRecord);
        setForm(toFormValues(nextRecord));
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setRecord(null);
          setForm(emptyForm);
          return;
        }

        console.error("Failed to fetch usage per unit", error);
        setErrorMessage("Failed to load usage per unit.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsagePerUnit();
  }, [accessToken, isTokenLoading, tokenError]);

  const handleChange = (field: keyof FormValues, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const parsePayload = () => {
    const storage = Number(form.storage);
    const cpu = Number(form.cpu);
    const gpu = Number(form.gpu);

    if ([storage, cpu, gpu].some((value) => Number.isNaN(value) || value <= 0)) {
      return null;
    }

    return { storage, cpu, gpu };
  };

  const handleSubmit = async () => {
    const payload = parsePayload();

    if (!payload) {
      setErrorMessage("Storage, CPU, and GPU must be numbers greater than 0.");
      setSuccessMessage("");
      return;
    }

    if (!accessToken) {
      setErrorMessage("Access token not found. Please login again.");
      setSuccessMessage("");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = record
        ? await axios.put<UsagePerUnitApiResponse>(
            `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL}/usage-per-unit/${record.id}`,
            payload,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          )
        : await axios.post<UsagePerUnitApiResponse>(
            `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL}/usage-per-unit`,
            payload,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

      const nextRecord = normalizeUsagePerUnit(response.data);
      setRecord(nextRecord);
      setForm(toFormValues(nextRecord));
      setSuccessMessage(
        hasRecord
          ? "Usage per unit updated successfully."
          : "Usage per unit created successfully."
      );
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setErrorMessage(error.response?.data?.message || "Request failed.");
      } else {
        setErrorMessage("Request failed.");
      }
      setSuccessMessage("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="min-h-screen bg-slate-50 px-4 py-6 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-950">Usage Per Unit</h1>
          <p className="mt-1 text-sm text-slate-600">
            Create and maintain the shared storage, CPU, and GPU pricing record.
          </p>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Storage</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {formatNumber(form.storage)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">CPU</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {formatNumber(form.cpu)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">GPU</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {formatNumber(form.gpu)}
            </p>
          </div>
        </div>

        <div className="mb-4 space-y-3">
          {errorMessage && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_360px]">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {hasRecord ? "Update Record" : "Create Record"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {hasRecord
                    ? "Adjust the current singleton usage-per-unit record."
                    : "No record exists yet. Create the initial usage-per-unit record."}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Storage
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.storage}
                  onChange={(event) => handleChange("storage", event.target.value)}
                  placeholder="Enter storage cost"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-500"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  CPU
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.cpu}
                  onChange={(event) => handleChange("cpu", event.target.value)}
                  placeholder="Enter CPU cost"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-500"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  GPU
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.gpu}
                  onChange={(event) => handleChange("gpu", event.target.value)}
                  placeholder="Enter GPU cost"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none focus:border-slate-500"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || isSubmitting || (hasRecord && !isDirty)}
                className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#111] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isSubmitting
                  ? hasRecord
                    ? "Updating..."
                    : "Creating..."
                  : hasRecord
                    ? "Save changes"
                    : "Create record"}
              </button>
            </div>
          </div>

          <aside className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-950">Current Record</h2>
            <p className="mt-1 text-sm text-slate-500">
              Review the current saved values.
            </p>

            {isLoading ? (
              <p className="mt-6 text-sm text-slate-600">Loading usage per unit...</p>
            ) : record ? (
              <>
                <div className="mt-6 space-y-3">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Storage</p>
                    <p className="mt-1 text-xl font-semibold text-slate-950">
                      {formatNumber(record.storage)}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">CPU</p>
                    <p className="mt-1 text-xl font-semibold text-slate-950">
                      {formatNumber(record.cpu)}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">GPU</p>
                    <p className="mt-1 text-xl font-semibold text-slate-950">
                      {formatNumber(record.gpu)}
                    </p>
                  </div>
                </div>

                <dl className="mt-6 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                    <dt className="text-slate-500">Created</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {formatDate(record.createdAt)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500">Updated</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {formatDate(record.updatedAt)}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <div className="mt-6 rounded-md border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                No usage-per-unit record exists yet.
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
};

export default UsagePerUnitPage;
