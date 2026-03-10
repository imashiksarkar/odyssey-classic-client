"use client";

import useAccessToken from "@/lib/use-access-token";
import axios from "axios";
import { MoreVertical, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type ServiceType = "AVATAR_SSO" | "ASSETS_MANAGER";

type UsageTrialLimit = {
  id: string;
  serviceType: ServiceType;
  storage: number;
  cpuMinute: number;
  gpuMinute: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type UsageTrialLimitApiResponse = {
  statusCode?: number;
  success?: boolean;
  message?: string;
  data?:
    | UsageTrialLimit[]
    | UsageTrialLimit
    | {
        data?: UsageTrialLimit[] | UsageTrialLimit;
      };
};

type FormValues = {
  serviceType: ServiceType;
  storage: string;
  cpuMinute: string;
  gpuMinute: string;
};

const serviceTypeOptions: ServiceType[] = ["AVATAR_SSO", "ASSETS_MANAGER"];

const emptyForm: FormValues = {
  serviceType: "AVATAR_SSO",
  storage: "",
  cpuMinute: "",
  gpuMinute: "",
};

const modalBaseClass =
  "fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4";

const normalizeTrialLimits = (
  payload: UsageTrialLimitApiResponse | UsageTrialLimit[] | null | undefined
): UsageTrialLimit[] => {
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

const formatLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const toFormValues = (value: UsageTrialLimit | null): FormValues =>
  value
    ? {
        serviceType: value.serviceType,
        storage: String(value.storage),
        cpuMinute: String(value.cpuMinute),
        gpuMinute: String(value.gpuMinute),
      }
    : emptyForm;

const UsageTrialLimitPage = () => {
  const { accessToken, isTokenLoading, tokenError } = useAccessToken();
  const [trialLimits, setTrialLimits] = useState<UsageTrialLimit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [selectedItem, setSelectedItem] = useState<UsageTrialLimit | null>(null);
  const [detailsItem, setDetailsItem] = useState<UsageTrialLimit | null>(null);
  const [deleteItem, setDeleteItem] = useState<UsageTrialLimit | null>(null);
  const [actionMenu, setActionMenu] = useState<{
    item: UsageTrialLimit;
    left: number;
    top: number;
    openUp: boolean;
  } | null>(null);

  const modalTitle = useMemo(() => {
    if (formMode === "add") {
      return "Add Trial Limit";
    }
    if (formMode === "edit") {
      return "Edit Trial Limit";
    }
    return "";
  }, [formMode]);

  useEffect(() => {
    const fetchTrialLimits = async () => {
      if (isTokenLoading) {
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      if (!accessToken) {
        setTrialLimits([]);
        setErrorMessage(tokenError || "Access token not found. Please login again.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await axios.get<UsageTrialLimitApiResponse>(
          `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL}/usage-trial-limitation`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        setTrialLimits(
          normalizeTrialLimits(response.data).sort((a, b) =>
            a.serviceType.localeCompare(b.serviceType)
          )
        );
      } catch (error) {
        console.error("Failed to fetch usage trial limits", error);
        setTrialLimits([]);
        setErrorMessage("Failed to load usage trial limits.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrialLimits();
  }, [accessToken, isTokenLoading, tokenError]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-action-menu]")) {
        setActionMenu(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const resetFeedback = () => {
    setErrorMessage("");
    setSuccessMessage("");
  };

  const resetForm = () => {
    setForm(emptyForm);
    setSelectedItem(null);
    setFormMode(null);
  };

  const handleChange = (field: keyof FormValues, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const parsePayload = () => {
    const storage = Number(form.storage);
    const cpuMinute = Number(form.cpuMinute);
    const gpuMinute = Number(form.gpuMinute);

    if (
      [storage, cpuMinute, gpuMinute].some(
        (value) => Number.isNaN(value) || value < 0
      )
    ) {
      return null;
    }

    return {
      serviceType: form.serviceType,
      storage,
      cpuMinute,
      gpuMinute,
    };
  };

  const openAddModal = () => {
    resetFeedback();
    setSelectedItem(null);
    setForm(emptyForm);
    setFormMode("add");
  };

  const openEditModal = (item: UsageTrialLimit) => {
    resetFeedback();
    setSelectedItem(item);
    setForm(toFormValues(item));
    setFormMode("edit");
  };

  const closeFormModal = () => {
    resetForm();
  };

  const handleSubmit = async () => {
    const payload = parsePayload();

    if (!payload) {
      setErrorMessage("Storage, CPU minute, and GPU minute must be 0 or greater.");
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
      const response =
        formMode === "edit" && selectedItem
          ? await axios.put<UsageTrialLimitApiResponse>(
              `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL}/usage-trial-limitation/${selectedItem.id}`,
              payload,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            )
          : await axios.post<UsageTrialLimitApiResponse>(
              `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL}/usage-trial-limitation`,
              payload,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            );

      const result =
        normalizeTrialLimits(response.data)[0] ||
        (response.data &&
        "data" in response.data &&
        response.data.data &&
        !Array.isArray(response.data.data)
          ? response.data.data
          : null);

      if (result && "id" in result) {
        setTrialLimits((current) => {
          if (formMode === "edit") {
            return current
              .map((item) => (item.id === result.id ? result : item))
              .sort((a, b) => a.serviceType.localeCompare(b.serviceType));
          }

          return [...current, result].sort((a, b) =>
            a.serviceType.localeCompare(b.serviceType)
          );
        });
      }

      setSuccessMessage(
        formMode === "edit"
          ? "Usage trial limit updated successfully."
          : "Usage trial limit created successfully."
      );
      closeFormModal();
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

  const openDeleteModal = (item: UsageTrialLimit) => {
    resetFeedback();
    setDeleteItem(item);
  };

  const handleDelete = async () => {
    if (!deleteItem) {
      return;
    }

    if (!accessToken) {
      setErrorMessage("Access token not found. Please login again.");
      setSuccessMessage("");
      return;
    }

    setIsDeleting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL}/usage-trial-limitation/${deleteItem.id}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      setTrialLimits((current) =>
        current.filter((entry) => entry.id !== deleteItem.id)
      );
      setDeleteItem(null);
      setSuccessMessage("Usage trial limit deleted successfully.");
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setErrorMessage(error.response?.data?.message || "Delete failed.");
      } else {
        setErrorMessage("Delete failed.");
      }
      setSuccessMessage("");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <section className="px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Usage Trial Limit</h1>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-[#111]"
          >
            <Plus size={16} />
            Add Trial Limit
          </button>
        </div>

        {errorMessage && <p className="mb-3 text-sm text-red-600">{errorMessage}</p>}
        {successMessage && (
          <p className="mb-3 text-sm text-green-600">{successMessage}</p>
        )}

        <div className="overflow-visible rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Service</th>
                  <th className="px-4 py-3 text-left font-medium">Storage</th>
                  <th className="px-4 py-3 text-left font-medium">CPU Minute</th>
                  <th className="px-4 py-3 text-left font-medium">GPU Minute</th>
                  <th className="px-4 py-3 text-left font-medium">Updated</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-slate-600" colSpan={6}>
                      Loading usage trial limits...
                    </td>
                  </tr>
                )}

                {!isLoading && trialLimits.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-slate-600" colSpan={6}>
                      No usage trial limits found.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  trialLimits.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-gray-100 last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {formatLabel(item.serviceType)}
                        </p>
                      </td>
                      <td className="px-4 py-3">{item.storage}</td>
                      <td className="px-4 py-3">{item.cpuMinute}</td>
                      <td className="px-4 py-3">{item.gpuMinute}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(item.updatedAt || item.createdAt)}
                      </td>
                      <td className="relative px-4 py-3 text-right">
                        <div
                          data-action-menu="true"
                          className="relative inline-block text-left"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              const rect = event.currentTarget.getBoundingClientRect();
                              const menuWidth = 128;
                              const menuHeight = 120;
                              const margin = 8;
                              const openUp = window.innerHeight - rect.bottom < menuHeight;
                              const left = Math.max(
                                margin,
                                Math.min(
                                  window.innerWidth - menuWidth - margin,
                                  rect.right - menuWidth
                                )
                              );
                              const top = openUp ? rect.top - 4 : rect.bottom + 4;

                              setActionMenu((prev) =>
                                prev?.item.id === item.id
                                  ? null
                                  : { item, left, top, openUp }
                              );
                            }}
                            className="cursor-pointer rounded-md p-2 transition-colors hover:bg-slate-100"
                          >
                            <MoreVertical size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {actionMenu && (
        <div
          data-action-menu="true"
          className="fixed z-[80] w-32 rounded-md border border-gray-200 bg-white shadow-md"
          style={{
            left: `${actionMenu.left}px`,
            top: `${actionMenu.top}px`,
            transform: actionMenu.openUp ? "translateY(-100%)" : "none",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setDetailsItem(actionMenu.item);
              setActionMenu(null);
            }}
            className="w-full cursor-pointer px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => {
              openEditModal(actionMenu.item);
              setActionMenu(null);
            }}
            className="w-full cursor-pointer px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              openDeleteModal(actionMenu.item);
              setActionMenu(null);
            }}
            className="w-full cursor-pointer px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      )}

      {formMode && (
        <div className={modalBaseClass}>
          <div className="w-full max-w-xl rounded-lg bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{modalTitle}</h2>
              <button
                type="button"
                onClick={closeFormModal}
                className="cursor-pointer rounded-md px-2 py-1 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-900">
                  Service Type
                </label>
                <select
                  value={form.serviceType}
                  onChange={(event) =>
                    handleChange("serviceType", event.target.value as ServiceType)
                  }
                  className="w-full rounded-md border border-gray-200 bg-[#f0f1f2] px-3 py-2 text-sm"
                >
                  {serviceTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatLabel(option)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">
                    Storage
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.storage}
                    onChange={(event) => handleChange("storage", event.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-[#f0f1f2] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">
                    CPU Minute
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.cpuMinute}
                    onChange={(event) => handleChange("cpuMinute", event.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-[#f0f1f2] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-900">
                    GPU Minute
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.gpuMinute}
                    onChange={(event) => handleChange("gpuMinute", event.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-[#f0f1f2] px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="cursor-pointer rounded-md border border-gray-300 px-4 py-2 text-sm transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-black px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Save className="h-4 w-4" />
                  {isSubmitting ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailsItem && (
        <div className={modalBaseClass}>
          <div className="w-full max-w-xl rounded-lg bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Trial Limit Details</h2>
              <button
                type="button"
                onClick={() => setDetailsItem(null)}
                className="cursor-pointer rounded-md px-2 py-1 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <p>
                <span className="font-medium">Service Type:</span>{" "}
                {formatLabel(detailsItem.serviceType)}
              </p>
              <p>
                <span className="font-medium">Storage:</span> {detailsItem.storage}
              </p>
              <p>
                <span className="font-medium">CPU Minute:</span> {detailsItem.cpuMinute}
              </p>
              <p>
                <span className="font-medium">GPU Minute:</span> {detailsItem.gpuMinute}
              </p>
              <p>
                <span className="font-medium">Created:</span>{" "}
                {formatDate(detailsItem.createdAt)}
              </p>
              <p>
                <span className="font-medium">Updated:</span>{" "}
                {formatDate(detailsItem.updatedAt)}
              </p>
            </div>
          </div>
        </div>
      )}

      {deleteItem && (
        <div className={modalBaseClass}>
          <div className="w-full max-w-md rounded-lg bg-white p-5">
            <h2 className="mb-2 text-lg font-semibold">Delete Trial Limit</h2>
            <p className="mb-4 text-sm text-slate-700">
              Are you sure you want to delete{" "}
              <span className="font-medium">
                {formatLabel(deleteItem.serviceType)}
              </span>
              ? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteItem(null)}
                className="cursor-pointer rounded-md border border-gray-300 px-4 py-2 text-sm transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UsageTrialLimitPage;
