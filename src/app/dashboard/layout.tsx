import { GlobalSidebar, GlobalTopbar, GlobalFooter } from '@/components/GlobalLayoutElements';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[var(--color-surface)] overflow-x-hidden">
      <GlobalSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <GlobalTopbar />
        <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 lg:py-8 animate-slide-up-fade min-w-0">
          {children}
        </main>
        <GlobalFooter />
      </div>
    </div>
  );
}
