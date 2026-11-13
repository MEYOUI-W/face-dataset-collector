import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Face Dataset Registration',
  description: 'Self-service face recognition dataset collection studio with face-api.js',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script src="https://cdn.tailwindcss.com"></script>
        {/* face-api.js library */}
        <script src="https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js"></script>
      </head>
      <body className="antialiased min-h-screen bg-white text-slate-800" style={{ fontFamily: "'Sarabun', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
