import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Docling Client PoC",
  description: "An example productization/use case of the Docling-MCP server, exposed through a custom document editor client",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
