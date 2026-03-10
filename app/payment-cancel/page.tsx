import Link from "next/link";

const PaymentCancelPage = () => {
  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center px-4">
      <section className="w-full max-w-xl rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
        <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-2xl font-bold mb-4">
          !
        </div>

        <h1 className="text-2xl font-semibold text-slate-900">Payment Canceled</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your checkout was canceled. No charge was made. You can try again anytime.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/payment-service/sdk-plan"
            className="px-4 py-2 rounded-md bg-rose-600 text-white text-sm hover:bg-rose-700 transition-colors"
          >
            Try Payment Again
          </Link>
          
        </div>
      </section>
    </main>
  );
};

export default PaymentCancelPage;
