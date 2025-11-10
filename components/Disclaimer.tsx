
import React from 'react';

interface DisclaimerProps {
  t: {
    disclaimer_title: string;
    disclaimer_text: string;
  };
}

const Disclaimer: React.FC<DisclaimerProps> = ({ t }) => (
  <div className="mt-6 p-4 bg-amber-100 dark:bg-amber-900/50 border-l-4 border-amber-500 text-amber-800 dark:text-amber-200 rounded-r-lg">
    <p className="font-bold">{t.disclaimer_title}</p>
    <p className="text-sm">
      {t.disclaimer_text}
    </p>
  </div>
);

export default Disclaimer;