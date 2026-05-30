// French historical events for timeline overlay.

export interface HistoricalEvent {
  year: number;
  label: string;
  icon: string;
}

export const HISTORICAL_EVENTS: HistoricalEvent[] = [
  { year: 1789, label: "Révolution française", icon: "⚔" },
  { year: 1804, label: "Napoléon empereur", icon: "👑" },
  { year: 1815, label: "Waterloo", icon: "⚔" },
  { year: 1848, label: "IIᵉ République", icon: "⚖" },
  { year: 1870, label: "Guerre franco-prussienne", icon: "⚔" },
  { year: 1871, label: "Commune de Paris", icon: "⚔" },
  { year: 1889, label: "Tour Eiffel", icon: "🗼" },
  { year: 1914, label: "Première Guerre mondiale", icon: "⚔" },
  { year: 1918, label: "Armistice", icon: "🕊" },
  { year: 1929, label: "Krach de Wall Street", icon: "📉" },
  { year: 1939, label: "Seconde Guerre mondiale", icon: "⚔" },
  { year: 1944, label: "Libération de la France", icon: "🕊" },
  { year: 1945, label: "Fin de la guerre", icon: "🕊" },
  { year: 1958, label: "Vᵉ République", icon: "⚖" },
  { year: 1968, label: "Mai 68", icon: "✊" },
  { year: 1989, label: "Chute du mur de Berlin", icon: "🧱" },
  { year: 2002, label: "Euro", icon: "€" },
];

export const HistoricalEvents = { events: HISTORICAL_EVENTS };
