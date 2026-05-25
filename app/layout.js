import './globals.css'
import ThemeProvider from '@/components/ThemeProvider'

export const metadata = {
  title: 'The Family Sync',
  description: 'Family membership management — track members, family trees, birthdays, and anniversaries.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <script dangerouslySetInnerHTML={{
          __html: `
            (function(){
              try {
                var t = localStorage.getItem('theme') || 'dark';
                document.documentElement.setAttribute('data-theme', t);
              } catch(e){}
            })();
          `
        }} />
      </head>
      <body><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  )
}
