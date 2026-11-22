// Small geometry helpers without browser dependencies (usable in node tests).
export function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const distKm = (a, b) => getDistanceKm(a[0], a[1], b[0], b[1]);

/** Orders points (with .coords) as a short walking chain starting from the first one. */
export function nearestNeighbourOrder(points) {
  if (points.length < 3) return [...points];
  const rest = points.slice(1); const out = [points[0]];
  while (rest.length) {
    const last = out[out.length - 1].coords;
    let bi = 0, bd = Infinity;
    rest.forEach((p, i) => { const d = distKm(last, p.coords); if (d < bd) { bd = d; bi = i; } });
    out.push(rest.splice(bi, 1)[0]);
  }
  return out;
}

export const centroid = (pts) => {
  const c = pts.filter((p) => p?.coords);
  if (!c.length) return null;
  return [c.reduce((s, p) => s + p.coords[0], 0) / c.length, c.reduce((s, p) => s + p.coords[1], 0) / c.length];
};
