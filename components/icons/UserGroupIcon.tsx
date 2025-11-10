import React from 'react';

const UserGroupIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-7.5-2.962A3.75 3.75 0 0115 9.75v.008c0 .022.012.042.013.064l.008.008c.002.002.004.004.005.007l.002.002.001.002c.002.003.004.006.005.009l.001.002.001.002c.002.003.003.005.005.008l.001.002.001.002a3.75 3.75 0 01-3.496 2.146L6.126 16a3 3 0 10-4.242-4.242L6.126 16a3 3 0 004.242 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a.375.375 0 11-1.5 0 .375.375 0 011.5 0z" />
  </svg>
);

export default UserGroupIcon;
