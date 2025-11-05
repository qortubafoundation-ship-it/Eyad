import React from 'react';

type ButtonProps = {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  as?: 'button' | 'label';
} & (React.ButtonHTMLAttributes<HTMLButtonElement> & React.LabelHTMLAttributes<HTMLLabelElement>);


const Button: React.FC<ButtonProps> = ({ children, className, variant = 'primary', as = 'button', ...props }) => {
  const baseClasses = 'px-6 py-3 font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';
  
  const variantClasses = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white focus:ring-indigo-500',
    secondary: 'bg-gray-700 hover:bg-gray-600 text-gray-200 focus:ring-gray-500',
  };

  const Component = as;

  return (
    <Component className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </Component>
  );
};

export default Button;