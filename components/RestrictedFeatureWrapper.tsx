
import React, { useState } from 'react';
import LockIcon from './icons/LockIcon';

interface RestrictedFeatureWrapperProps {
  isAllowed: boolean;
  children: React.ReactNode;
  message?: string;
  className?: string;
}

const RestrictedFeatureWrapper: React.FC<RestrictedFeatureWrapperProps> = ({ 
  isAllowed, 
  children, 
  message = "This feature requires a Professional account.", 
  className = "" 
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (isAllowed) {
    return <>{children}</>;
  }

  // Clone the child to force disabled state if it's a button
  // We cast to ReactElement<any> to avoid typescript errors when accessing/modifying props
  const child = React.Children.only(children) as React.ReactElement<any>;
  const disabledChild = React.cloneElement(child, {
    disabled: true,
    className: `${child.props.className || ''} opacity-60 cursor-not-allowed`,
    onClick: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <div 
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="relative">
         {disabledChild}
         <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400">
             <LockIcon className="h-5 w-5 drop-shadow-md" />
         </div>
      </div>
      
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg z-50 text-center">
          {message}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></div>
        </div>
      )}
    </div>
  );
};

export default RestrictedFeatureWrapper;
