import { DashboardNavbar } from "@/components/layout/DashboardNavbar";

export default function AlertsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardNavbar />
      <main>{children}</main>
    </>
  );
}
