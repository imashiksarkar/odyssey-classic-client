"use client";

import axios from "axios";
import { MoreVertical, Plus } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";

const ServiceType = z.enum(["AVATAR_SSO", "ASSETS_MANAGER"]);
const BillingPeriod = z.enum(["MONTHLY", "YEARLY"]);

const productSchema = z.object({
  stripeProductId: z.string().min(1, "Stripe ProductId is Required"),
  stripePriceId: z.string().min(1, "Stripe PriceId is Required"),
  serviceType: ServiceType,
  billingPeriod: BillingPeriod,
  displayName: z.string().min(1, "Display Name is Required"),
  isSdk: z.boolean(),
  description: z.string().optional(),
  discount: z.number().optional(),
  trialPeriod: z.number().optional(),
});

type ProductPayload = z.infer<typeof productSchema>;

type Product = {
  id: string;
  stripeProductId: string;
  stripePriceId: string;
  serviceType: z.infer<typeof ServiceType>;
  displayName: string;
  description: string | null;
  isSdk: boolean;
  billingPeriod: z.infer<typeof BillingPeriod>;
  discount: number;
  trialPeriod: number;
  totalUsdCents: number;
};

type FormState = {
  stripeProductId: string;
  stripePriceId: string;
  serviceType: string;
  billingPeriod: string;
  displayName: string;
  isSdk: boolean;
  description: string;
  discount: string;
  trialPeriod: string;
};

const initialFormState: FormState = {
  stripeProductId: "",
  stripePriceId: "",
  serviceType: "",
  billingPeriod: "MONTHLY",
  displayName: "",
  isSdk: false,
  description: "",
  discount: "",
  trialPeriod: "",
};

const modalBaseClass =
  "fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4";

