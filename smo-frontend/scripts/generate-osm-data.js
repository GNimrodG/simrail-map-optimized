// Generates the OpenStreetMap data the map uses, so clients never query the Overpass API themselves:
//
// - src/assets/stopping-points.json: the stopping points of the SimRail schedules with their positions.
//   A stopping point is a point of the timetables where trains make commercial stops, that isn't a station
//   shown on the map already (playable, unplayable or a sub-station). Positions come from OSM
//   (railway=halt/station with the same name). When several share a name, the one closest to the
//   stations next to it in the timetables is used.
// - src/assets/station-osm-tags.json: the OSM name translations and operator of the stations on the map
//   (playable and unplayable), matched by name or else by railway:ref = station prefix, near the station
//   (railway=station/halt/yard/service_station/junction, technical and freight stations are mostly the latter).
//
// Fixes go in osm-overrides.json, per kind ("stoppingPoints", "stations"), by SimRail name:
// { osmName } to match another OSM name, { lat, lon } for a stopping point's position, { exclude: true },
// each with an optional note.
//
// usage: node scripts/generate-osm-data.js
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, "..", "src", "assets");
const STOPPING_POINTS_OUTPUT = join(ASSETS, "stopping-points.json");
const STATION_TAGS_OUTPUT = join(ASSETS, "station-osm-tags.json");
const OVERRIDES = join(__dirname, "osm-overrides.json");

const SIMRAIL_PANEL = "https://panel.simrail.eu:8084";
const SIMRAIL_API = "https://api.simrail.eu:8082/api";
// The public Overpass instances, tried in order (the main one is often overloaded)
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// Poland and the neighbouring parts of Germany, Czechia, Slovakia and Austria (trains to Vienna)
const BBOX = "47.5,12.0,55.0,24.5";

// The name translations kept from OSM (the languages of the app)
const LANGUAGES = ["en", "de", "hu", "pl", "ru", "tr", "uk"];

// Objects with the same name closer than this to each other are the same place (e.g. a halt and its station node)
const SAME_PLACE_KM = 3;

// A station's OSM object has to be this close to the station's position on the map
const MAX_STATION_KM = 5;

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

async function getJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  return res.json();
}

