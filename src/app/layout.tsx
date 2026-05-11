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
  title: 'RadioStack',
  description: 'Serious M3U radio directory',
  icons: {
    icon: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-black font-sans antialiased text-neutral-200">
        {children}
        <Toaster richColors position="bottom-right" theme="dark" />
      </body>
    </html>
  )
}
