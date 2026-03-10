import PaymentSidebar from "./_components/payment-sidebar";

export default function PaymentServiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto md:flex">
        <PaymentSidebar />
        <main className="flex-1 bg-white">{children}</main>
      </div>
    </div>
  );
}
