import './globals.css'
import ThemeProvider from '@/components/ThemeProvider'
import UserProvider from '@/components/UserProvider'

export const metadata = {
  title: 'The Family Sync',
  description: 'Family membership management — track members, family trees, birthdays, and anniversaries.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico' },
    ],
    apple: { url: '/favicon.svg' },
  },
  other: {
    'theme-color': '#6b0e1e',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script dangerouslySetInnerHTML={{
          __html: `
            (function(){
              try {
                var t = localStorage.getItem('theme') || 'dark';
                document.documentElement.setAttribute('data-theme', t);
                var vh = window.innerHeight;
                document.documentElement.style.setProperty('--app-height', vh + 'px');
                window.addEventListener('resize', function(){
                  var vh2 = window.innerHeight;
                  document.documentElement.style.setProperty('--app-height', vh2 + 'px');
                });
              } catch(e){}
            })();
          `
        }} />
      </head>
      <body><ThemeProvider><UserProvider>{children}</UserProvider></ThemeProvider></body>
    </html>
  )
}
