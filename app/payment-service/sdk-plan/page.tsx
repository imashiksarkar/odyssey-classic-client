"use client";

import useAccessToken from "@/lib/use-access-token";
import axios from "axios";
import { useEffect, useState } from "react";
import { z } from "zod";

type Product = {
  id: string;
  stripeProductId: string;
  stripePriceId: string;
  serviceType: string;
  displayName: string;
  description: string | null;
  billingPeriod: string;
  discount: number;
  trialPeriod: number;
  totalUsdCents: number;
  isSdk: boolean;
};

type UsageTrialLimitation = {
  id?: string;
  serviceType: string;
  [key: string]: string | number | boolean | null | undefined;
};

type ProductService = {
  serviceType: string;
  trialLimit: UsageTrialLimitation | null;
  products: Product[];
};

type ServicePlansApiResponse = {
  statusCode: number;
  success: boolean;
  message: string;
  data: ProductService[];
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;

    if (typeof responseData === "string" && responseData.trim()) {
      return responseData;
    }

    if (
      responseData &&
      typeof responseData === "object" &&
      "message" in responseData
    ) {
      const message = (responseData as { message?: unknown }).message;

      if (Array.isArray(message)) {
        const joinedMessage = message
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .join(", ");

        if (joinedMessage) {
          return joinedMessage;
        }
      }

      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }

    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

const formatServiceType = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatPrice = (cents: number, suffix: string) =>
  `$${(Number(cents || 0) / 100).toFixed(2)}${suffix}`;

const getVisibleProducts = (products: Product[]) =>
  products.filter((product) => Number(product.totalUsdCents || 0) > 0);

const getTrialProducts = (products: Product[]) =>
  products.filter((product) => Number(product.totalUsdCents || 0) === 0);

const formatTrialLimit = (trialLimit: UsageTrialLimitation | null) => {
  if (!trialLimit) {
    return [];
  }

  const hiddenKeys = new Set(["id", "serviceType", "createdAt", "updatedAt"]);

  return Object.entries(trialLimit)
    .filter((entry) => !hiddenKeys.has(entry[0]) && entry[1] !== null && entry[1] !== undefined)
    .map(([key, value]) => ({
      key,
      label: key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (character) => character.toUpperCase()),
      value: typeof value === "number" ? value.toLocaleString() : String(value),
    }));
};

const getMinimumTrialDays = (products: Product[]) => {
  const trialDays = products
    .map((product) => Number(product.trialPeriod || 0))
    .filter((days) => days > 0);

  if (trialDays.length === 0) {
    return 0;
  }

  return Math.min(...trialDays);
};

const ServiceType = z.enum(["AVATAR_SSO", "ASSETS_MANAGER"]);

const createSubscriptionSchema = z.object({
  serviceType: ServiceType,
});

const SdkPlanPage = () => {

  const { accessToken, isTokenLoading, tokenError } = useAccessToken();
  const [servicePlans, setServicePlans] = useState<ProductService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [buyingServiceType, setBuyingServiceType] = useState<string | null>(null);

  useEffect(() => {
    const fetchServicePlans = async () => {
      if (isTokenLoading) {
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      if (!accessToken) {
        setErrorMessage(tokenError || "Access token not found. Please login again.");
        setIsLoading(false);
        return;
      }

      try {
        const res = await axios.get<ServicePlansApiResponse>(
          `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL}/products/service`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        setServicePlans(res.data?.data || []);
      } catch (error) {
        console.error("Failed to fetch service plans", error);
        setErrorMessage(getErrorMessage(error, "Failed to load SDK plans."));
      } finally {
        setIsLoading(false);
      }
    };

    fetchServicePlans();
  }, [accessToken, isTokenLoading, tokenError]);

  const handleBuyPlan = async (serviceType: string) => {
    setErrorMessage("");

    const parsed = createSubscriptionSchema.safeParse({ serviceType });
    if (!parsed.success) {
      setErrorMessage("Invalid service type.");
      return;
    }

    try {
      setBuyingServiceType(serviceType);
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL}/subscriptions`,
        parsed.data,
        {
          headers: accessToken
            ? {
              Authorization: `Bearer ${accessToken}`,
            }
            : undefined,
        }
      );

      const checkoutUrl =
        res.data?.data ||
        res.data?.data?.url ||
        res.data?.checkoutUrl ||
        res.data?.url;

      if (!checkoutUrl || typeof checkoutUrl !== "string") {
        setErrorMessage("Checkout URL was not returned by the server.");
        return;
      }

      window.location.href = checkoutUrl;
    } catch (error) {
      console.error("Failed to create subscription", error);
      setErrorMessage(getErrorMessage(error, "Failed to start checkout."));
    } finally {
      setBuyingServiceType(null);
    }
  };

  return (
    <section className="px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">SDK Plan</h1>

      {isLoading && <p className="text-sm text-slate-600">Loading plans...</p>}
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

      {!isLoading && servicePlans.length === 0 && (
        <p className="text-sm text-slate-600">No plans found.</p>
      )}

      {!isLoading && servicePlans.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {servicePlans.map((servicePlan) => {
            const visibleProducts = getVisibleProducts(servicePlan.products);
            const trialProducts = getTrialProducts(servicePlan.products);
            const minimumTrialDays = getMinimumTrialDays(trialProducts);
            const trialLimits = formatTrialLimit(servicePlan.trialLimit);

            return (
              <article
                key={servicePlan.serviceType}
                className="border border-gray-200 rounded-lg bg-white p-4"
              >
                <div className="mb-4">
                  <h2 className="font-semibold text-base mb-1">
                    {formatServiceType(servicePlan.serviceType)}
                  </h2>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                      Trial Period: {minimumTrialDays > 0 ? `${minimumTrialDays} days` : "No trial"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                      {visibleProducts.length} products
                    </span>
                  </div>
                </div>

                {
                  minimumTrialDays > 0 && (
                    <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                      <h3 className="text-sm font-medium text-slate-800">Trial Limits</h3>
                      {trialLimits.length > 0 ? (
                        <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                          {trialLimits.map((item) => (
                            <div
                              key={item.key}
                              className="rounded-md border border-slate-200 bg-white px-3 py-2"
                            >
                              <p className="text-xs text-slate-500">{item.label}</p>
                              <p className="font-medium text-slate-900">{item.value}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">
                          No trial limitation configured.
                        </p>
                      )}
                    </div>
                  )
                }

                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-slate-700">Plan Details</h3>

                  {visibleProducts.length === 0 && (
                    <p className="text-sm text-slate-500">No plans for this service.</p>
                  )}

                  {visibleProducts.length > 0 && (
                    <ul className="space-y-2">
                      {visibleProducts.map((product) => (
                        <li
                          key={product.id}
                          className="border border-slate-200 rounded-md px-3 py-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {product.displayName}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {product.isSdk
                                  ? `Monthly fixed: ${formatPrice(product.totalUsdCents, "/month")}`
                                  : `Pay per use: ${formatPrice(product.totalUsdCents, "/unit")}`}
                              </p>
                            </div>
                           
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {visibleProducts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleBuyPlan(servicePlan.serviceType)}
                      disabled={buyingServiceType === servicePlan.serviceType}
                      className="w-full mt-3 px-3 py-2 rounded-md bg-black text-white text-sm hover:bg-[#111] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {buyingServiceType === servicePlan.serviceType
                        ? "Redirecting..."
                        : `Buy ${formatServiceType(servicePlan.serviceType)} Plan`}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default SdkPlanPage;
