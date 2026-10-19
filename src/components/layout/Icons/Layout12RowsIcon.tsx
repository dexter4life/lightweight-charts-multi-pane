import type { SVGProps } from "react";

const Layout12RowsIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 21 19"
    width="21"
    height="19"
    fill="none"
    stroke="currentColor"
    {...props}
  >
    <rect x="1" y="1" width="19" height="17" rx="2" />
    <path d="M4.8 1v17" />
    <path d="M8.6 1v17" opacity="0.86" />
    <path d="M12.4 1v17" opacity="0.66" />
    <path d="M16.2 1v17" opacity="0.26" />
    <path d="M18.1 1v17" opacity="0.07" />
  </svg>
);

export default Layout12RowsIcon;
