import Link from 'next/link';
import type { ReactNode } from 'react';

type NavbarProps = {};

export const Navbar = () => {
  return (
    <div className="flex justify-center items-center py-4 border-b-gray-400 border gap-4">
      <Link href="/">首页</Link>
      <Link href="/settings">设置</Link>
    </div>
  );
};
