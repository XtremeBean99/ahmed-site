// Pure mapping of WMO weather codes (Open-Meteo) to the room's visual weather.
// https://open-meteo.com/en/docs — weather_code interpretation.

export type WeatherKind = 'clear' | 'rain' | 'snow'
export interface Weather {
  kind: WeatherKind
  /** heavier precipitation → denser particle field */
  heavy: boolean
}

// Snow / snow grains / snow showers.
const SNOW = new Set([71, 73, 75, 77, 85, 86])
// Drizzle, rain, freezing rain, rain showers, thunderstorm.
const RAIN = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99])

export function mapWeather(code: number, precip: number): Weather {
  if (SNOW.has(code)) return { kind: 'snow', heavy: code === 75 || code === 86 }
  if (RAIN.has(code)) {
    return { kind: 'rain', heavy: precip > 2 || [65, 82, 95, 96, 99].includes(code) }
  }
  return { kind: 'clear', heavy: false }
}
