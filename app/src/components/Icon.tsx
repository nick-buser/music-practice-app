interface IconProps {
  name: string;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 16, color = 'currentColor' }: IconProps) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'book':
      return (<svg {...p}><path d="M4 4h8a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M20 4h-8a4 4 0 0 0-4 4v12h8a4 4 0 0 0 4-4z"/></svg>);
    case 'metronome':
      return (<svg {...p}><path d="M8 21h8M7 21L11 3h2l4 18M9 14h6"/><path d="M12 14l4-9"/></svg>);
    case 'chart':
      return (<svg {...p}><path d="M3 21h18"/><rect x="6" y="13" width="3" height="6"/><rect x="11" y="9" width="3" height="10"/><rect x="16" y="5" width="3" height="14"/></svg>);
    case 'pen':
      return (<svg {...p}><path d="M3 21l3.5-1L18 8.5 15.5 6 4 17.5z"/><path d="M14 7l3 3"/></svg>);
    case 'play':
      return (<svg {...p}><path d="M8 5v14l11-7z" fill={color} stroke="none"/></svg>);
    case 'arrow-right':
      return (<svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>);
    case 'plus':
      return (<svg {...p}><path d="M12 5v14M5 12h14"/></svg>);
    case 'search':
      return (<svg {...p}><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></svg>);
    case 'staff':
      return (<svg {...p}><path d="M3 6h18M3 10h18M3 14h18M3 18h18"/></svg>);
    case 'scales':
      // A stepwise rising glyph — eight notes ascending across the box.
      return (
        <svg {...p}>
          <path d="M3 20h18" />
          <path d="M5 18l2-2 2-1 2-2 2-1 2-2 2-1 2-2 2-1" />
          <circle cx="5" cy="18" r="0.8" fill={color} stroke="none" />
          <circle cx="19" cy="6" r="0.8" fill={color} stroke="none" />
        </svg>
      );
    case 'more':
      return (<svg {...p}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>);
    default:
      return null;
  }
}
