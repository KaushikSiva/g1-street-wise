import * as THREE from 'three';

export const HIGH_ROAD_TANK_POSITION = [15.7229066952, -0.045, -235.347152289] as const;
export const HIGH_ROAD_TANK_ID = 'high-road-south-water-tank';
/** Reference-informed landmark assembly; no road edits or footprint replacements. */
export function placeHighRoadTank(asset: THREE.Object3D): THREE.Group {
  if (asset.parent) throw new Error('Tank asset must be detached before placement');
  const group = new THREE.Group();
  group.name = 'High Road south-side elevated tank · provisional';
  group.position.fromArray(HIGH_ROAD_TANK_POSITION);
  group.userData = {
    landmarkId: HIGH_ROAD_TANK_ID,
    district: 'high-road-tank',
    source: '2018 Google user panorama; 2026 Esri WV03 aerial roof correspondence',
    mappedFootprintReplacementIds: [],
    geometryStatus: 'Photo-informed inferred dimensions and six-column topology',
    positionStatus: 'Approximate aerial roof center used as base; parallax uncorrected',
    reportedAerialAccuracyMeters: 8.47,
    surveyed: false,
  };
  asset.traverse(object => {
    if (object instanceof THREE.Mesh || (object as THREE.Mesh).isMesh) {
      const mesh = object as THREE.Mesh;
      mesh.castShadow = mesh.receiveShadow = true;
    }
  });
  group.add(asset);
  return group;
}
