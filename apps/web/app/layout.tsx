import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"

export const metadata: Metadata = {
  title: "Sales Analytics",
  description: "AI-powered sales data analysis",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className={`${GeistSans.variable} ${GeistMono.variable} dark`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-zinc-950 text-zinc-50 min-h-screen">
        {children}
      </body>
    </html>
  )
}