function distanceKm([lat1, lon1], [lat2, lon2]) {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** The translations (that differ from the name) and the operator of an OSM object. */
function osmTags(element, name) {
  const tags = {};
  for (const lng of LANGUAGES) {
    const translated = element.tags[`name:${lng}`];
    if (translated && translated !== name) tags[`name:${lng}`] = translated;
  }
  if (element.tags.operator) tags.operator = element.tags.operator;
  return tags;
}

const byName = ([a], [b]) => a.localeCompare(b, "pl");

const servers = (await getJson(`${SIMRAIL_PANEL}/servers-open`)).data.filter((s) => s.IsActive).map((s) => s.ServerCode);
console.log(`Servers: ${servers.join(", ")}`);

// Stations on the map: name -> { position, prefix }
const stations = new Map();
const knownStations = new Set(); // with the sub-stations, which have no marker of their own

for (const station of readJson(join(ASSETS, "unplayable-stations.json"))) {
  knownStations.add(station.Name);
  station.SubStations?.forEach((name) => knownStations.add(name));
  stations.set(station.Name, { position: [station.Latitude, station.Longitude], prefix: station.Prefix });
}

// Timetables (the same on most servers, so only the distinct ones are kept)
const timetables = new Map();

for (const server of servers) {
  for (const station of (await getJson(`${SIMRAIL_PANEL}/stations-open?serverCode=${server}`)).data) {
    knownStations.add(station.Name);
    // (sic) the SimRail API's spelling
    stations.set(station.Name, { position: [station.Latititude ?? station.Latitude, station.Longitude], prefix: station.Prefix });
  }

  for (const timetable of await getJson(`${SIMRAIL_API}/getAllTimetables?serverCode=${server}`)) {
    const points = timetable.timetable.map((e) => ({ name: e.nameOfPoint, stopType: e.stopType }));
    timetables.set(`${timetable.trainNoLocal}|${points.map((p) => p.name).join("|")}`, points);
  }
}

console.log(`${timetables.size} distinct timetables, ${stations.size} stations on the map`);

// Stopping points, with the stations next to them in the timetables as position hints
const stoppingPoints = new Map(); // name -> Set of neighbouring station names

for (const points of timetables.values()) {
  points.forEach((point, i) => {
    if (point.stopType !== "CommercialStop" || knownStations.has(point.name)) return;

    const neighbours = stoppingPoints.get(point.name) ?? new Set();
    const prev = points.slice(0, i).findLast((p) => stations.has(p.name));
    const next = points.slice(i + 1).find((p) => stations.has(p.name));
    if (prev) neighbours.add(prev.name);
    if (next) neighbours.add(next.name);
    stoppingPoints.set(point.name, neighbours);
  });
}

console.log(`${stoppingPoints.size} stopping points in the timetables`);

const overrides = readJson(OVERRIDES);
const stoppingPointOverrides = overrides.stoppingPoints ?? {};
const stationOverrides = overrides.stations ?? {};

// The railway types a stopping point / a station on the map can be in OSM (technical stations and freight
// stations are mostly yards, junctions or service stations there)
const STOPPING_POINT_TYPES = ["halt", "station"];
const STATION_TYPES = ["station", "halt", "yard", "service_station", "junction"];

// All the named railway objects of these types in the area, matched by name below (exact tag filters: a filter
// per name or a regex on the railway tag timed out on Overpass)
const query = `[out:json][timeout:300];(${[...new Set([...STOPPING_POINT_TYPES, ...STATION_TYPES])]
  .map((type) => `nwr["railway"="${type}"]["name"](${BBOX});`)
  .join("")});out center tags;`;

async function queryOverpass(query) {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const result = await getJson(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          // Overpass refuses requests with Node's default user agent
          "User-Agent": "smo-osm-data-generator (https://smo.data-unknown.com)",
        },
        body: "data=" + encodeURIComponent(query),
      });

      // Overpass reports errors like timeouts as a remark next to empty or partial results
      if (result.remark) throw new Error(result.remark);

      console.log(`Queried ${endpoint}`);
      return result;
    } catch (error) {
      console.warn(`Overpass query failed on ${endpoint}: ${error.message}`);
    }
  }

  throw new Error("The Overpass query failed on every endpoint");
}

const osm = await queryOverpass(query);
console.log(`${osm.elements.length} named railway objects in OSM`);

const osmByName = new Map();
const osmByRef = new Map();
for (const element of osm.elements) {
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (lat == null || lon == null) continue;

  const withPosition = { ...element, lat, lon };
  osmByName.set(element.tags.name, [...(osmByName.get(element.tags.name) ?? []), withPosition]);

  const ref = element.tags["railway:ref"]?.toLowerCase();
  if (ref) osmByRef.set(ref, [...(osmByRef.get(ref) ?? []), withPosition]);
}

// --- Stopping points ---

// railway=halt is the stopping point itself, a station with the same name only stands in for it
const haltFirst = { halt: 0, station: 1 };

const stoppingPointsResult = [];
const unmatchedStoppingPoints = [];
const ambiguousStoppingPoints = [];

