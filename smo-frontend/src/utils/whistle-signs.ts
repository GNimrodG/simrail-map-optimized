import { CrossingSign } from "./types";

/** The signs where the driver gives the "Attention" signal (Rp1): W6, and W6b before a level crossing */
export type WhistleSignType = Extract<CrossingSign["type"], "W6" | "W6b">;
export type WhistleSign = CrossingSign & { type: WhistleSignType };

export interface UpcomingWhistleSign {
  sign: WhistleSign;
  /** metres from the train, along its direction of travel */
  distance: number;
  /** the distance the warning starts at for this speed, for the progress */
  warningDistance: number;
}

const EARTH_RADIUS = 6_371_000; // m

// the warning comes this long before the train reaches the sign, but not closer than the minimum or further than the
// maximum distance (a slow train still gets it in time, a fast one doesn't get it kilometres before)
const WARNING_TIME = 30; // s
const MIN_WARNING_DISTANCE = 300; // m
const MAX_WARNING_DISTANCE = 1200; // m

// a sign is for the train when it faces the train's direction of travel (curves turn both a little)
const MAX_SIGN_TURN = 45; // degrees
// and it's ahead on the track: in the train's direction, or right beside the track when the train is almost there
const MAX_BEARING_TURN = 25; // degrees
const BESIDE_TRACK = 15; // m

export function isWhistleSign(sign: CrossingSign): sign is WhistleSign {
  return sign.type === "W6" || sign.type === "W6b";
}

function angleBetween(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

export function getWarningDistance(velocity: number): number {
  return Math.min(MAX_WARNING_DISTANCE, Math.max(MIN_WARNING_DISTANCE, (velocity / 3.6) * WARNING_TIME));
}

/**
 * The next W6/W6b sign the train passes, when it's within the warning distance; null without one, or when the train's
 * direction isn't known yet (it hasn't moved).
 */
export function findUpcomingWhistleSign(
  signs: WhistleSign[],
  latitude: number,
  longitude: number,
  heading: number | null | undefined,
  velocity: number,
): UpcomingWhistleSign | null {
  if (heading == null) {
    return null;
  }

  const warningDistance = getWarningDistance(velocity);
  const metresPerDegreeLat = (Math.PI / 180) * EARTH_RADIUS;
  const metresPerDegreeLon = metresPerDegreeLat * Math.cos((latitude * Math.PI) / 180);
  const headingRad = (heading * Math.PI) / 180;

  let upcoming: UpcomingWhistleSign | null = null;
  for (const sign of signs) {
    const east = (sign.lon - longitude) * metresPerDegreeLon;
    const north = (sign.lat - latitude) * metresPerDegreeLat;
    if (Math.abs(east) > warningDistance || Math.abs(north) > warningDistance) {
      continue;
    }

    const distance = Math.hypot(east, north);
    if (distance > warningDistance || angleBetween(sign.heading, heading) > MAX_SIGN_TURN) {
      continue;
    }

    // along and across the train's direction of travel
    const along = east * Math.sin(headingRad) + north * Math.cos(headingRad);
    const across = Math.abs(east * Math.cos(headingRad) - north * Math.sin(headingRad));
    const bearing = (Math.atan2(east, north) * 180) / Math.PI;
    if (along <= 0 || (across > BESIDE_TRACK && angleBetween(bearing, heading) > MAX_BEARING_TURN)) {
      continue;
    }

    if (!upcoming || along < upcoming.distance) {
      upcoming = { sign, distance: along, warningDistance };
    }
  }

  return upcoming;
}
