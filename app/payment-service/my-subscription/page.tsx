"use client";

import useAccessToken from "@/lib/use-access-token";
import { MoreVertical } from "lucide-react";
import axios from "axios";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { AuthContext } from "@/app/auth-wrapper";

type SubscriptionProduct = {
  id: string;
  displayName: string;
  description?: string | null;
  serviceType: string;
  billingPeriod: string;
  totalUsdCents: number;
  trialPeriod: number;
  discount: number;
  isSdk: boolean;
};

type SubscriptionItem = {
  id: string;
  productId: string;
  stripeSubscriptionItemId: string;
  product?: SubscriptionProduct;
};

type Subscription = {
  id: string;
  customerId: string;
  stripeSubscriptionId: string;
  stripeScheduleId?: string | null;
  trialStart?: string | null;
  trialEnd?: string | null;
  cancelAtPeriodEnd: boolean;
  serviceType: string;
  isActive: boolean;
  isTrial: boolean;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  subscriptionItems?: SubscriptionItem[];
};

type SubscriptionsApiResponse = {
  statusCode?: number;
  success?: boolean;
  message?: string;
  data?: Subscription[] | Subscription | { data?: Subscription[] | Subscription };
};

const modalBaseClass =
  "fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4";

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
  }).format(date);
};

const formatLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatPrice = (cents?: number) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

const normalizeSubscriptions = (
  payload: SubscriptionsApiResponse | Subscription[] | null | undefined
) => {
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

const normalizeSubscriptionDetail = (
  payload: SubscriptionsApiResponse | Subscription | null | undefined
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
    !Array.isArray(payload.data.data) &&
    "id" in payload.data.data
  ) {
    return payload.data.data;
  }

  return null;
};

const getStatusClassName = (subscription: Subscription) => {
  if (subscription.isTrial) {
    return "bg-amber-100 text-amber-700";
  }

  if (subscription.isActive) {
    return "bg-emerald-100 text-emerald-700";
  }

  return "bg-rose-100 text-rose-700";
};