for (const [name, neighbourNames] of [...stoppingPoints].sort(byName)) {
  const override = stoppingPointOverrides[name];
  if (override?.exclude) continue;

  const anchors = [...neighbourNames].map((n) => stations.get(n).position);
  const nearestAnchorKm = (pos) => (anchors.length ? Math.min(...anchors.map((a) => distanceKm(a, pos))) : 0);

  if (override?.lat != null && override?.lon != null) {
    stoppingPointsResult.push({ id: -(stoppingPointsResult.length + 1), lat: override.lat, lon: override.lon, tags: { name } });
    continue;
  }

  const candidates = (osmByName.get(override?.osmName ?? name) ?? [])
    .filter((c) => STOPPING_POINT_TYPES.includes(c.tags.railway))
    .map((c) => ({ c, km: nearestAnchorKm([c.lat, c.lon]) }))
    .sort((a, b) => a.km - b.km);

  if (!candidates.length) {
    unmatchedStoppingPoints.push(`${name} (next to ${[...neighbourNames].join(", ") || "no known station"})`);
    continue;
  }

  // the place closest to the stations next to it, and there the halt rather than a station node
  const closest = candidates[0];
  const samePlace = candidates.filter((x) => distanceKm([x.c.lat, x.c.lon], [closest.c.lat, closest.c.lon]) < SAME_PLACE_KM);
  const best = samePlace.sort((a, b) => haltFirst[a.c.tags.railway] - haltFirst[b.c.tags.railway])[0];

  const otherPlaces = candidates.filter((x) => !samePlace.includes(x));
  if (otherPlaces.length)
    ambiguousStoppingPoints.push(
      `${name}: picked ${Math.round(closest.km)} km from ${[...neighbourNames].join(", ")}, ` +
        `others ${otherPlaces.map((x) => Math.round(x.km)).join(", ")} km`,
    );

  stoppingPointsResult.push({
    id: best.c.id,
    lat: +best.c.lat.toFixed(6),
    lon: +best.c.lon.toFixed(6),
    tags: { name, ...osmTags(best.c, name) },
  });
}

writeFileSync(STOPPING_POINTS_OUTPUT, JSON.stringify(stoppingPointsResult, null, 2) + "\n");
console.log(`\nWrote ${stoppingPointsResult.length} stopping points to ${STOPPING_POINTS_OUTPUT}`);

// --- Stations ---

const stationTags = {};
const unmatchedStations = [];

for (const [name, { position, prefix }] of [...stations].sort(byName)) {
  const override = stationOverrides[name];
  if (override?.exclude) continue;

  // near the station on the map (the same railway:ref is used all over the country), the most station-like first
  const near = (list) =>
    (list ?? [])
      .filter((c) => STATION_TYPES.includes(c.tags.railway))
      .map((c) => ({ c, km: distanceKm(position, [c.lat, c.lon]) }))
      .filter((x) => x.km <= MAX_STATION_KM)
      .sort((a, b) => STATION_TYPES.indexOf(a.c.tags.railway) - STATION_TYPES.indexOf(b.c.tags.railway) || a.km - b.km);

  // prefixes are like "KG", "ŁA" (OSM: "Ła") or "2582_Me" (point id + ref)
  const refs = prefix ? [...new Set([prefix, prefix.split("_").at(-1)])].map((ref) => ref.toLowerCase()) : [];
  const best = near(osmByName.get(override?.osmName ?? name))[0] ?? near(refs.flatMap((ref) => osmByRef.get(ref) ?? []))[0];

  if (!best) {
    unmatchedStations.push(`${name} (${prefix || "no prefix"})`);
    continue;
  }

  const tags = osmTags(best.c, name);
  if (Object.keys(tags).length) stationTags[name] = tags;
}

writeFileSync(STATION_TAGS_OUTPUT, JSON.stringify(stationTags, null, 2) + "\n");
console.log(`Wrote the OSM tags of ${Object.keys(stationTags).length} of ${stations.size} stations to ${STATION_TAGS_OUTPUT}`);

if (ambiguousStoppingPoints.length)
  console.log(
    `\nStopping points named like several places, picked the closest (check them, fix in ${OVERRIDES}):\n  ` +
      ambiguousStoppingPoints.join("\n  "),
  );
if (unmatchedStoppingPoints.length)
  console.log(`\nStopping points not found in OSM (add them to ${OVERRIDES}):\n  ${unmatchedStoppingPoints.join("\n  ")}`);
if (unmatchedStations.length)
  console.log(
    `\nStations not found in OSM within ${MAX_STATION_KM} km (add them to ${OVERRIDES} if they exist):\n  ` +
      unmatchedStations.join("\n  "),
  );
