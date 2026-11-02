import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({ size = 'md' }) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
  };

  return (
    <div className="flex items-center gap-2 group cursor-pointer select-none">
      {/* Dynamic Geometric Monogram Icon */}
      <div className={`relative ${iconSizes[size]} flex items-center justify-center flex-shrink-0`}>
        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-lg blur-sm opacity-40 group-hover:opacity-75 transition-opacity" />
        
        <div className="relative w-full h-full bg-slate-950 border border-emerald-500/30 rounded-lg p-1 flex items-center justify-center shadow-sm">
          <svg
            viewBox="0 0 36 36"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full relative z-10"
          >
            <defs>
              <linearGradient id="mfGrad1" x1="4" y1="30" x2="18" y2="6" gradientUnits="userSpaceOnUse">
                <stop stopColor="#059669" />
                <stop offset="0.5" stopColor="#10b981" />
                <stop offset="1" stopColor="#34d399" />
              </linearGradient>
              <linearGradient id="mfGrad2" x1="18" y1="6" x2="32" y2="30" gradientUnits="userSpaceOnUse">
                <stop stopColor="#34d399" />
                <stop offset="0.5" stopColor="#06b6d4" />
                <stop offset="1" stopColor="#38bdf8" />
              </linearGradient>
            </defs>

            {/* Left pillar of M */}
            <path
              d="M6 28V8C6 6.89543 6.89543 6 8 6H9C10.1046 6 11 6.89543 11 8V28"
              stroke="url(#mfGrad1)"
              strokeWidth="3.2"
              strokeLinecap="round"
            />

            {/* Center chevron */}
            <path
              d="M9.5 9.5L18 19.5L26.5 9.5"
              stroke="url(#mfGrad1)"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Right pillar */}
            <path
              d="M25 28V8C25 6.89543 25.8954 6 27 6H28C29.1046 6 30 6.89543 30 8V28"
              stroke="url(#mfGrad2)"
              strokeWidth="3.2"
              strokeLinecap="round"
            />

            <circle cx="18" cy="19.5" r="2" fill="#38bdf8" />
          </svg>
        </div>
      </div>

      {/* Pure Brand Wordmark */}
      <span className={`font-black tracking-tight text-white ${textSizes[size]}`}>
        MAD<span className="text-emerald-400">FIN</span>
      </span>
    </div>
  );
};
