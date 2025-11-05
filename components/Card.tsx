import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`relative rounded-2xl bg-[#1F2937] p-px shadow-xl shadow-black/10 ${className}`}>
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/30 via-purple-500/30 to-blue-500/30 blur-lg"></div>
        <div className="relative rounded-[15px] bg-[#1F2937] p-6 md:p-8 h-full">
            {children}
        </div>
    </div>
  );
};

export default Card;