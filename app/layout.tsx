import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SWAN Enterprise",
  description: "Integrated Maritime Enterprise Management Platform",
};

// Applies the persisted theme before first paint to avoid a flash.
const themeScript = `(function(){try{var t=localStorage.getItem('swan-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
