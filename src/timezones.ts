export interface Timezone {
  id: string;
  /** Menu name without the offset prefix. */
  name: string;
  iana: string;
}

const z = (name: string, iana: string): Timezone => ({ id: iana + ":" + name, name, iana });

export const UTC_ZONE: Timezone = { id: "UTC", name: "UTC", iana: "UTC" };
export const EXCHANGE_ZONE: Timezone = { id: "Exchange", name: "Exchange", iana: "UTC" };

export const TIMEZONES: Timezone[] = [
  z("Honolulu", "Pacific/Honolulu"), z("Juneau", "America/Juneau"), z("Los Angeles", "America/Los_Angeles"),
  z("Phoenix", "America/Phoenix"), z("Vancouver", "America/Vancouver"), z("Denver", "America/Denver"),
  z("San Salvador", "America/El_Salvador"), z("Bogota", "America/Bogota"), z("Chicago", "America/Chicago"),
  z("Lima", "America/Lima"), z("Mexico City", "America/Mexico_City"), z("Caracas", "America/Caracas"),
  z("New York", "America/New_York"), z("Toronto", "America/Toronto"), z("Buenos Aires", "America/Argentina/Buenos_Aires"),
  z("Santiago", "America/Santiago"), z("Sao Paulo", "America/Sao_Paulo"), z("Reykjavik", "Atlantic/Reykjavik"),
  z("Dublin", "Europe/Dublin"), z("Lagos", "Africa/Lagos"), z("Lisbon", "Europe/Lisbon"), z("London", "Europe/London"),
  z("Tunis", "Africa/Tunis"), z("Amsterdam", "Europe/Amsterdam"), z("Belgrade", "Europe/Belgrade"),
  z("Berlin", "Europe/Berlin"), z("Bratislava", "Europe/Bratislava"), z("Brussels", "Europe/Brussels"),
  z("Budapest", "Europe/Budapest"), z("Cairo", "Africa/Cairo"), z("Copenhagen", "Europe/Copenhagen"),
  z("Johannesburg", "Africa/Johannesburg"), z("Luxembourg", "Europe/Luxembourg"), z("Madrid", "Europe/Madrid"),
  z("Malta", "Europe/Malta"), z("Oslo", "Europe/Oslo"), z("Paris", "Europe/Paris"), z("Rome", "Europe/Rome"),
  z("Stockholm", "Europe/Stockholm"), z("Warsaw", "Europe/Warsaw"), z("Zurich", "Europe/Zurich"),
  z("Athens", "Europe/Athens"), z("Bahrain", "Asia/Bahrain"), z("Bucharest", "Europe/Bucharest"),
  z("Helsinki", "Europe/Helsinki"), z("Istanbul", "Europe/Istanbul"), z("Jerusalem", "Asia/Jerusalem"),
  z("Kuwait", "Asia/Kuwait"), z("Moscow", "Europe/Moscow"), z("Nairobi", "Africa/Nairobi"), z("Nicosia", "Asia/Nicosia"),
  z("Qatar", "Asia/Qatar"), z("Riga", "Europe/Riga"), z("Riyadh", "Asia/Riyadh"), z("Tallinn", "Europe/Tallinn"),
  z("Vilnius", "Europe/Vilnius"), z("Tehran", "Asia/Tehran"), z("Dubai", "Asia/Dubai"), z("Muscat", "Asia/Muscat"),
  z("Ashgabat", "Asia/Ashgabat"), z("Karachi", "Asia/Karachi"), z("Colombo", "Asia/Colombo"), z("Kolkata", "Asia/Kolkata"),
  z("Kathmandu", "Asia/Kathmandu"), z("Almaty", "Asia/Almaty"), z("Yangon", "Asia/Yangon"), z("Bangkok", "Asia/Bangkok"),
  z("Ho Chi Minh", "Asia/Ho_Chi_Minh"), z("Jakarta", "Asia/Jakarta"), z("Chongqing", "Asia/Shanghai"),
  z("Hong Kong", "Asia/Hong_Kong"), z("Manila", "Asia/Manila"), z("Perth", "Australia/Perth"), z("Shanghai", "Asia/Shanghai"),
  z("Singapore", "Asia/Singapore"), z("Taipei", "Asia/Taipei"), z("Seoul", "Asia/Seoul"), z("Tokyo", "Asia/Tokyo"),
  z("Brisbane", "Australia/Brisbane"), z("Adelaide", "Australia/Adelaide"), z("Sydney", "Australia/Sydney"),
  z("Norfolk Island", "Pacific/Norfolk"), z("New Zealand", "Pacific/Auckland"), z("Tokelau", "Pacific/Fakaofo"),
  z("Chatham Islands", "Pacific/Chatham"),
];

/** Offset of the zone at the given instant in minutes east of UTC. */
export function offsetMinutes(iana: string, at = Date.now()) {
  if (iana === "UTC") return 0;
  const part = new Intl.DateTimeFormat("en-US", { timeZone: iana, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(part ?? "");
  return m ? (m[1] === "-" ? -1 : 1) * (+m[2] * 60 + +m[3]) : 0;
}

/** "(UTC+5:30)" style label; a zero offset reads "(UTC)". */
export function offsetLabel(iana: string, at = Date.now()) {
  const o = offsetMinutes(iana, at);
  if (o === 0) return "(UTC)";
  const a = Math.abs(o);
  const mm = a % 60;
  return `(UTC${o < 0 ? "-" : "+"}${Math.floor(a / 60)}${mm ? ":" + String(mm).padStart(2, "0") : ""})`;
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const p2 = (n: number) => String(n).padStart(2, "0");

/** Calendar fields of a unix-seconds time as seen in the zone. */
function fields(sec: number, iana: string) {
  const d = new Date((sec + offsetMinutes(iana, sec * 1000) * 60) * 1000);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() };
}

export interface TimeFormat {
  /** Pattern of yyyy, yy, MMM, MM and dd tokens; other characters stay as they are. */
  date: string;
  hours12: boolean;
}
export const DEFAULT_TIME_FORMAT: TimeFormat = { date: "dd MMM 'yy", hours12: false };

const formatDate = (f: { y: number; mo: number; d: number }, pattern: string) =>
  pattern.replace(/yyyy|yy|MMM|MM|dd/g, (t) =>
    t === "yyyy" ? String(f.y) : t === "yy" ? String(f.y).slice(-2) : t === "MMM" ? MON[f.mo] : t === "MM" ? p2(f.mo + 1) : p2(f.d),
  );

const formatHour = (h: number, mi: number, hours12: boolean) =>
  hours12 ? `${h % 12 || 12}:${p2(mi)} ${h < 12 ? "AM" : "PM"}` : `${p2(h)}:${p2(mi)}`;

export const tickLabel = (sec: number, type: number, iana: string, hours12 = false) => {
  const f = fields(sec, iana);
  if (type === 0) return String(f.y);
  if (type === 1) return MON[f.mo];
  if (type === 2) return String(f.d);
  if (hours12) return formatHour(f.h, f.mi, true);
  return `${p2(f.h)}:${p2(f.mi)}` + (type === 4 ? `:${p2(f.s)}` : "");
};

export const crosshairLabel = (sec: number, iana: string, fmt: TimeFormat = DEFAULT_TIME_FORMAT, withTime = true) => {
  const f = fields(sec, iana);
  const date = formatDate(f, fmt.date);
  return withTime ? `${date}  ${formatHour(f.h, f.mi, fmt.hours12)}` : date;
};
