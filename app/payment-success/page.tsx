import Link from "next/link";

const PaymentSuccessPage = () => {
  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center px-4">
      <section className="w-full max-w-xl rounded-2xl border border-emerald-200 bg-white p-8 shadow-sm">
        <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-bold mb-4">
          ✓
        </div>

        <h1 className="text-2xl font-semibold text-slate-900">Payment Successful</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your payment has been completed successfully. Your plan is now active.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/payment-service/my-subscription"
            className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700 transition-colors"
          >
            Go to My Subscription
          </Link>
          <Link
            href="/payment-service/sdk-plan"
            className="px-4 py-2 rounded-md border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Back to Products
          </Link>
        </div>
      </section>
    </main>
  );
};

export default PaymentSuccessPage;
