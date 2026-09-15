import type { Metadata } from 'next';
import { Header } from '../components/Header';
import { AuthProvider } from '../components/AuthProvider';
import { CartProvider } from '../components/CartProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'SmolStudio - Curated comfort for little ones',
  description: 'Handpicked babywear made for tiny everyday moments.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <CartProvider>
            <Header />
            {children}
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
