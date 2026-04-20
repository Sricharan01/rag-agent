import type { Metadata } from "next";
import type { Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAG Knowledge Agent",
  description:
    "Intelligent document Q&A powered by Claude AI and Supabase pgvector hybrid search. Upload PDFs, DOCX, TXT, MD, and CSV files for instant AI-powered answers with source citations.",
  keywords: ["RAG", "AI", "knowledge base", "document search", "Claude", "Supabase"],
  openGraph: {
    title: "RAG Knowledge Agent",
    description: "AI-powered document Q&A with hybrid vector search",
    type: "website",
  },
};

// viewport-fit=cover enables env(safe-area-inset-*) on iOS notch/home-bar devices
// interactive-widget=resizes-content makes the layout shrink when keyboard opens
// (instead of the page scrolling behind the keyboard, which hides the input)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
