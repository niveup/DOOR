import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Toaster } from "sonner";
import { AppShellLayout } from "@/components/AppShell";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DOOR",
  description: "A focused study workspace for preparation, routine coaching, progress tracking, and interview practice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var theme = localStorage.getItem('jujum-theme');
                if (!theme) {
                  theme = 'dark';
                }
                document.documentElement.dataset.theme = theme;
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full bg-[var(--bg-page)] text-[var(--text-primary)] font-sans">
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              fontFamily: "var(--font-sans)",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              fontSize: "12px",
              fontWeight: "700",
            },
          }}
        />
        <AppShellLayout>{children}</AppShellLayout>
      </body>
    </html>
  );
}