const SdkProduct = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [actionMenu, setActionMenu] = useState<{
    product: Product;
    left: number;
    top: number;
    openUp: boolean;
  } | null>(null);

  const [form, setForm] = useState<FormState>(initialFormState);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [detailsProduct, setDetailsProduct] = useState<Product | null>(null);

  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_PAYMENT_SERVICE_BASE_URL;

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const res = await axios.get(`${apiBase}/products`);
      setProducts(res.data?.data?.data || []);
    } catch (error) {
      console.error("Error fetching products", error);
      setErrorMessage("Failed to load products.");
    } finally {
      setIsLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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

  const modalTitle = useMemo(() => {
    if (formMode === "add") {
      return "Add Product";
    }
    if (formMode === "edit") {
      return "Edit Product";
    }
    return "";
  }, [formMode]);

  const resetFeedback = () => {
    setErrorMessage("");
    setSuccessMessage("");
  };

  const mapProductToForm = (product: Product): FormState => ({
    stripeProductId: product.stripeProductId,
    stripePriceId: product.stripePriceId,
    serviceType: product.serviceType,
    billingPeriod: product.billingPeriod,
    displayName: product.displayName,
    isSdk: product.isSdk,
    description: product.description || "",
    discount: product.discount?.toString() ?? "",
    trialPeriod: product.trialPeriod?.toString() ?? "",
  });

  const buildPayload = (): ProductPayload => ({
    stripeProductId: form.stripeProductId.trim(),
    stripePriceId: form.stripePriceId.trim(),
    serviceType: form.serviceType as z.infer<typeof ServiceType>,
    billingPeriod: form.billingPeriod as z.infer<typeof BillingPeriod>,
    displayName: form.displayName.trim(),
    isSdk: form.isSdk,
    description: form.description.trim() || undefined,
    discount: form.discount.trim() ? Number(form.discount) : undefined,
    trialPeriod: form.trialPeriod.trim() ? Number(form.trialPeriod) : undefined,
  });

  const openAddModal = () => {
    resetFeedback();
    setSelectedProduct(null);
    setForm(initialFormState);
    setFormErrors({});
    setFormMode("add");
  };

  const openEditModal = (product: Product) => {
    resetFeedback();
    setSelectedProduct(product);
    setForm(mapProductToForm(product));
    setFormErrors({});
    setFormMode("edit");
  };

  const closeFormModal = () => {
    setFormMode(null);
    setFormErrors({});
    setSelectedProduct(null);
    setForm(initialFormState);
  };

  const handleTextChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = e.target;
    setForm((prev) => ({ ...prev, isSdk: checked }));
  };

  const handleSubmitForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    resetFeedback();

    const parsed = productSchema.safeParse(buildPayload());
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Record<string, string> = {};
      Object.entries(flat).forEach(([key, value]) => {
        if (value?.[0]) {
          next[key] = value[0];
        }
      });
      setFormErrors(next);
      return;
    }

    try {
      setIsSubmitting(true);
      if (formMode === "edit" && selectedProduct) {
        await axios.put(`${apiBase}/products/${selectedProduct.id}`, parsed.data);
        setSuccessMessage("Product updated successfully.");
      } else {
        await axios.post(`${apiBase}/products`, parsed.data);
        setSuccessMessage("Product created successfully.");
      }

      closeFormModal();
      await fetchProducts();
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setErrorMessage(error.response?.data?.message || "Request failed.");
      } else {
        setErrorMessage("Request failed.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteModal = (product: Product) => {
    resetFeedback();
    setDeleteProduct(product);
  };

  const handleDelete = async () => {
    if (!deleteProduct) {
      return;
    }
    try {
      setIsDeleting(true);
      await axios.delete(`${apiBase}/products/${deleteProduct.id}`);
      setSuccessMessage("Product deleted successfully.");
      setDeleteProduct(null);
      await fetchProducts();
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setErrorMessage(error.response?.data?.message || "Delete failed.");
      } else {
        setErrorMessage("Delete failed.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <section className="px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">Products</h1>
          <button
            type="button"
            onClick={openAddModal}
            className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-md bg-black text-white text-sm hover:bg-[#111]"
          >
            <Plus size={16} />
            Add Product
          </button>
        </div>

        {errorMessage && <p className="text-sm text-red-600 mb-3">{errorMessage}</p>}
        {successMessage && (
          <p className="text-sm text-green-600 mb-3">{successMessage}</p>
        )}

        <div className="border border-gray-200 rounded-lg bg-white overflow-visible">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-gray-200">
              <tr>
                <th className="text-left font-medium px-4 py-3">Product</th>
                <th className="text-left font-medium px-4 py-3">Service</th>
                <th className="text-left font-medium px-4 py-3">Billing</th>
                <th className="text-left font-medium px-4 py-3">Price</th>
                <th className="text-left font-medium px-4 py-3">Discount</th>
                <th className="text-left font-medium px-4 py-3">Trial</th>
                <th className="text-left font-medium px-4 py-3">SDK</th>
                <th className="text-right font-medium px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="px-4 py-6 text-slate-600" colSpan={8}>
                    Loading products...
                  </td>
                </tr>
              )}

              {!isLoading && products.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-600" colSpan={8}>
                    No products found.
                  </td>
                </tr>
              )}

              {!isLoading &&
                products.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b last:border-b-0 border-gray-100"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{product.displayName}</p>
                      <p className="text-xs text-slate-500">{product.stripeProductId}</p>
                    </td>
                    <td className="px-4 py-3">{product.serviceType}</td>
                    <td className="px-4 py-3">{product.billingPeriod}</td>
                    <td className="px-4 py-3">
                      ${(Number(product.totalUsdCents || 0) / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">{Number(product.discount || 0)}</td>
                    <td className="px-4 py-3">{Number(product.trialPeriod || 0)} days</td>
                    <td className="px-4 py-3">{product.isSdk ? "Yes" : "No"}</td>
                    <td className="px-4 py-3 text-right relative">
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
                              prev?.product.id === product.id
                                ? null
                                : { product, left, top, openUp }
                            );
                          }}
                          className="p-2 rounded-md hover:bg-slate-100 cursor-pointer transition-colors"
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
              setDetailsProduct(actionMenu.product);
              setActionMenu(null);
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer transition-colors"
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => {
              openEditModal(actionMenu.product);
              setActionMenu(null);
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer transition-colors"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              openDeleteModal(actionMenu.product);
              setActionMenu(null);
            }}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
          >
            Delete
          </button>
        </div>
      )}

      {formMode && (
        <div className={modalBaseClass}>
          <div className="w-full max-w-2xl rounded-lg bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{modalTitle}</h2>
              <button
                type="button"
                onClick={closeFormModal}
                className="text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2 py-1 rounded-md cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmitForm}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 text-sm text-slate-900 font-medium block">
                    Stripe Product ID
                  </label>
                  <input
                    type="text"
                    name="stripeProductId"
                    value={form.stripeProductId}
                    onChange={handleTextChange}
                    className="px-3 py-2 bg-[#f0f1f2] w-full text-sm border border-gray-200 rounded-md"
                  />
                  {formErrors.stripeProductId && (
                    <p className="text-xs text-red-600 mt-1">
                      {formErrors.stripeProductId}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 text-sm text-slate-900 font-medium block">
                    Stripe Price ID
                  </label>
                  <input
                    type="text"
                    name="stripePriceId"
                    value={form.stripePriceId}
                    onChange={handleTextChange}
                    className="px-3 py-2 bg-[#f0f1f2] w-full text-sm border border-gray-200 rounded-md"
                  />
                  {formErrors.stripePriceId && (
                    <p className="text-xs text-red-600 mt-1">
                      {formErrors.stripePriceId}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 text-sm text-slate-900 font-medium block">
                    Display Name
                  </label>
                  <input
                    type="text"
                    name="displayName"
                    value={form.displayName}
                    onChange={handleTextChange}
                    className="px-3 py-2 bg-[#f0f1f2] w-full text-sm border border-gray-200 rounded-md"
                  />
                  {formErrors.displayName && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.displayName}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 text-sm text-slate-900 font-medium block">
                    Service Type
                  </label>
                  <select
                    name="serviceType"
                    value={form.serviceType}
                    onChange={handleTextChange}
                    className="px-3 py-2 bg-[#f0f1f2] w-full text-sm border border-gray-200 rounded-md"
                  >
                    <option value="">Select Service Type</option>
                    <option value="AVATAR_SSO">Avatar SSO</option>
                    <option value="ASSETS_MANAGER">Assets Manager</option>
                  </select>
                  {formErrors.serviceType && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.serviceType}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 text-sm text-slate-900 font-medium block">
                    Billing Period
                  </label>
                  <select
                    name="billingPeriod"
                    value={form.billingPeriod}
                    onChange={handleTextChange}
                    className="px-3 py-2 bg-[#f0f1f2] w-full text-sm border border-gray-200 rounded-md"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                  {formErrors.billingPeriod && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.billingPeriod}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 text-sm text-slate-900 font-medium block">
                    Discount
                  </label>
                  <input
                    type="number"
                    step="any"
                    name="discount"
                    value={form.discount}
                    onChange={handleTextChange}
                    className="px-3 py-2 bg-[#f0f1f2] w-full text-sm border border-gray-200 rounded-md"
                  />
                  {formErrors.discount && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.discount}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 text-sm text-slate-900 font-medium block">
                    Trial Period (days)
                  </label>
                  <input
                    type="number"
                    step="any"
                    name="trialPeriod"
                    value={form.trialPeriod}
                    onChange={handleTextChange}
                    className="px-3 py-2 bg-[#f0f1f2] w-full text-sm border border-gray-200 rounded-md"
                  />
                  {formErrors.trialPeriod && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.trialPeriod}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 text-sm text-slate-900 font-medium block">
                  Description
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleTextChange}
                  className="px-3 py-2 bg-[#f0f1f2] w-full text-sm border border-gray-200 rounded-md min-h-20"
                />
                {formErrors.description && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.description}</p>
                )}
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={form.isSdk}
                  onChange={handleCheckboxChange}
                  className="w-4 h-4"
                />
                <label className="text-sm text-slate-900 ml-3">Is SDK</label>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm rounded-md bg-black text-white disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailsProduct && (
        <div className={modalBaseClass}>
          <div className="w-full max-w-xl rounded-lg bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Product Details</h2>
              <button
                type="button"
                onClick={() => setDetailsProduct(null)}
                className="text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2 py-1 rounded-md cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <p><span className="font-medium">Display Name:</span> {detailsProduct.displayName}</p>
              <p><span className="font-medium">Service Type:</span> {detailsProduct.serviceType}</p>
              <p><span className="font-medium">Billing Period:</span> {detailsProduct.billingPeriod}</p>
              <p><span className="font-medium">Price:</span> ${(Number(detailsProduct.totalUsdCents || 0) / 100).toFixed(2)}</p>
              <p><span className="font-medium">Discount:</span> {detailsProduct.discount}%</p>
              <p><span className="font-medium">Trial:</span> {detailsProduct.trialPeriod} days</p>
              <p><span className="font-medium">SDK:</span> {detailsProduct.isSdk ? "Yes" : "No"}</p>
              <p><span className="font-medium">Stripe Product:</span> {detailsProduct.stripeProductId}</p>
              <p><span className="font-medium">Stripe Price:</span> {detailsProduct.stripePriceId}</p>
            </div>

            <p className="text-sm mt-3">
              <span className="font-medium">Description:</span>{" "}
              {detailsProduct.description || "No description provided."}
            </p>
          </div>
        </div>
      )}

      {deleteProduct && (
        <div className={modalBaseClass}>
          <div className="w-full max-w-md rounded-lg bg-white p-5">
            <h2 className="text-lg font-semibold mb-2">Delete Product</h2>
            <p className="text-sm text-slate-700 mb-4">
              Are you sure you want to delete{" "}
              <span className="font-medium">{deleteProduct.displayName}</span>?
              This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteProduct(null)}
                className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SdkProduct;
