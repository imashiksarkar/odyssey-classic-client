"use client";

import { AuthContext } from "@/app/auth-wrapper";
import useAccessToken from "@/lib/use-access-token";
import axios from "axios";
import { Download, ExternalLink, Eye } from "lucide-react";
import { use, useEffect, useMemo, useState } from "react";

type InvoiceItem = {
  id: string;
  stripeInvoiceId: string;
  customerId: string;
  stripeSubscriptionId: string;
  status?: string | null;
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  hostedInvoiceUrl?: string | null;
  invoicePdf?: string | null;
  periodStart: string;
  periodEnd: string;
  dueDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type InvoiceMeta = {
  page?: number;
  limit?: number;
  total?: number;
};

type InvoicePayload = {
  meta?: InvoiceMeta;
  data?: InvoiceItem[];
};

type ApiResponse<T> = {
  statusCode?: number;
  success?: boolean;
  message?: string;
  data?: T | { data?: T };
};

const modalBaseClass =
  "fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4";

const normalizeInvoicePayload = (payload: ApiResponse<InvoicePayload> | null | undefined) => {
  if (!payload?.data) {
    return { meta: {}, data: [] as InvoiceItem[] };
  }

  if ("data" in payload.data && payload.data.data) {
    return {
      meta: payload.data.meta || {},
      data: payload.data.data || [],
    };
  }

  return {
    meta: {},
    data: [],
  };
};

const formatDate = (value?: string | null) => {
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

const formatCurrency = (value?: number | null) => `$${Number(value || 0).toFixed(2)}`;

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

const InvoicesPage = () => {
  const { user } = use(AuthContext);
  const { accessToken, isTokenLoading, tokenError } = useAccessToken();
  const currentUserId = useMemo(
    () => getCurrentUserId(user) || getUserIdFromAccessToken(accessToken),
    [accessToken, user]
  );

  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const [meta, setMeta] = useState<InvoiceMeta>({});
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const totalPages = useMemo(() => {
    const total = Number(meta.total || 0);
    return total > 0 ? Math.ceil(total / limit) : 1;
  }, [limit, meta.total]);

  useEffect(() => {
    const fetchInvoices = async () => {
      if (isTokenLoading) {
        return;
      }

      setIsLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (!accessToken) {
        setInvoices([]);
        setErrorMessage(tokenError || "Access token not found. Please login again.");
        setIsLoading(false);
        return;
      }

      if (!currentUserId) {
        setInvoices([]);
        setErrorMessage("User profile is missing an id. Refresh profile and try again.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await axios.get<ApiResponse<InvoicePayload>>(
          `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL}/customer/get-invoice-data/${currentUserId}`,
          {
            params: {
              page,
              limit,
            },
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const normalized = normalizeInvoicePayload(response.data);
        setInvoices(normalized.data || []);
        setMeta(normalized.meta || {});
        setSuccessMessage("Invoices retrieved successfully.");
      } catch (error: unknown) {
        console.error("Failed to fetch invoices", error);
        if (axios.isAxiosError(error)) {
          setErrorMessage(error.response?.data?.message || "Failed to load invoices.");
        } else {
          setErrorMessage("Failed to load invoices.");
        }
        setInvoices([]);
        setMeta({});
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvoices();
  }, [accessToken, currentUserId, isTokenLoading, limit, page, tokenError]);

  return (
    <>
      <section className="px-4 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">Invoices</h1>
          <p className="mt-1 text-sm text-slate-600">
            View your invoice history, inspect invoice details, and download PDF copies.
          </p>
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
                  <th className="px-4 py-3 text-left font-medium">Invoice</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Amount Due</th>
                  <th className="px-4 py-3 text-left font-medium">Amount Paid</th>
                  <th className="px-4 py-3 text-left font-medium">Remaining</th>
                  <th className="px-4 py-3 text-left font-medium">Period</th>
                  <th className="px-4 py-3 text-left font-medium">Due Date</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-slate-600" colSpan={8}>
                      Loading invoices...
                    </td>
                  </tr>
                )}

                {!isLoading && invoices.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-slate-600" colSpan={8}>
                      No invoices found.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b border-gray-100 last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {invoice.stripeInvoiceId}
                        </p>
                        <p className="text-xs text-slate-500">
                          {invoice.stripeSubscriptionId}
                        </p>
                      </td>
                      <td className="px-4 py-3">{formatLabel(invoice.status)}</td>
                      <td className="px-4 py-3">{formatCurrency(invoice.amountDue)}</td>
                      <td className="px-4 py-3">{formatCurrency(invoice.amountPaid)}</td>
                      <td className="px-4 py-3">
                        {formatCurrency(invoice.amountRemaining)}
                      </td>
                      <td className="px-4 py-3">
                        {formatDate(invoice.periodStart)} to {formatDate(invoice.periodEnd)}
                      </td>
                      <td className="px-4 py-3">{formatDate(invoice.dueDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoice(invoice)}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm transition-colors hover:bg-slate-50"
                          >
                            <Eye className="h-4 w-4" />
                            Details
                          </button>
                          {invoice.invoicePdf && (
                            <a
                              href={invoice.invoicePdf}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm transition-colors hover:bg-slate-50"
                            >
                              <Download className="h-4 w-4" />
                              PDF
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm">
            <p className="text-slate-500">
              Total {meta.total || 0} invoices. Page {page} of {totalPages}.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || isLoading}
                className="cursor-pointer rounded-md border border-gray-300 px-3 py-2 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setPage((current) => (current < totalPages ? current + 1 : current))
                }
                disabled={page >= totalPages || isLoading}
                className="cursor-pointer rounded-md border border-gray-300 px-3 py-2 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>

      {selectedInvoice && (
        <div className={modalBaseClass}>
          <div className="w-full max-w-3xl rounded-lg bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Invoice Details</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedInvoice.stripeInvoiceId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="cursor-pointer rounded-md px-2 py-1 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <p>
                <span className="font-medium">Status:</span>{" "}
                {formatLabel(selectedInvoice.status)}
              </p>
              <p>
                <span className="font-medium">Customer ID:</span>{" "}
                {selectedInvoice.customerId}
              </p>
              <p>
                <span className="font-medium">Subscription:</span>{" "}
                {selectedInvoice.stripeSubscriptionId}
              </p>
              <p>
                <span className="font-medium">Amount Due:</span>{" "}
                {formatCurrency(selectedInvoice.amountDue)}
              </p>
              <p>
                <span className="font-medium">Amount Paid:</span>{" "}
                {formatCurrency(selectedInvoice.amountPaid)}
              </p>
              <p>
                <span className="font-medium">Amount Remaining:</span>{" "}
                {formatCurrency(selectedInvoice.amountRemaining)}
              </p>
              <p>
                <span className="font-medium">Period Start:</span>{" "}
                {formatDateTime(selectedInvoice.periodStart)}
              </p>
              <p>
                <span className="font-medium">Period End:</span>{" "}
                {formatDateTime(selectedInvoice.periodEnd)}
              </p>
              <p>
                <span className="font-medium">Due Date:</span>{" "}
                {formatDateTime(selectedInvoice.dueDate)}
              </p>
              <p>
                <span className="font-medium">Created:</span>{" "}
                {formatDateTime(selectedInvoice.createdAt)}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {selectedInvoice.hostedInvoiceUrl && (
                <a
                  href={selectedInvoice.hostedInvoiceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm transition-colors hover:bg-slate-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Hosted Invoice
                </a>
              )}
              {selectedInvoice.invoicePdf && (
                <a
                  href={selectedInvoice.invoicePdf}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm text-white transition-colors hover:bg-[#111]"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InvoicesPage;
