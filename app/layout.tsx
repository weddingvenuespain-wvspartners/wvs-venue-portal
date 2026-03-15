import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'WVS Partners Portal',
  description: 'Portal de gestión para venues de Wedding Venues Spain',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
