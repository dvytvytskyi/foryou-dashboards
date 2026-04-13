import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Marketing Dashboard | ForYou',
  description: 'Marketing channel performance analysis and KPIs',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('dashboard-theme');
                  if (theme === 'night' || theme === 'light') {
                    document.documentElement.setAttribute('data-dashboard-theme', theme);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
