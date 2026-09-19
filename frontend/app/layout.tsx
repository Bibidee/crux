import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Crux — Evidence completion markets",
  description: "Find the fact that changes the answer. Crux turns unresolved decisions into open evidence bounties on GenLayer.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en"><body><SiteHeader/><main>{children}</main><SiteFooter/><Toaster position="bottom-right" richColors closeButton/></body></html>
  );
}
