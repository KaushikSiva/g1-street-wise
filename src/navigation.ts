/** Static map collision, optional installed obstacles and platform elevation. */
export type ElevatedSurface = (x: number, z: number) => number | null;
export function createNavigation(data: any, elevatedSurfaces: ElevatedSurface[] = [], obstacles: ((x:number,z:number)=>boolean)[] = []) {
  const scale = 111320 * Math.cos((13.0516624 * Math.PI) / 180);
  type Polygon = {
    points: { x: number; z: number }[];
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  const buildings: Polygon[] = [],
    platforms: Polygon[] = [];
  for (const element of data.elements ?? []) {
    const t = element.tags ?? {},
      g = element.geometry;
    if (!g || g.length < 4) continue;
    const isPlatform =
      t.railway === "platform" || t.public_transport === "platform";
    if (
      !isPlatform &&
      (!t.building || t.building === "roof" || t.building === "no")
    )
      continue;
    const points = g.map((p: { lat: number; lon: number }) => ({
      x: (p.lon - 80.2306892) * scale,
      z: (13.0516624 - p.lat) * 111320,
    }));
    const polygon = {
      points,
      minX: Math.min(...points.map((p: { x: number }) => p.x)),
      maxX: Math.max(...points.map((p: { x: number }) => p.x)),
      minZ: Math.min(...points.map((p: { z: number }) => p.z)),
      maxZ: Math.max(...points.map((p: { z: number }) => p.z)),
    };
    (isPlatform ? platforms : buildings).push(polygon);
  }
  function inside(x: number, z: number, p: Polygon) {
    if (x < p.minX || x > p.maxX || z < p.minZ || z > p.maxZ) return false;
    let hit = false;
    for (let i = 0, j = p.points.length - 1; i < p.points.length; j = i++) {
      const a = p.points[i],
        b = p.points[j];
      if (
        a.z > z !== b.z > z &&
        x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x
      )
        hit = !hit;
    }
    return hit;
  }
  function baseHeightAt(x: number, z: number) {
    return platforms.some((p) => inside(x, z, p)) ? 1.05 : 0;
  }
  function heightAt(x: number, z: number, previousSurfaceHeight?: number) {
    const base = baseHeightAt(x, z);
    // A two-dimensional position cannot distinguish a road deck from the space
    // beneath it. Retain the walker's current support level when selecting one.
    if (previousSurfaceHeight === undefined) return base;
    // Explicit nearby ground surfaces can descend below the nominal zero
    // datum (e.g. a driveway meeting the road shoulder). Let their geometry
    // replace that fallback; a raised platform remains a real competing level.
    let selected = base, selectedExplicitly = false;
    for (const sample of elevatedSurfaces) {
      const height = sample(x, z);
      if (height !== null && Number.isFinite(height) &&
          ((Math.abs(height - previousSurfaceHeight) <= 0.25 &&
            (height > selected || (!selectedExplicitly && base === 0))) ||
           Math.abs(height - previousSurfaceHeight) < Math.abs(selected - previousSurfaceHeight))) {
        selected = height;
        selectedExplicitly = true;
      }
    }
    return selected;
  }
  return {
    canWalk: (x: number, z: number, previousSurfaceHeight?: number, fromX?: number, fromZ?: number) =>
      x >= -600 &&
      x <= 500 &&
      z >= -595 &&
      z <= 296 &&
      !buildings.some((p) => inside(x, z, p)) &&
      !obstacles.some(blocked=>blocked(x,z)) &&
      // Stop at elevated edges instead of dropping through a parapet to ground.
      (previousSurfaceHeight === undefined ||
       elevatedSurfaces.length === 0 ||
       (fromX !== undefined && fromZ !== undefined && !elevatedSurfaces.some(sample => {
         const height = sample(fromX, fromZ);
         return height !== null && height > baseHeightAt(fromX, fromZ) + 0.25 &&
           Math.abs(height - previousSurfaceHeight) <= 0.25;
       })) ||
       previousSurfaceHeight <= baseHeightAt(x, z) + 0.45 ||
       Math.abs(heightAt(x, z, previousSurfaceHeight) - previousSurfaceHeight) <= 0.45),
    heightAt,
    buildingCount: buildings.length,
  };
}
