import type { Metadata } from 'next'
import { IBM_Plex_Mono, Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Radyo Stack',
  description: 'M3U radio directory',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-[#0a0a0a] font-sans antialiased">
        {children}
        <Toaster richColors position="top-center" theme="dark" />
      </body>
    </html>
  )
}
