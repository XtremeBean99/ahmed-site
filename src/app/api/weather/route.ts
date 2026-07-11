// Read-only weather for the room window. Fixed to Canberra (no geolocation, no
// consent, no personal data), hourly-cached, fail-soft to clear. Open-Meteo needs
// no API key. This is the only server route the room-only site uses.
export const revalidate = 3600

export async function GET() {
  try {
    const r = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=-35.28&longitude=149.13&current=weather_code,precipitation',
      { next: { revalidate } },
    )
    const j = await r.json()
    return Response.json({
      code: j?.current?.weather_code ?? 0,
      precip: j?.current?.precipitation ?? 0,
    })
  } catch {
    return Response.json({ code: 0, precip: 0 })
  }
}
