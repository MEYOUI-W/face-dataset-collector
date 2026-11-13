import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Face Dataset Registration',
  description: 'Self-service face recognition dataset collection studio',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-white text-gray-900">
        {children}
      </body>
    </html>
  );
}
