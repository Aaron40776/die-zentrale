import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { RegisterSW } from '@/components/RegisterSW'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Die Zentrale — Übersicht & Planung',
  description:
    'Termine, Finanzen, Aufgaben und Notizen: alles an einem Ort, farbig sortiert, in 5 Sekunden erfasst.',
  applicationName: 'Die Zentrale',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Die Zentrale',
  },
  /* iOS: Beträge/Daten nicht automatisch als Link/Nummer formatieren */
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
    date: false,
  },
  icons: {
    icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0c0b09',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  /* Tastatur schiebt das Layout zusammen, statt die Sheets zu überdecken */
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de" className="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        {/* Gewählte Akzentfarbe vor dem ersten Paint anwenden (kein Farbsprunng beim Start) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var a=localStorage.getItem('zentrale-accent');if(a==='kupfer'||a==='salbei'){document.documentElement.setAttribute('data-accent',a)}}catch(e){}})()`,
          }}
        />
        {/* Tiefenlicht hinter allem Inhalt */}
        <div className="app-ambient" aria-hidden />
        {children}
        <Toaster />
        <RegisterSW />
      </body>
    </html>
  )
}
