
import React from 'react';

interface HeaderProps {
  appName: string;
  appDescription: string;
}

const Header: React.FC<HeaderProps> = ({ appName, appDescription }) => (
  <header className="text-center">
    <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-teal-400">
      {appName}
    </h1>
    <p className="mt-3 text-lg text-slate-600 dark:text-slate-300">
      {appDescription}
    </p>
  </header>
);

export default Header;