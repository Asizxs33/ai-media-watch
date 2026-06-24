interface Props { size?: number }

export function SpectraLogo({ size = 36 }: Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width={size} height={size}>
      <circle cx="50" cy="50" r="46" fill="none" stroke="#ceff1a" strokeWidth="0.9" opacity="0.22"/>
      <circle cx="50" cy="50" r="37" fill="none" stroke="#ceff1a" strokeWidth="1.1" opacity="0.4"/>
      <circle cx="50" cy="50" r="28" fill="none" stroke="#ceff1a" strokeWidth="1.3" opacity="0.6"/>
      <circle cx="50" cy="50" r="19" fill="none" stroke="#ceff1a" strokeWidth="1.5" opacity="0.82"/>
      <path d="M14,50 Q50,27 86,50 Q50,73 14,50Z" fill="none" stroke="#ceff1a" strokeWidth="2.4" strokeLinejoin="miter"/>
      <circle cx="8"  cy="50" r="2.2" fill="#ceff1a"/>
      <circle cx="3"  cy="50" r="1.4" fill="#ceff1a" opacity="0.4"/>
      <circle cx="92" cy="50" r="2.2" fill="#ceff1a"/>
      <circle cx="97" cy="50" r="1.4" fill="#ceff1a" opacity="0.4"/>
      <polyline points="27,50 33,50 35,47 38,50 40,39 43,63 46,50 49,56 52,50 73,50"
                fill="none" stroke="#ceff1a" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
