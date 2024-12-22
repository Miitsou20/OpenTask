'use client'
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useAccount } from 'wagmi';

const Header = () => {
  const pathname = usePathname();
  const { isConnected } = useAccount();

  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'My Dashboard', path: '/dashboard' },
    { name: 'Docs', path: '/docs' },
    { name: 'Governance', path: '/governance' },
  ];

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-6">
            <Link href="/" className="flex items-center">
              <Image
                src="/opentask-logo.png"
                alt="Logo"
                width={100}
                height={100}
                className="mr-4"
              />
            </Link>
            <nav className="flex items-center space-x-6">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    pathname === item.path
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
          <ConnectButton showBalance={false} />
        </div>
      </div>
    </header>
  );
};

export default Header;