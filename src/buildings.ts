import {buildVasanthVihar,VASANTH_WAY_ID,VASANTH_HEIGHT,VASANTH_HEIGHT_SOURCE} from './districts/vasanth-vihar';
import {buildMallesRoyEnclave,MALLES_WAY_ID,MALLES_HEIGHT,MALLES_HEIGHT_SOURCE} from './districts/malles-roy-enclave';
import {buildSuryaApartments,SURYA_WAY_ID,SURYA_HEIGHT,SURYA_HEIGHT_SOURCE} from './districts/surya-apartments';
import {buildPrashanthApartments,PRASHANTH_WAY_ID,PRASHANTH_HEIGHT,PRASHANTH_HEIGHT_SOURCE} from './districts/prashanth-apartments';
import {buildAvinashApartments,AVINASH_WAY_ID,AVINASH_HEIGHT,AVINASH_HEIGHT_SOURCE} from './districts/avinash-apartments';
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {buildEncaarpusVilla,ENCAARPUS_WAY_ID,ENCAARPUS_HEIGHT,ENCAARPUS_HEIGHT_SOURCE} from './districts/encaarpus-villa';

// Footprints are map evidence. All unspecified heights and facade details are inference.
const ORIGIN = { lon: 80.2306892, lat: 13.0516624 };
const EAST = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
type Point = { x: number; z: number };
type Element = {
  id: number;
  type?: string;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  nodes?: number[];
  lat?: number;
  lon?: number;
};
type Batch = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrices: THREE.Matrix4[];
};

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function inside(point: Point, polygon: Point[]) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a.z > point.z !== b.z > point.z &&
      point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x
    )
      result = !result;
  }
  return result;
}
function plasterTexture(): THREE.DataTexture {
  const width = 128,
    pixels = new Uint8Array(width * width * 4),
    rng = random(7183);
  const streaks = Array.from({ length: width }, () => rng());
  for (let y = 0; y < width; y++)
    for (let x = 0; x < width; x++) {
      const value = Math.round(
        230 +
          rng() * 19 -
          streaks[x] * 7 -
          Math.sin(x / 11) * Math.sin(y / 19) * 5,
      );
      const index = (y * width + x) * 4;
      pixels[index] = value;
      pixels[index + 1] = value;
      pixels[index + 2] = value;
      pixels[index + 3] = 255;
    }
  const texture = new THREE.DataTexture(pixels, width, width);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.repeat.set(0.19, 0.19);
  texture.needsUpdate = true;
  return texture;
}

