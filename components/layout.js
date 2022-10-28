// app/layout.tsx
import { Montserrat } from '@next/font/google'

// If loading a variable font, you don't need to specify the font weight
const montserrat = Montserrat({ subsets: ['latin'] })

export default function RootLayout({
  children,
}) {
  return (
    <html lang="en" className={montserrat.className}>
      <body>{children}</body>
    </html>
  )}