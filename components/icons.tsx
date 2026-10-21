import type { PoiCategory } from '@/types/transit';

/**
 * One coherent icon set: 24×24 viewBox, 1.75 stroke, round caps, currentColor.
 *
 * Inline SVG rather than emoji — emoji render differently on every platform and
 * read as clip-art, and these carry meaning (you scan for the hospital cross)
 * rather than decorating a heading.
 */
type IconProps = { size?: number; className?: string };

function Svg({ size = 18, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const TrainIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="3" width="14" height="13" rx="3.5" />
    <path d="M5 10.5h14" />
    <circle cx="9" cy="13.2" r=".9" />
    <circle cx="15" cy="13.2" r=".9" />
    <path d="M8.5 21l-2-3M15.5 21l2-3" />
  </Svg>
);

export const BusIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4" width="17" height="12.5" rx="2.5" />
    <path d="M3.5 10.5h17" />
    <circle cx="7.8" cy="19" r="1.4" />
    <circle cx="16.2" cy="19" r="1.4" />
    <path d="M6.5 16.5v1.2M17.5 16.5v1.2" />
  </Svg>
);

export const ParkingIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <path d="M9.8 16.5V7.5h3.4a2.9 2.9 0 0 1 0 5.8H9.8" />
  </Svg>
);

export const TicketIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 9.2V7.4a1.4 1.4 0 0 1 1.4-1.4h14.2a1.4 1.4 0 0 1 1.4 1.4v1.8a2.8 2.8 0 0 0 0 5.6v1.8a1.4 1.4 0 0 1-1.4 1.4H4.9a1.4 1.4 0 0 1-1.4-1.4v-1.8a2.8 2.8 0 0 0 0-5.6z" />
    <path d="M14.5 6.6v1.8M14.5 11.1v1.8M14.5 15.6v1.8" />
  </Svg>
);

export const InterchangeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7.5 4.5L4 8l3.5 3.5" />
    <path d="M4 8h10a4 4 0 0 1 4 4v.5" />
    <path d="M16.5 19.5L20 16l-3.5-3.5" />
    <path d="M20 16H10a4 4 0 0 1-4-4v-.5" />
  </Svg>
);

export const PinIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </Svg>
);

/* --- Nearby-place kinds ------------------------------------------------- */

export const HospitalIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="7.5" width="16" height="12.5" rx="2" />
    <path d="M9 7.5V4.5h6v3" />
    <path d="M12 11.5v5M9.5 14h5" />
  </Svg>
);

export const PharmacyIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.2" />
    <path d="M12 8.2v7.6M8.2 12h7.6" />
  </Svg>
);

export const ClinicIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 4v4.5a4 4 0 0 0 8 0V4" />
    <path d="M10 12.5v1.8a4 4 0 0 0 8 0v-1.3" />
    <circle cx="18" cy="11" r="2" />
  </Svg>
);

export const MallIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 8h14l-1.2 12H6.2L5 8z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </Svg>
);

export const SupermarketIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9.5" cy="19" r="1.4" />
    <circle cx="17" cy="19" r="1.4" />
    <path d="M3 4.5h2.2l2.6 11h10L20 8H6.2" />
  </Svg>
);

export const MarketIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 9.5h14L17.6 20H6.4L5 9.5z" />
    <path d="M9.5 9.5L11.2 4M14.5 9.5L12.8 4" />
  </Svg>
);

export const AtmIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2.2" />
    <path d="M3 10.2h18" />
    <path d="M6.8 14.2h3.4" />
  </Svg>
);

export const BankIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 9.2L12 4.2l8.5 5" />
    <path d="M6 9.8v8.4M10 9.8v8.4M14 9.8v8.4M18 9.8v8.4" />
    <path d="M3.5 19.8h17" />
  </Svg>
);

export const PoliceIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.2l7 2.8v5.6c0 4.3-2.9 7.7-7 8.8-4.1-1.1-7-4.5-7-8.8V6l7-2.8z" />
  </Svg>
);

export const FuelIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="9.5" height="16" rx="2" />
    <path d="M4 10h9.5" />
    <path d="M13.5 8.5h2.8l2.2 2.2v6a1.5 1.5 0 0 1-3 0v-3.8h-2" />
  </Svg>
);

export const RestaurantIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3v7a2.5 2.5 0 0 0 5 0V3" />
    <path d="M8.5 10v11" />
    <path d="M17 3c-1.6 1.4-2.4 3.3-2.4 5.4 0 1.7.9 2.8 2.4 3.1V21" />
  </Svg>
);

export const GroceryIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 8.5h15l-1.2 11.5H5.7L4.5 8.5z" />
    <path d="M8.5 8.5a3.5 3.5 0 0 1 7 0" />
    <path d="M9.5 12v4M14.5 12v4" />
  </Svg>
);

