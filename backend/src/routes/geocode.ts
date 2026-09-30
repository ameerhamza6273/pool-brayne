import type { FastifyInstance } from "fastify";

// Client video 2026-09-29: several real addresses pin miles from the real house because
// Nominatim/OSM's US road data has gaps for newer suburban streets. The US Census Bureau's free,
// no-key geocoder (built from official TIGER/Line address ranges) finds many of these -- but,
// unlike Nominatim, it sends no `Access-Control-Allow-Origin` header, so the browser can't call
// it directly (confirmed: curl succeeds, a page fetch() is blocked by CORS). This proxies the one
// call server-to-server (no CORS restriction there) so the frontend's geocode.ts can still just
// call a same-origin endpoint.
export default async function geocodeRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { address?: string } }>("/census", async (req, reply) => {
    const address = req.query.address;
    if (!address) return reply.code(400).send({ error: "address is required" });
    const res = await fetch(
      `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`,
    );
    const data = (await res.json()) as { result?: { addressMatches?: { coordinates: { x: number; y: number } }[] } };
    const match = data.result?.addressMatches?.[0];
    return match ? { lat: match.coordinates.y, lng: match.coordinates.x } : null;
  });
}
