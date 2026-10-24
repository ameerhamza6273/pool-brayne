import type { FastifyInstance } from "fastify";

// Client video 2026-09-29: several real addresses pin miles from the real house because Nominatim/OSM's US road data has gaps for
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