export const TempleIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2.5l4.5 4.5h-9L12 2.5z" />
    <path d="M6.5 7h11v3h-11z" />
    <path d="M7.5 10v10M16.5 10v10" />
    <path d="M10.5 20v-5a1.5 1.5 0 0 1 3 0v5" />
    <path d="M4.5 20.5h15" />
  </Svg>
);

export const ChurchIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2v5M10 4h4" />
    <path d="M12 7l5 4v9.5H7V11l5-4z" />
    <path d="M10.5 20.5v-4a1.5 1.5 0 0 1 3 0v4" />
  </Svg>
);

export const MasjidIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5c2 1.7 3.2 3.4 3.2 5.2 0 1-.5 1.9-1.2 2.3h-4c-.7-.4-1.2-1.3-1.2-2.3 0-1.8 1.2-3.5 3.2-5.2z" />
    <path d="M6 11h12v9.5H6z" />
    <path d="M10.5 20.5v-4a1.5 1.5 0 0 1 3 0v4" />
    <path d="M4.5 13v7.5M19.5 13v7.5" />
  </Svg>
);

export const WorshipIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l5 4.5V20.5H7V7.5L12 3z" />
    <path d="M10.5 20.5v-4.5a1.5 1.5 0 0 1 3 0v4.5" />
    <path d="M4.5 20.5h15" />
  </Svg>
);

export const ToiletsIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="4.8" r="1.6" />
    <path d="M8 8v5.5M6.2 20l1-6.5M9.8 20l-1-6.5" />
    <circle cx="16" cy="4.8" r="1.6" />
    <path d="M16 8l-2.2 6.2h4.4L16 8zM15 20v-5.8M17 20v-5.8" />
  </Svg>
);

/** Maps a POI's label to its glyph. Unknown kinds fall back to a pin. */
export function IconForKind({ kind, size = 16 }: { kind: string; size?: number }) {
  const map: Record<string, (p: IconProps) => React.JSX.Element> = {
    Hospital: HospitalIcon,
    Clinic: ClinicIcon,
    Doctor: ClinicIcon,
    Pharmacy: PharmacyIcon,
    Mall: MallIcon,
    Supermarket: SupermarketIcon,
    Market: MarketIcon,
    ATM: AtmIcon,
    Bank: BankIcon,
    Restaurant: RestaurantIcon,
    Cafe: RestaurantIcon,
    'Fast food': RestaurantIcon,
    Grocery: GroceryIcon,
    Greengrocer: GroceryIcon,
    Temple: TempleIcon,
    Church: ChurchIcon,
    Masjid: MasjidIcon,
    'Jain temple': TempleIcon,
    Gurudwara: WorshipIcon,
    'Buddhist temple': WorshipIcon,
    'Bus station': BusIcon,
    Police: PoliceIcon,
    Toilets: ToiletsIcon,
    Fuel: FuelIcon,
  };
  const Cmp = map[kind] ?? PinIcon;
  return <Cmp size={size} />;
}

/** One representative glyph per category, for the filter tabs. */
export function IconForCategory({ category, size = 15 }: { category: PoiCategory; size?: number }) {
  const map: Record<PoiCategory, (p: IconProps) => React.JSX.Element> = {
    health: HospitalIcon,
    food: RestaurantIcon,
    shopping: MallIcon,
    worship: WorshipIcon,
    money: AtmIcon,
    transport: BusIcon,
    essentials: PoliceIcon,
  };
  const Cmp = map[category];
  return <Cmp size={size} />;
}

/** WhatsApp glyph for the BMRCL QR ticket link. */
export function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="shrink-0"
      style={{ color: 'var(--good)' }}
    >
      <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.48 1.34 5L2 22l5.17-1.36a9.93 9.93 0 0 0 4.87 1.25h.01c5.5 0 9.96-4.46 9.96-9.96 0-2.66-1.04-5.16-2.92-7.04A9.9 9.9 0 0 0 12.04 2Zm0 18.2a8.26 8.26 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.24 8.24 0 0 1-1.26-4.38c0-4.57 3.72-8.28 8.29-8.28 2.21 0 4.29.86 5.85 2.43a8.22 8.22 0 0 1 2.42 5.86c0 4.57-3.71 8.23-8.31 8.23Zm4.54-6.16c-.25-.13-1.47-.73-1.7-.81-.23-.08-.39-.13-.56.12-.17.25-.64.81-.79.98-.14.16-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.84-.2-.48-.4-.42-.56-.43h-.47c-.17 0-.44.06-.67.31-.23.25-.87.86-.87 2.09s.9 2.43 1.02 2.6c.13.16 1.76 2.69 4.26 3.77.6.26 1.06.41 1.42.53.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  );
}
