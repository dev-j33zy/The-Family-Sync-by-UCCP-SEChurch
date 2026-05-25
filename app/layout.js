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
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="icon" href="/favicon.ico" />
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
      <body><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  )
}
