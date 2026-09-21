// Client request 2026-09-21: "a route line between jobs ... like the other software". Real road
// geometry from the public OSRM demo server (free, no key). It's best-effort: callers draw a straight
// line first and swap in the road route only if this resolves, so an outage just leaves straight lines.
const cache = new Map<string, [number, number][] | null>();
let queue: Promise<unknown> = Promise.resolve();

export function fetchRoadRoute(points: [number, number][]): Promise<[number, number][] | null> {
  if (points.length < 2) return Promise.resolve(null);
  const key = points.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(";");
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);

  const task = queue.then(async () => {
    try {
      const coords = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
      const data = (await res.json()) as { routes?: { geometry: { coordinates: [number, number][] } }[] };
      const line = data.routes?.[0]?.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]) ?? null;
      cache.set(key, line);
      await new Promise((r) => setTimeout(r, 400));
      return line;
    } catch {
      cache.set(key, null);
      return null;
    }
  });
  queue = task;
  return task as Promise<[number, number][] | null>;
}