const MySubscriptionPage = () => {
  const {email, accessToken, isTokenLoading, tokenError, refreshAccessToken, } =
    useAccessToken();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [actionMenu, setActionMenu] = useState<{
    subscription: Subscription;
    left: number;
    top: number;
    openUp: boolean;
  } | null>(null);
  const [detailsSubscription, setDetailsSubscription] = useState<Subscription | null>(
    null
  );
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: "cancel" | "resume" | "upgrade";
    subscription: Subscription;
    immediate?: boolean;
  } | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  useEffect(() => {
    const fetchSubscriptions = async () => {
      if (isTokenLoading) {
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      if (!accessToken) {
        setSubscriptions([]);
        setErrorMessage(tokenError || "Access token not found. Please login again.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await axios.get<SubscriptionsApiResponse>(
          `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL}/subscriptions/user`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const nextSubscriptions = normalizeSubscriptions(response.data).sort(
          (a, b) =>
            new Date(b.currentPeriodEnd).getTime() -
            new Date(a.currentPeriodEnd).getTime()
        );

        setSubscriptions(nextSubscriptions);
      } catch (error) {
        console.error("Failed to fetch subscriptions", error);
        setSubscriptions([]);
        setErrorMessage("Failed to load subscriptions.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscriptions();
  }, [accessToken, isTokenLoading, reloadKey, tokenError]);

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

  const summary = useMemo(() => {
    const activeCount = subscriptions.filter((item) => item.isActive).length;
    const trialCount = subscriptions.filter((item) => item.isTrial).length;

    return {
      total: subscriptions.length,
      activeCount,
      trialCount,
    };
  }, [subscriptions]);

  const handleRefresh = async () => {
    setSuccessMessage("");
    await refreshAccessToken();
    setReloadKey((current) => current + 1);
  };

  const getAuthHeaders = () =>
    accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : undefined;

  const handleOpenDetails = async (subscription: Subscription) => {
    setActionMenu(null);
    setDetailsSubscription(subscription);
    setIsDetailsLoading(true);

    try {
      const response = await axios.get<SubscriptionsApiResponse>(
        `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL}/subscriptions/${subscription.id}`,
        {
          headers: getAuthHeaders(),
        }
      );

      const detail = normalizeSubscriptionDetail(response.data);
      if (detail) {
        setDetailsSubscription(detail);
      }
    } catch (error) {
      console.error("Failed to fetch subscription details", error);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) {
      return;
    }

    setIsSubmittingAction(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (confirmAction.type === "cancel") {
        await axios.put(
          `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL}/subscriptions/cancel/${confirmAction.subscription.stripeSubscriptionId}?immediate=${confirmAction.immediate ? "true" : "false"}`,
          undefined,
          { headers: getAuthHeaders() }
        );
        setSuccessMessage(
          confirmAction.immediate
            ? "Subscription cancelled immediately."
            : "Subscription cancellation scheduled successfully."
        );
      }

      if (confirmAction.type === "resume") {
        await axios.put(
          `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL}/subscriptions/resume/${confirmAction.subscription.stripeSubscriptionId}`,
          undefined,
          { headers: getAuthHeaders() }
        );
        setSuccessMessage("Subscription resumed successfully.");
      }

      if (confirmAction.type === "upgrade") {
        await axios.put(
          `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL}/subscriptions/trial-plan-update`,
          {
            email: email,
            serviceType: confirmAction.subscription.serviceType,
          },
          { headers: getAuthHeaders() }
        );
        setSuccessMessage("Trial subscription upgraded successfully.");
      }

      setConfirmAction(null);
      setReloadKey((current) => current + 1);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setErrorMessage(error.response?.data?.message || "Request failed.");
      } else {
        setErrorMessage("Request failed.");
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  return (
    <>
      <section className="px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">My Subscription</h1>
            <p className="mt-1 text-sm text-slate-600">
              Total {summary.total} subscriptions, {summary.activeCount} active,{" "}
              {summary.trialCount} trial.
            </p>
          </div>

          
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
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Current Period</th>
                  <th className="px-4 py-3 text-left font-medium">Trial</th>
                  <th className="px-4 py-3 text-left font-medium">Renewal</th>
                  <th className="px-4 py-3 text-left font-medium">Stripe ID</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-slate-600" colSpan={7}>
                      Loading subscriptions...
                    </td>
                  </tr>
                )}

                {!isLoading && !errorMessage && subscriptions.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-slate-600" colSpan={7}>
                      No subscriptions found.{" "}
                      <Link
                        href="/payment-service/sdk-plan"
                        className="font-medium text-slate-900 underline underline-offset-2"
                      >
                        Choose a plan
                      </Link>
                      .
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  subscriptions.map((subscription) => (
                    <tr
                      key={subscription.id}
                      className="border-b border-gray-100 last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {formatLabel(subscription.serviceType)}
                        </p>
                        <p className="text-xs text-slate-500">{subscription.customerId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClassName(
                            subscription
                          )}`}
                        >
                          {subscription.isTrial
                            ? "Trial"
                            : formatLabel(subscription.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p>{formatDate(subscription.currentPeriodStart)}</p>
                        <p className="text-xs text-slate-500">
                          to {formatDate(subscription.currentPeriodEnd)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {subscription.isTrial ? (
                          <>
                            <p>{formatDate(subscription.trialStart)}</p>
                            <p className="text-xs text-slate-500">
                              to {formatDate(subscription.trialEnd)}
                            </p>
                          </>
                        ) : (
                          <span className="text-slate-500">No trial</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {subscription.cancelAtPeriodEnd
                          ? "Cancels at period end"
                          : "Auto renew"}
                      </td>
                      <td className="px-4 py-3">
                        <p className="max-w-56 truncate text-slate-900">
                          {subscription.stripeSubscriptionId}
                        </p>
                        {subscription.stripeScheduleId && (
                          <p className="max-w-56 truncate text-xs text-slate-500">
                            Schedule: {subscription.stripeScheduleId}
                          </p>
                        )}
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
                              const menuWidth = 164;
                              const menuHeight = 160;
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
                                prev?.subscription.id === subscription.id
                                  ? null
                                  : { subscription, left, top, openUp }
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
          className="fixed z-[80] w-40 rounded-md border border-gray-200 bg-white shadow-md"
          style={{
            left: `${actionMenu.left}px`,
            top: `${actionMenu.top}px`,
            transform: actionMenu.openUp ? "translateY(-100%)" : "none",
          }}
        >
          <button
            type="button"
            onClick={() => handleOpenDetails(actionMenu.subscription)}
            className="w-full cursor-pointer px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
          >
            Details
          </button>
          {actionMenu.subscription.cancelAtPeriodEnd ? (
            <button
              type="button"
              onClick={() => {
                setConfirmAction({
                  type: "resume",
                  subscription: actionMenu.subscription,
                  immediate: false,
                });
                setActionMenu(null);
              }}
              className="w-full cursor-pointer px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
            >
              Resume
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setConfirmAction({
                  type: "cancel",
                  subscription: actionMenu.subscription,
                  immediate: false,
                });
                setActionMenu(null);
              }}
              className="w-full cursor-pointer px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
            >
              Cancel
            </button>
          )}
          {actionMenu.subscription.isTrial && (
            <button
              type="button"
              onClick={() => {
                setConfirmAction({
                  type: "upgrade",
                  subscription: actionMenu.subscription,
                  immediate: false,
                });
                setActionMenu(null);
              }}
              className="w-full cursor-pointer px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
            >
              Trial To Paid
            </button>
          )}
        </div>
      )}

      {detailsSubscription && (
        <div className={modalBaseClass}>
          <div className="w-full max-w-3xl rounded-lg bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Subscription Details</h2>
              <button
                type="button"
                onClick={() => setDetailsSubscription(null)}
                className="cursor-pointer rounded-md px-2 py-1 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            {isDetailsLoading ? (
              <p className="text-sm text-slate-600">Loading details...</p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                  <p>
                    <span className="font-medium">Service Type:</span>{" "}
                    {formatLabel(detailsSubscription.serviceType)}
                  </p>
                  <p>
                    <span className="font-medium">Status:</span>{" "}
                    {detailsSubscription.isTrial
                      ? "Trial"
                      : formatLabel(detailsSubscription.status)}
                  </p>
                  <p>
                    <span className="font-medium">Current Period:</span>{" "}
                    {formatDate(detailsSubscription.currentPeriodStart)} to{" "}
                    {formatDate(detailsSubscription.currentPeriodEnd)}
                  </p>
                  <p>
                    <span className="font-medium">Trial:</span>{" "}
                    {detailsSubscription.isTrial
                      ? `${formatDate(detailsSubscription.trialStart)} to ${formatDate(
                          detailsSubscription.trialEnd
                        )}`
                      : "No trial"}
                  </p>
                  <p>
                    <span className="font-medium">Renewal:</span>{" "}
                    {detailsSubscription.cancelAtPeriodEnd
                      ? "Cancels at period end"
                      : "Auto renew"}
                  </p>
                  <p>
                    <span className="font-medium">Stripe Subscription:</span>{" "}
                    {detailsSubscription.stripeSubscriptionId}
                  </p>
                  <p>
                    <span className="font-medium">Stripe Schedule:</span>{" "}
                    {detailsSubscription.stripeScheduleId || "N/A"}
                  </p>
                </div>

                <div className="mt-5">
                  <h3 className="mb-3 text-base font-semibold">Subscription Items</h3>

                  {detailsSubscription.subscriptionItems?.length ? (
                    <div className="overflow-hidden rounded-md border border-gray-200">
                      <table className="min-w-full text-sm">
                        <thead className="border-b border-gray-200 bg-slate-50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">Product</th>
                            <th className="px-4 py-3 text-left font-medium">Billing</th>
                            <th className="px-4 py-3 text-left font-medium">Price</th>
                            <th className="px-4 py-3 text-left font-medium">Trial</th>
                            <th className="px-4 py-3 text-left font-medium">Stripe Item</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailsSubscription.subscriptionItems.map((item) => (
                            <tr
                              key={item.id}
                              className="border-b border-gray-100 last:border-b-0"
                            >
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-900">
                                  {item.product?.displayName || item.productId}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {item.product?.serviceType
                                    ? formatLabel(item.product.serviceType)
                                    : "Product"}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                {item.product?.billingPeriod
                                  ? formatLabel(item.product.billingPeriod)
                                  : "N/A"}
                              </td>
                              <td className="px-4 py-3">
                                {formatPrice(item.product?.totalUsdCents)}
                              </td>
                              <td className="px-4 py-3">
                                {item.product?.trialPeriod ?? 0} days
                              </td>
                              <td className="px-4 py-3">
                                <p className="max-w-52 truncate">
                                  {item.stripeSubscriptionItemId}
                                </p>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">
                      No subscription items returned by the API.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {confirmAction && (
        <div className={modalBaseClass}>
          <div className="w-full max-w-md rounded-lg bg-white p-5">
            <h2 className="mb-2 text-lg font-semibold">
              {confirmAction.type === "cancel" && "Cancel Subscription"}
              {confirmAction.type === "resume" && "Resume Subscription"}
              {confirmAction.type === "upgrade" && "Update Trial Plan"}
            </h2>
            <p className="mb-4 text-sm text-slate-700">
              {confirmAction.type === "cancel" &&
                `Are you sure you want to cancel ${formatLabel(
                  confirmAction.subscription.serviceType
                )}? Choose whether it should end now or at the current billing period.`}
              {confirmAction.type === "resume" &&
                `Are you sure you want to resume ${formatLabel(
                  confirmAction.subscription.serviceType
                )}? Auto renewal will be restored.`}
              {confirmAction.type === "upgrade" &&
                `Are you sure you want to update the ${formatLabel(
                  confirmAction.subscription.serviceType
                )} trial to a paid plan?`}
            </p>

            {confirmAction.type === "cancel" && (
              <div className="mb-4 space-y-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 text-sm">
                  <input
                    type="radio"
                    name="cancel-mode"
                    checked={!confirmAction.immediate}
                    onChange={() =>
                      setConfirmAction((current) =>
                        current ? { ...current, immediate: false } : current
                      )
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-medium text-slate-900">
                      Cancel at period end
                    </span>
                    <span className="block text-slate-600">
                      Access stays active until {formatDate(confirmAction.subscription.currentPeriodEnd)}.
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 text-sm">
                  <input
                    type="radio"
                    name="cancel-mode"
                    checked={Boolean(confirmAction.immediate)}
                    onChange={() =>
                      setConfirmAction((current) =>
                        current ? { ...current, immediate: true } : current
                      )
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-medium text-slate-900">
                      Cancel immediately
                    </span>
                    <span className="block text-slate-600">
                      Subscription ends now and Stripe will prorate/invoice immediately.
                    </span>
                  </span>
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="cursor-pointer rounded-md border border-gray-300 px-4 py-2 text-sm transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={
                  isSubmittingAction ||
                  (confirmAction.type === "upgrade" && !email)
                }
                className="cursor-pointer rounded-md bg-black px-4 py-2 text-sm text-white transition-colors hover:bg-[#111] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmittingAction ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MySubscriptionPage;