/** Georeferenced massing from Overpass JSON. This is not a surveyed facade reconstruction. */
export function buildNeighborhood(data: any): THREE.Group {
  const group = new THREE.Group();
  group.name = "OSM building footprints · inferred architectural detail";
  const elements: Element[] = Array.isArray(data?.elements)
    ? data.elements
    : [];
  const nodes = new Map(
    elements.filter((e) => e.type === "node").map((e) => [e.id, e]),
  );
  const texture = plasterTexture();
  const wallMaterials = [
    0xd0c8b8, 0xdbd6c8, 0xc4beb0, 0xc5c8bb, 0xc8c0b8, 0xc3b8a3, 0xb8c0bf,
    0xd3cec0,
  ].map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.93,
        map: texture,
        bumpMap: texture,
        bumpScale: 0.04,
      }),
  );
  const concrete = new THREE.MeshStandardMaterial({
    color: 0xafa99b,
    roughness: 0.98,
    map: texture,
    bumpMap: texture,
    bumpScale: 0.055,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: 0xb7b5aa,
    roughness: 0.88,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x323b3a,
    roughness: 0.78,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x344449,
    roughness: 0.28,
    metalness: 0.18,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: 0x5b5b51,
    roughness: 0.71,
    metalness: 0.25,
  });
  const tankMaterial = new THREE.MeshStandardMaterial({
    color: 0x25282a,
    roughness: 0.91,
  });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const tank = new THREE.CylinderGeometry(0.63, 0.64, 1.35, 16);
  const lid = new THREE.CylinderGeometry(0.35, 0.35, 0.09, 16);
  const batches = new Map<string, Batch>();
  const merged: THREE.BufferGeometry[][] = wallMaterials.map(() => []);
  const roofGeometries: THREE.BufferGeometry[] = [];
  const dummy = new THREE.Object3D();
  let detailCount = 0,
    buildingCount = 0,
    knownHeights = 0,
    inferredHeights = 0,
    rejected = 0;
  const skippedRoofWayIds: number[] = [];
  const records: {
    id: number;
    height: number;
    heightSource: string;
    footprintSource: string;
  }[] = [];
  function instance(
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    angle = 0,
  ) {
    if (!batches.has(name))
      batches.set(name, { geometry, material, matrices: [] });
    dummy.position.set(x, y, z);
    dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(0, angle, 0);
    dummy.updateMatrix();
    batches.get(name)!.matrices.push(dummy.matrix.clone());
    detailCount++;
  }
  for (const element of elements) {
    const tags = element.tags ?? {};
    if (!tags.building || tags.building === "no" || element.type === "relation")
      continue;
    // OSM building=roof describes an open shelter, not an enclosed building.
    // The station's two mapped platform shelters are constructed in railway.ts.
    if (tags.building === "roof") {
      skippedRoofWayIds.push(element.id);
      continue;
    }
    const coordinates =
      element.geometry ??
      element.nodes
        ?.map((id) => nodes.get(id))
        .filter(
          (e): e is Element =>
            !!e && e.lat !== undefined && e.lon !== undefined,
        )
        .map((e) => ({ lat: e.lat!, lon: e.lon! }));
    if (!coordinates || coordinates.length < 4) {
      rejected++;
      continue;
    }
    const points = coordinates.map((p) => ({
      x: (p.lon - ORIGIN.lon) * EAST,
      z: -(p.lat - ORIGIN.lat) * 111320,
    }));
    if (
      Math.hypot(
        points[0].x - points[points.length - 1].x,
        points[0].z - points[points.length - 1].z,
      ) > 0.5
    ) {
      rejected++;
      continue;
    }
    points.pop();
    let signedArea = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      signedArea += a.x * b.z - b.x * a.z;
    }
    if (Math.abs(signedArea) < 8) {
      rejected++;
      continue;
    }
    const rng = random(element.id);
    const parsedHeight = Number.parseFloat(tags.height ?? "");
    const levelsTag = tags["building:levels"] ?? "";
    const parsedLevels = /^\d+(?:\.\d+)?$/.test(levelsTag)
      ? Number(levelsTag)
      : NaN;
    const defaultLevels =
      tags.building === "apartments"
        ? 3
        : tags.building === "commercial"
          ? 3
          : tags.building === "shed" || tags.building === "garage"
            ? 1
            : 2 + (rng() > 0.68 ? 1 : 0);
    const height = Math.max(
      2.5,
      Math.min(
        110,
        Number.isFinite(parsedHeight)
          ? parsedHeight * (/ft|feet/.test(tags.height) ? 0.3048 : 1)
          : (Number.isFinite(parsedLevels) ? parsedLevels : defaultLevels) *
              3.1 +
              0.35,
      ),
    );
    const heightSource = Number.isFinite(parsedHeight)
      ? "OSM height tag"
      : Number.isFinite(parsedLevels)
        ? "OSM levels × inferred 3.1 m"
        : "inferred typology";
    if (Number.isFinite(parsedHeight) || Number.isFinite(parsedLevels))
      knownHeights++;
    else inferredHeights++;
    const floors = Math.max(1, Math.round((height - 0.35) / 3.1));
    const story = height / floors;
    if(element.id===VASANTH_WAY_ID){
      const frontage=buildVasanthVihar(points);group.add(frontage);
      buildingCount++;records.push({id:element.id,height:VASANTH_HEIGHT,heightSource:VASANTH_HEIGHT_SOURCE,footprintSource:'OpenStreetMap way geometry'});
      group.userData.vasanthVihar=frontage.userData;continue;
    }
    if(element.id===MALLES_WAY_ID){
      const frontage=buildMallesRoyEnclave(points);group.add(frontage);
      buildingCount++;records.push({id:element.id,height:MALLES_HEIGHT,heightSource:MALLES_HEIGHT_SOURCE,footprintSource:'OpenStreetMap way geometry'});
      group.userData.mallesRoyEnclave=frontage.userData;continue;
    }
    if(element.id===SURYA_WAY_ID){
      const frontage=buildSuryaApartments(points);group.add(frontage);
      buildingCount++;records.push({id:element.id,height:SURYA_HEIGHT,heightSource:SURYA_HEIGHT_SOURCE,footprintSource:'OpenStreetMap way geometry'});
      group.userData.suryaApartments=frontage.userData;continue;
    }
    if(element.id===PRASHANTH_WAY_ID){
      const frontage=buildPrashanthApartments(points,PRASHANTH_HEIGHT,PRASHANTH_HEIGHT_SOURCE);group.add(frontage);
      buildingCount++;records.push({id:element.id,height:PRASHANTH_HEIGHT,heightSource:PRASHANTH_HEIGHT_SOURCE,footprintSource:'OpenStreetMap way geometry'});
      group.userData.prashanthApartments=frontage.userData;continue;
    }
    if(element.id===AVINASH_WAY_ID){
      const frontage=buildAvinashApartments(points);group.add(frontage);
      buildingCount++;
      records.push({id:element.id,height:AVINASH_HEIGHT,heightSource:AVINASH_HEIGHT_SOURCE,footprintSource:'OpenStreetMap way geometry'});
      group.userData.avinashApartments=frontage.userData;
      continue;
    }
    if(element.id===ENCAARPUS_WAY_ID){
      const frontage=buildEncaarpusVilla(points);group.add(frontage);
      buildingCount++;
      records.push({id:element.id,height:ENCAARPUS_HEIGHT,heightSource:ENCAARPUS_HEIGHT_SOURCE,footprintSource:'OpenStreetMap way geometry'});
      group.userData.encaarpusVilla=frontage.userData;
      continue;
    }
    const shape = new THREE.Shape(
      points.map((p) => new THREE.Vector2(p.x, -p.z)),
    );
    const shell = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      steps: 1,
      bevelEnabled: false,
    });
    shell.rotateX(-Math.PI / 2);
    shell.clearGroups();
    const palette = Math.floor(rng() * wallMaterials.length);
    merged[palette].push(shell);
    const roof = new THREE.ShapeGeometry(shape);
    roof.rotateX(-Math.PI / 2);
    roof.translate(0, height + 0.018, 0);
    roofGeometries.push(roof);
    buildingCount++;
    records.push({
      id: element.id,
      height,
      heightSource,
      footprintSource: "OpenStreetMap way geometry",
    });
    const center = points.reduce(
      (p, c) => ({
        x: p.x + c.x / points.length,
        z: p.z + c.z / points.length,
      }),
      { x: 0, z: 0 },
    );
    const distance = Math.hypot(center.x, center.z);
    const close = distance < 320;
    const fineDetail = distance < 150;
    for (let edge = 0; edge < points.length; edge++) {
      const a = points[edge],
        b = points[(edge + 1) % points.length];
      const dx = b.x - a.x,
        dz = b.z - a.z,
        length = Math.hypot(dx, dz);
      if (length < 0.5) continue;
      const ux = dx / length,
        uz = dz / length;
      const direction = signedArea > 0 ? 1 : -1;
      const nx = uz * direction,
        nz = -ux * direction;
      const angle = -Math.atan2(dz, dx);
      const mx = (a.x + b.x) / 2,
        mz = (a.z + b.z) / 2;
      // Keep roof parapets inside the map footprint.
      instance(
        "parapets",
        box,
        concrete,
        mx - nx * 0.13,
        height + 0.39,
        mz - nz * 0.13,
        length,
        0.78,
        0.24,
        angle,
      );
      instance(
        "parapet caps",
        box,
        trim,
        mx - nx * 0.13,
        height + 0.8,
        mz - nz * 0.13,
        length + 0.04,
        0.075,
        0.29,
        angle,
      );
      if (!close || length < 3) continue;
      instance(
        "plinths",
        box,
        concrete,
        mx + nx * 0.025,
        0.25,
        mz + nz * 0.025,
        length,
        0.48,
        0.09,
        angle,
      );
      const bays = Math.min(16, Math.floor(length / 3.3));
      for (let floor = 0; floor < Math.min(floors, 12); floor++) {
        if (floor > 0)
          instance(
            "floor bands",
            box,
            trim,
            mx + nx * 0.045,
            floor * story,
            mz + nz * 0.045,
            length,
            0.13,
            0.1,
            angle,
          );
        for (let bay = 0; bay < bays; bay++) {
          const fraction = (bay + 1) / (bays + 1);
          const x = a.x + dx * fraction,
            z = a.z + dz * fraction,
            y = floor * story + 1.65;
          const width = Math.min(1.42, (length / (bays + 1)) * 0.57),
            wh = Math.min(1.42, story * 0.46);
          instance(
            "window shadows",
            box,
            dark,
            x + nx * 0.02,
            y,
            z + nz * 0.02,
            width + 0.18,
            wh + 0.18,
            0.055,
            angle,
          );
          instance(
            "glazing",
            box,
            glass,
            x + nx * 0.058,
            y,
            z + nz * 0.058,
            width,
            wh,
            0.02,
            angle,
          );
          if (fineDetail)
            instance(
              "window mullions",
              box,
              metal,
              x + nx * 0.09,
              y,
              z + nz * 0.09,
              0.045,
              wh + 0.07,
              0.065,
              angle,
            );
          if (fineDetail)
            instance(
              "window sills",
              box,
              trim,
              x + nx * 0.14,
              y - wh / 2 - 0.055,
              z + nz * 0.14,
              width + 0.24,
              0.105,
              0.34,
              angle,
            );
          instance(
            "sunshades",
            box,
            concrete,
            x + nx * 0.25,
            y + wh / 2 + 0.17,
            z + nz * 0.25,
            width + 0.4,
            0.095,
            0.63,
            angle,
          );
          // Security bars cast fine real-scale shadows without material transparency.
          if (fineDetail)
            for (let bar = 1; bar <= 3; bar++)
              instance(
                "security bars",
                box,
                metal,
                x + (ux * (bar - 2) * width) / 4 + nx * 0.125,
                y,
                z + (uz * (bar - 2) * width) / 4 + nz * 0.125,
                0.019,
                wh,
                0.025,
                angle,
              );
          if (
            fineDetail &&
            floor > 0 &&
            bay === 0 &&
            edge % 2 === 0 &&
            rng() > 0.55
          ) {
            instance(
              "AC condensers",
              box,
              trim,
              x + nx * 0.3,
              y - 0.24,
              z + nz * 0.3,
              0.74,
              0.49,
              0.48,
              angle,
            );
            instance(
              "AC vents",
              box,
              dark,
              x + nx * 0.548,
              y - 0.24,
              z + nz * 0.548,
              0.45,
              0.34,
              0.015,
              angle,
            );
          }
          if (
            fineDetail &&
            floor > 0 &&
            bay === Math.floor(bays / 2) &&
            length > 9 &&
            edge % 3 === 0
          ) {
            const balconyY = floor * story + 0.08;
            instance(
              "balcony slabs",
              box,
              concrete,
              x + nx * 0.47,
              balconyY,
              z + nz * 0.47,
              2.05,
              0.16,
              1.02,
              angle,
            );
            instance(
              "balcony rails",
              box,
              metal,
              x + nx * 0.94,
              balconyY + 1.05,
              z + nz * 0.94,
              2.04,
              0.045,
              0.05,
              angle,
            );
            for (let bar = 0; bar < 8; bar++)
              instance(
                "balcony bars",
                box,
                metal,
                x + ux * (bar / 7 - 0.5) * 1.97 + nx * 0.94,
                balconyY + 0.54,
                z + uz * (bar / 7 - 0.5) * 1.97 + nz * 0.94,
                0.025,
                1.02,
                0.025,
                angle,
              );
          }
        }
      }
    }
    if (close && inside(center, points) && Math.abs(signedArea) > 55) {
      instance(
        "tank pedestals",
        box,
        concrete,
        center.x,
        height + 0.13,
        center.z,
        1.55,
        0.24,
        1.55,
      );
      instance(
        "roof water tanks",
        tank,
        tankMaterial,
        center.x,
        height + 0.925,
        center.z,
        1,
        1,
        1,
      );
      instance(
        "tank lids",
        lid,
        tankMaterial,
        center.x,
        height + 1.645,
        center.z,
        1,
        1,
        1,
      );
      instance(
        "tank pipes",
        box,
        trim,
        center.x + 0.69,
        height + 0.82,
        center.z,
        0.055,
        1.5,
        0.055,
      );
    }
  }
  function addMerged(
    geometries: THREE.BufferGeometry[],
    material: THREE.Material,
    name: string,
  ) {
    if (!geometries.length) return;
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach((g) => g.dispose());
    if (!geometry) return;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  merged.forEach((geometries, index) =>
    addMerged(
      geometries,
      wallMaterials[index],
      `Mapped building shells ${index}`,
    ),
  );
  addMerged(roofGeometries, concrete, "Flat roof surfaces");
  for (const [name, batch] of batches) {
    const mesh = new THREE.InstancedMesh(
      batch.geometry,
      batch.material,
      batch.matrices.length,
    );
    batch.matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.name = `Inferred ${name}`;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  group.userData = {
    ...group.userData,
    buildingCount,
    knownHeights,
    inferredHeights,
    rejected,
    detailCount,
    skippedRoofWayIds,
    origin: ORIGIN,
    records,
    provenance:
      "OSM footprints; unverified inferred facades, roofs, colors, and equipment. Not photogrammetry or surveyed geometry. Explicit building=roof ways excluded from enclosed shells.",
  };
  return group;
}
