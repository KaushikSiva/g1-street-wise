import * as THREE from "three";

/** A deliberate illustration, never a surveyed tree location. Units are metres. */
export type InferredTree = {
  x: number;
  z: number;
  height?: number;
  crownDiameter?: number;
  seed?: number;
};
type MapElement = {
  id: number;
  type?: string;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
};
type Tree = InferredTree & {
  source:
    "mapped-point" | "inferred-in-mapped-woodland" | "explicitly-inferred";
  osmId?: number;
};
const origin = { lat: 13.0516624, lon: 80.2306892 };
const eastScale = 111320 * Math.cos((origin.lat * Math.PI) / 180);
const project = (lat: number, lon: number) => ({
  x: (lon - origin.lon) * eastScale,
  z: (origin.lat - lat) * 111320,
});
function randomSequence(seed: number) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
function inside(x: number, z: number, points: { x: number; z: number }[]) {
  let result = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i],
      b = points[j];
    if (
      a.z > z !== b.z > z &&
      x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x
    )
      result = !result;
  }
  return result;
}

/** Painted leaf silhouettes, not a photographic texture or a claim about species. */
function foliageTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!,
    random = randomSequence(62813);
  ctx.lineCap = "round";
  // An irregular spray avoids the repeated fan/fern outline of the first study.
  for (let leaf = 0; leaf < 245; leaf++) {
    const angle = random() * Math.PI * 2,
      radial = Math.sqrt(random());
    const x = 256 + Math.cos(angle) * radial * (182 + 30 * Math.sin(angle * 3));
    const y = 256 + Math.sin(angle) * radial * (186 + 25 * Math.cos(angle * 5));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(random() * Math.PI * 2);
    const length = 11 + random() * 14,
      width = length * (0.31 + random() * 0.17);
    const light = 24 + random() * 16,
      hue = 77 + random() * 26;
    const gradient = ctx.createLinearGradient(-width, 0, width, 0);
    gradient.addColorStop(0, `hsl(${hue} 23% ${light - 7}%)`);
    gradient.addColorStop(0.45, `hsl(${hue} 26% ${light + 4}%)`);
    gradient.addColorStop(1, `hsl(${hue + 4} 24% ${light - 3}%)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, length);
    ctx.bezierCurveTo(-width, length * 0.3, -width, -length * 0.7, 0, -length);
    ctx.bezierCurveTo(
      width * 0.9,
      -length * 0.35,
      width,
      length * 0.5,
      0,
      length,
    );
    ctx.fill();
    ctx.strokeStyle = "rgba(156,165,102,0.25)";
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(0, length * 0.8);
    ctx.lineTo(0, -length * 0.85);
    ctx.stroke();
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function barkTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!,
    random = randomSequence(1229);
  ctx.fillStyle = "#777260";
  ctx.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 1900; i++) {
    const shade = 30 + random() * 110;
    ctx.strokeStyle = `rgba(${shade},${shade * 0.96},${shade * 0.81},${0.12 + random() * 0.35})`;
    ctx.lineWidth = 0.3 + random() * 2;
    const x = random() * 128,
      y = random() * 512;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + random() * 5 - 2.5, y + 5 + random() * 60);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Mapped points retain their map coordinates. All shape/height/species details are
 * inferred unless height is tagged. Woodland scatter is explicitly inferred.
 * No trees are silently invented when the input has no vegetation evidence.
 */
export function buildVegetation(
  data: { elements?: MapElement[] },
  inferred: InferredTree[] = [],
): THREE.Group {
  const group = new THREE.Group();
  group.name = "vegetation-with-provenance";
  const trees: Tree[] = [];
  for (const element of data.elements ?? []) {
    const tags = element.tags ?? {};
    if (
      tags.natural === "tree" &&
      element.lat !== undefined &&
      element.lon !== undefined
    ) {
      const height = parseFloat(tags.height ?? "");
      trees.push({
        ...project(element.lat, element.lon),
        height: Number.isFinite(height) && height > 0 ? height : undefined,
        seed: element.id,
        source: "mapped-point",
        osmId: element.id,
      });
    } else if (
      (tags.natural === "wood" || tags.landuse === "forest") &&
      element.geometry &&
      element.geometry.length > 3
    ) {
      const polygon = element.geometry.map((p) => project(p.lat, p.lon));
      const minX = Math.min(...polygon.map((p) => p.x)),
        maxX = Math.max(...polygon.map((p) => p.x));
      const minZ = Math.min(...polygon.map((p) => p.z)),
        maxZ = Math.max(...polygon.map((p) => p.z));
      const random = randomSequence(element.id);
      for (let z = minZ + 3; z < maxZ; z += 8)
        for (let x = minX + 3; x < maxX; x += 8) {
          const px = x + (random() - 0.5) * 6,
            pz = z + (random() - 0.5) * 6;
          if (inside(px, pz, polygon) && trees.length < 300)
            trees.push({
              x: px,
              z: pz,
              seed: Math.floor(random() * 10000000),
              source: "inferred-in-mapped-woodland",
              osmId: element.id,
            });
        }
    }
  }
  trees.push(
    ...inferred.map((t) => ({ ...t, source: "explicitly-inferred" as const })),
  );
  group.userData = {
    treeCount: trees.length,
    mappedPoints: trees.filter((t) => t.source === "mapped-point").length,
    inferredCount: trees.filter((t) => t.source !== "mapped-point").length,
    inventoryStatus:
      "Incomplete map evidence; absent tags do not mean absent trees",
    formStatus:
      "Procedural broadleaf study; species, crown shape and untagged heights are inferred",
    placements: trees,
  };
  if (!trees.length) return group;

  const leaves: {
    matrix: THREE.Matrix4;
    color: THREE.Color;
    normal: THREE.Vector3;
  }[] = [];
  const branches: { matrix: THREE.Matrix4; color: THREE.Color }[] = [];
  const up = new THREE.Vector3(0, 1, 0),
    dummy = new THREE.Object3D();
  const segment = (
    from: THREE.Vector3,
    to: THREE.Vector3,
    radius: number,
    shade: number,
  ) => {
    dummy.position.copy(from).lerp(to, 0.5);
    dummy.quaternion.setFromUnitVectors(up, to.clone().sub(from).normalize());
    dummy.scale.set(radius, from.distanceTo(to), radius);
    dummy.updateMatrix();
    branches.push({
      matrix: dummy.matrix.clone(),
      color: new THREE.Color().setScalar(shade),
    });
  };
  trees.forEach((tree, index) => {
    const random = randomSequence(tree.seed ?? index * 1723 + 1337);
    const height = THREE.MathUtils.clamp(
      tree.height ?? 8 + random() * 5,
      2,
      30,
    );
    const radius = (tree.crownDiameter ?? height * (0.75 + random() * 0.3)) / 2;
    const base = new THREE.Vector3(tree.x, 0, tree.z),
      trunkRadius = height * (0.025 + random() * 0.011);
    let previous = base.clone();
    const bend = new THREE.Vector3(
      (random() - 0.5) * 0.8,
      0,
      (random() - 0.5) * 0.8,
    );
    for (let i = 1; i <= 6; i++) {
      const next = base.clone().addScaledVector(bend, i / 6);
      next.x += Math.sin(i * 0.8) * trunkRadius * 0.28;
      next.y = (height * 0.48 * i) / 6;
      segment(
        previous,
        next,
        trunkRadius * Math.pow(0.82, i - 1),
        0.66 + random() * 0.18,
      );
      previous = next;
    }
    for (let root = 0; root < 5; root++) {
      const angle = (root / 5) * Math.PI * 2 + random() * 0.7;
      segment(
        base
          .clone()
          .add(
            new THREE.Vector3(
              Math.cos(angle) * trunkRadius * 2.3,
              -0.07,
              Math.sin(angle) * trunkRadius * 2.3,
            ),
          ),
        base.clone().add(new THREE.Vector3(0, 0.4, 0)),
        trunkRadius * 0.5,
        0.65,
      );
    }
    const phase = random() * Math.PI * 2;
    for (let lobe = 0; lobe < 13; lobe++) {
      const angle = phase + lobe * 2.39996;
      const spread = lobe === 0 ? 0.15 : 0.38 + random() * 0.4;
      const center = base
        .clone()
        .add(
          new THREE.Vector3(
            Math.cos(angle) * radius * spread,
            height * (lobe === 0 ? 0.85 : 0.59 + random() * 0.25),
            Math.sin(angle) * radius * spread,
          ),
        );
      const junction = previous.clone();
      junction.y -= random() * height * 0.13;
      const fork = junction.clone().lerp(center, 0.5);
      fork.y -= height * 0.035;
      segment(junction, fork, trunkRadius * (0.28 + random() * 0.2), 0.72);
      segment(fork, center, trunkRadius * 0.23, 0.77);
      const lobeRadius = radius * (0.42 + random() * 0.15);
      for (let twig = 0; twig < 3; twig++) {
        const a = angle + (twig - 1) * 0.8;
        const end = center
          .clone()
          .add(
            new THREE.Vector3(
              Math.cos(a) * lobeRadius * 0.8,
              height * 0.075,
              Math.sin(a) * lobeRadius * 0.8,
            ),
          );
        segment(center, end, trunkRadius * 0.095, 0.8);
      }
      for (let card = 0; card < 48; card++) {
        const azimuth = random() * Math.PI * 2,
          vertical = random() * 2 - 1,
          r = Math.cbrt(random());
        const lateral = Math.sqrt(1 - vertical * vertical);
        dummy.position
          .copy(center)
          .add(
            new THREE.Vector3(
              Math.cos(azimuth) * lateral * r * lobeRadius,
              vertical * r * height * 0.19,
              Math.sin(azimuth) * lateral * r * lobeRadius,
            ),
          );
        dummy.rotation.set(
          (random() - 0.5) * Math.PI,
          random() * Math.PI * 2,
          random() * Math.PI * 2,
        );
        const size = height * (0.155 + random() * 0.065);
        dummy.scale.set(size, size * (0.8 + random() * 0.35), 1);
        dummy.updateMatrix();
        const brightness =
          0.58 + r * 0.21 + random() * 0.14 + Math.max(0, vertical) * 0.07;
        const normal = dummy.position
          .clone()
          .sub(base)
          .sub(new THREE.Vector3(0, height * 0.6, 0));
        normal.y += height * 0.12;
        normal.normalize();
        leaves.push({
          matrix: dummy.matrix.clone(),
          color: new THREE.Color().setRGB(
            brightness * 0.96,
            brightness,
            brightness * 0.93,
          ),
          normal,
        });
      }
    }
  });
  const bark = barkTexture();
  const wood = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.82, 1, 1, 9),
    new THREE.MeshStandardMaterial({
      map: bark,
      bumpMap: bark,
      bumpScale: 0.018,
      roughness: 0.98,
    }),
    branches.length,
  );
  wood.name = "tapered-trunks-and-forks";
  wood.castShadow = wood.receiveShadow = true;
  branches.forEach((branch, i) => {
    wood.setMatrixAt(i, branch.matrix);
    wood.setColorAt(i, branch.color);
  });
  const leafMap = foliageTexture();
  const leafMaterial = new THREE.MeshStandardMaterial({
    map: leafMap,
    side: THREE.DoubleSide,
    alphaTest: 0.24,
    roughness: 0.72,
    bumpMap: leafMap,
    bumpScale: 0.003,
  });
  // Crown-level normals prevent each twig card from reading as a flat patch.
  // This light-wrap approximation keeps shadowed interior foliage dark; it is
  // not glass transmission and does not incur a second scene render on mobile.
  leafMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "attribute vec3 foliageNormal;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <normal_vertex>",
      "#include <normal_vertex>\nvNormal = normalize(normalMatrix * foliageNormal);",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_begin>",
      THREE.ShaderChunk.normal_fragment_begin.replace(
        "normal *= faceDirection;",
        "/* Crown normal is independent of card winding. */",
      ),
    );
    const direct =
      "RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );";
    const lights = THREE.ShaderChunk.lights_fragment_begin
      .split(direct)
      .join(
        direct +
          "\nreflectedLight.directDiffuse += directLight.color * material.diffuseColor * (0.10 * pow(max(0.0, dot(-geometryNormal, directLight.direction)), 1.5));",
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_fragment_begin>",
      lights,
    );
  };
  leafMaterial.customProgramCacheKey = () =>
    "kodambakkam-foliage-radial-wrap-v2";
  const cardGeometry = new THREE.PlaneGeometry(1, 1);
  cardGeometry.setAttribute(
    "foliageNormal",
    new THREE.InstancedBufferAttribute(
      new Float32Array(leaves.flatMap((leaf) => leaf.normal.toArray())),
      3,
    ),
  );
  const crown = new THREE.InstancedMesh(
    cardGeometry,
    leafMaterial,
    leaves.length,
  );
  crown.name = "irregular-alpha-cut-leaf-clusters";
  crown.castShadow = crown.receiveShadow = true;
  crown.customDepthMaterial = new THREE.MeshDepthMaterial({
    map: (crown.material as THREE.MeshStandardMaterial).map,
    alphaTest: 0.24,
    depthPacking: THREE.RGBADepthPacking,
    side: THREE.DoubleSide,
  });
  leaves.forEach((leaf, i) => {
    crown.setMatrixAt(i, leaf.matrix);
    crown.setColorAt(i, leaf.color);
  });
  wood.computeBoundingSphere();
  crown.computeBoundingSphere();
  group.add(wood, crown);
  return group;
}
