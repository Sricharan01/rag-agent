import type { Metadata } from "next";
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
