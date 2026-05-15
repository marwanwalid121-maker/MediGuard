import { Outfit } from 'next/font/google';
import './globals.css';

import { SidebarProvider } from '@/context/SidebarContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { UserProvider } from '@/context/UserContext';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | MediGuard - Healthcare Dashboard',
    default: 'MediGuard - Healthcare Dashboard',
  },
  description: 'Secure Medical Records Management System',
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '256x256', type: 'image/png' },
    ],
  },
};

const outfit = Outfit({
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.className} dark:bg-gray-900`}>
        <ThemeProvider>
          <UserProvider>
            <SidebarProvider>{children}</SidebarProvider>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
