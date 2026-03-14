"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/payment-service/products", label: "Products" },
  { href: "/payment-service/sdk-plan", label: "SDK Plan" },
  { href: "/payment-service/my-subscription", label: "My Subscription" },
  { href: "/payment-service/sdk-keys", label: "SDK Keys" },
  { href: "/payment-service/cost-tracking", label: "Cost Tracking" },
  { href: "/payment-service/invoices", label: "Invoices" },
  { href: "/payment-service/storage-usage", label: "Storage Usage" },
];

const PaymentSidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="w-full md:w-64 border-r border-gray-200 bg-white md:min-h-screen">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-lg font-semibold">Payment Service</h1>
      </div>

      <nav className="p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-black text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

export default PaymentSidebar;
