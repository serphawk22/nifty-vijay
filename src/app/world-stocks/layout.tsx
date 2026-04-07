import { DashboardNavbar } from "@/components/layout/DashboardNavbar";

export default function WorldStocksLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardNavbar />
      <main>{children}</main>
    </>
  );
}
