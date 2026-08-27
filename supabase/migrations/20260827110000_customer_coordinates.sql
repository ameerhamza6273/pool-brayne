-- Cached geocoding results (from free Nominatim/OpenStreetMap lookups, no paid Maps API key
-- available) so the Jobs map/route view doesn't re-geocode the same address every render.
alter table customers add column lat double precision;
alter table customers add column lng double precision;
