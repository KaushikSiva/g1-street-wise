import {LANDMARK_VIEWS} from './districts/landmark-views';
import {createFrontageBarrierSampler} from './districts/frontage-barriers';
import {buildRams13Frontage,sampleRamsGround,ramsFrontageBlocks} from './districts/rams-13-frontage';
import {createVasanthGroundHeightSampler} from './districts/vasanth-vihar';
import {createAvinashGroundHeightSampler} from './districts/avinash-ground';
import {buildAvinashYellowObject} from './districts/avinash-yellow-object';
import {createSuryaGroundHeightSampler} from './districts/surya-ground';
import {createPrashanthGroundHeightSampler} from './districts/prashanth-ground';
import { AlphaAwareGTAOPass } from "./alpha-aware-gtao";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { Sky } from "three/addons/objects/Sky.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { buildNeighborhood } from "./buildings";
import { buildRailway } from "./railway";
import { buildVegetation } from "./vegetation";
import { buildGroundDetail } from "./ground-detail";
import { buildStationDetail } from "./station-detail";
import { createNavigation } from "./navigation";
import { inferPlatformEdge } from "./platform-correction";
import { buildDistricts, DISTRICT_VIEWS, type DistrictId } from "./districts";
import { buildGovindamShell, GOVINDAM_WAY_ID, GOVINDAM_BAY_ASSET_PATH } from "./districts/govindam";
import { installGovindamWindow, GOVINDAM_WINDOW_ASSET_PATH } from "./districts/govindam-window";
import { createStreetNames } from "./districts/street-names";
import { createStreetLabels } from "./districts/street-labels";
import { placeHighRoadTank } from "./districts/high-road-tank";
import { centralAvenueFrame } from "./districts/central-avenue";
import { buildCentralAvenueCanopy } from "./districts/central-avenue-canopy";
import {placeCentralAvenueMotorcycle,CENTRAL_AVENUE_MOTORCYCLE_ASSET} from './districts/central-avenue-motorcycle';
import {placeCentralAvenueVan,CENTRAL_AVENUE_VAN_ASSET} from './districts/central-avenue-van';
import { installCentralAvenueFrontage } from "./districts/central-avenue-frontage";
import {prepareCentralDaylight} from './districts/central-avenue-lighting';
import {installAvinashVisibility} from './districts/avinash-visibility';
import {installEncaarpusOcclusion} from './districts/encaarpus-occlusion';
import {installEncaarpusCar} from './districts/encaarpus-entry';
import "./survey.css";

const assetPromises: Promise<unknown>[] = [];
const assetFailures: string[] = [];
function loadModel(path: string, place: (gltf: GLTF) => void) {
  assetPromises.push(
    new GLTFLoader()
      .loadAsync(path)
      .then(place)
      .catch((error) => {
        assetFailures.push(path);
        console.error("Asset failed", path, error);
      }),
  );
}

type Way = {
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
};
const origin = { lat: 13.0516624, lon: 80.2306892 };
const eastScale = 111320 * Math.cos((origin.lat * Math.PI) / 180);
const local = (lat: number, lon: number) =>
  new THREE.Vector3(
    (lon - origin.lon) * eastScale,
    0,
    (origin.lat - lat) * 111320,
  );
document.querySelector("#app")!.innerHTML =
  `<canvas id="scene" aria-label="Three dimensional reconstruction of Kodambakkam"></canvas>
<header class="survey-head"><div><span class="kicker">CHENNAI · FIELD STUDY 001</span><h1>Kodambakkam<span>கோடம்பாக்கம்</span></h1><label class="district-picker"><span>Explore</span><select id="district" aria-label="Explore Kodambakkam"><option value="central-avenue">Central Avenue Road</option><option value="station">Railway station</option><option value="high-road">High Road / flyover</option><option value="united-india-colony">United India Colony</option><option value="govindam">Govindam · 4th Cross St</option></select></label><label class="district-picker landmark-picker" id="landmark-picker" hidden><span>Building</span><select id="landmark" aria-label="Explore modeled buildings" disabled><option value="">Street overview</option>${LANDMARK_VIEWS.map(v=>`<option value="${v.key}">${v.label}</option>`).join('')}</select></label><span id="landmark-status" class="visually-hidden" role="status"></span></div><button id="evidence-button" aria-expanded="false">About this reconstruction ↗</button></header>
<div id="survey-loading" role="status">Loading neighborhood geometry…</div>
<div class="view-switch" role="group" aria-label="Camera view"><button id="street" class="active">Street</button><button id="aerial">Aerial</button><button id="photo">Station reference</button></div>
<aside id="evidence" hidden><button id="close-evidence" aria-label="Close details">×</button><p class="kicker">GEOGRAPHIC EVIDENCE</p><h2>Kodambakkam reconstruction</h2><p>Road centerlines and mapped building footprints follow OpenStreetMap coordinates at meter scale. Missing buildings, heights, facades, trees and street furniture are not yet surveyed.</p><p id="coverage">Loading coverage…</p><p>The northern station platform edge includes an inferred correction for an inconsistent mapped boarding gap. Its exact boundary is unverified. <a href="?mappedOnly=1">Inspect the original mapped edge ↗</a></p><p>Central Avenue Road is the current focus. Its centerline follows the stored map; road width, drainage, boundary walls, wiring and tree positions are visual hypotheses. Street-level references and individual building facades remain incomplete. The Explore menu also opens the station, High Road flyover and United India Colony. The flyover follows its mapped centerline; its heights, ramps and construction are inferred. Circular Park follows an additional mapped outline; its interior layout and landscape finish remain unverified. Govindam on 4th Cross Street includes a photo-informed entrance within its mapped footprint. Its placement and dimensions are inferred; the remaining facade and individual lots are unverified.</p><a href="/reference/central-avenue-study.json" target="_blank" rel="noopener">Central Avenue evidence ↗</a><a href="/assets/govindam-window.attribution.json" target="_blank" rel="noopener">Govindam window evidence ↗</a><a href="/assets/govindam-bay.attribution.json" target="_blank" rel="noopener">Govindam entrance evidence ↗</a><a href="/reference/united-india-park-osm.json" target="_blank" rel="noopener">Circular Park map source ↗</a><p>This is an early reconstruction, not a photoreal or complete replica. The reference camera is fitted to visible station-photo landmarks near its published coordinate; camera height, lens and object dimensions remain estimates.</p><figure><img src="/reference/station-2018.jpg" alt="Real Kodambakkam station, photographed in November 2018" loading="lazy" style="width:100%;height:auto"/><figcaption>Reference photograph · November 2018</figcaption></figure><p>Station photograph and sign texture: <a href="https://commons.wikimedia.org/wiki/File:Kodambakkam_Railway_Station.jpg" target="_blank" rel="noopener">Gowtham Sampath / Wikimedia Commons</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>. Sign texture cropped and rectified; derivative model uses the same license.</p><figure><img src="/reference/kodambakkam-aerial.jpg" alt="Sentinel-2 satellite reference of Kodambakkam" loading="lazy" style="width:100%;height:auto"/><figcaption>Satellite reference · 15 July 2026 · 10 m pixels, insufficient for individual lots.</figcaption></figure><p>Contains modified Copernicus Sentinel data 2026.</p><p>Additional historical references: <a href="/reference/kodambakkam-view-historic.jpg" target="_blank" rel="noopener">Kodambakkam rooftops and canopy</a> (L.vivian.richard) and <a href="/reference/united-india-colony-historic.jpg" target="_blank" rel="noopener">United India Colony</a> (Liliandavid), public domain. Their camera locations remain unverified.</p><a href="/reference/kodambakkam-aerial.json" target="_blank" rel="noopener">Satellite provenance ↗</a><p>Station foliage uses custom Blender geometry with inferred species, dimensions and locations. Broadleaf textures: Rob Tuytel and Rico Cilliers / Poly Haven, CC0.</p><a href="/assets/station-broadleaf.attribution.json" target="_blank" rel="noopener">Broadleaf asset sources ↗</a><a href="/assets/station-palm.attribution.json" target="_blank" rel="noopener">Palm asset sources ↗</a><a href="/assets/textures/manifest.json" target="_blank" rel="noopener">Material and lighting sources ↗</a><a href="/reference/manifest.json" target="_blank" rel="noopener">Source manifest ↗</a><a href="https://www.google.com/maps/@13.0516624,80.2306892,17z" target="_blank" rel="noopener">Open the real location in Google Maps ↗</a><a href="https://www.google.com/maps/@?api=1&map_action=pano&pano=CIHM0ogKEICAgICEz6bxhwE&heading=90&pitch=0&fov=80" target="_blank" rel="noopener">View the flyover panorama · April 2018 ↗</a><a href="?legacy=1">Original robot sandbox ↗</a></aside>
<footer class="survey-foot"><div><span id="position">13.051662° N · 80.230689° E</span><small id="camera-hint">Drag to look · WASD to walk · Shift to move faster</small></div><button id="reset">Reset view</button></footer>
<div class="walk-pad" aria-label="Touch walking controls"><button data-move="KeyW" aria-label="Walk forward">↑</button><button data-move="KeyA" aria-label="Walk left">←</button><button data-move="KeyS" aria-label="Walk backward">↓</button><button data-move="KeyD" aria-label="Walk right">→</button></div><div class="data-credit">Map geometry © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> · inferred details</div>`;
const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
  preserveDrawingBuffer: true,
});
renderer.info.autoReset = false;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#b9c8c9");
scene.fog = new THREE.FogExp2("#c3ccc9", 0.0017);
const camera = new THREE.PerspectiveCamera(
  58,
  innerWidth / innerHeight,
  0.1,
  2400,
);
const composer = new EffectComposer(renderer);
const OcclusionPass = new URLSearchParams(location.search).has("opaqueAO")
  ? GTAOPass
  : AlphaAwareGTAOPass;
const ao = new OcclusionPass(scene, camera, innerWidth, innerHeight);
ao.updateGtaoMaterial({
  radius: 0.7,
  // Meter-space depth rejection: allow nearby wheel/post surfaces to occlude
  // the platform without treating the distant train as a solid screen.
  thickness: 0.45,
  distanceExponent: 2,
  distanceFallOff: 1,
  samples: 12,
});
ao.updatePdMaterial({ radius: 3, samples: 8 });
ao.blendIntensity = 0.55;
composer.addPass(new RenderPass(scene, camera));
composer.addPass(ao);
composer.addPass(new OutputPass());
composer.addPass(new SMAAPass());
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = !matchMedia("(prefers-reduced-motion: reduce)")
  .matches;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.495;
const sky = new Sky();
sky.scale.setScalar(10000);
scene.add(sky);
const u = sky.material.uniforms;
u.turbidity.value = 5;
u.rayleigh.value = 1.6;
u.mieCoefficient.value = 0.007;
u.mieDirectionalG.value = 0.8;
const originalSunDirection = new THREE.Vector3(160, 240, -130).normalize();
const sunDirection=originalSunDirection.clone();
u.sunPosition.value.copy(sunDirection);
const hemisphere=new THREE.HemisphereLight("#cfdeea", "#74634b", 2);scene.add(hemisphere);
const sun = new THREE.DirectionalLight("#fff1d8", 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {
  left: -64,
  right: 64,
  top: 64,
  bottom: -64,
  far: 650,
});
// 128 m / 2048 = 6.25 cm texels at walking height. Preserve the previous
// ~14 cm filter footprint while reducing offsets that detached small contacts.
sun.shadow.radius = 2.2;
sun.shadow.normalBias = 0.02;
sun.shadow.bias = -0.00002;
scene.add(sun, sun.target);
const pmrem = new THREE.PMREMGenerator(renderer);
const environmentScene = new THREE.Scene();
environmentScene.add(sky.clone());
scene.environment = pmrem.fromScene(environmentScene, 0.08, 0.1, 20000).texture;
pmrem.dispose();
scene.environmentIntensity = 0.025;
const fallbackEnvironment=scene.environment;
let overcastTexture:THREE.Texture|null=null;
let centralDaylight:ReturnType<typeof prepareCentralDaylight>|null=null;
let lightingChanged=true,lightingMode='fallback';
function applyDistrictLighting(){
  const useDaylight=selectedDistrict==='central-avenue' && centralDaylight && new URLSearchParams(location.search).get('centralLighting')!=='overcast';
  if(useDaylight){
    scene.environment=centralDaylight!.environment;scene.background=centralDaylight!.background;
    scene.environmentRotation.set(0,centralDaylight!.rotation,0);scene.backgroundRotation.copy(scene.environmentRotation);
    scene.environmentIntensity=1;scene.backgroundIntensity=1;sky.visible=false;
    sunDirection.copy(centralDaylight!.direction);sun.intensity=centralDaylight!.intensity;sun.color.copy(centralDaylight!.color);
    hemisphere.intensity=0;scene.fog=new THREE.FogExp2('#c8d6dc',.0012);lightingMode='central-daylight';
  }else if(overcastTexture){
    scene.environment=overcastTexture;scene.background=overcastTexture;
    scene.environmentRotation.set(0,0,0);scene.backgroundRotation.set(0,0,0);
    scene.environmentIntensity=.65;scene.backgroundIntensity=1.3;sky.visible=false;
    sunDirection.copy(originalSunDirection);sun.intensity=.55;sun.color.set('#fff1d8');hemisphere.intensity=.45;
    scene.fog=new THREE.FogExp2('#c5cecf',.0012);lightingMode='overcast';
  }
  lightingChanged=true;renderer.shadowMap.needsUpdate=true;
}
assetPromises.push(
  new RGBELoader()
    .loadAsync("/assets/textures/overcast.hdr")
    .then((texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      fallbackEnvironment?.dispose();overcastTexture=texture;applyDistrictLighting();
    })
    .catch((error) => {
      assetFailures.push("overcast.hdr");
      console.error(error);
    }),
);
assetPromises.push(new RGBELoader().loadAsync('/assets/textures/central-daylight.hdr').then(texture=>{
  texture.mapping=THREE.EquirectangularReflectionMapping;centralDaylight=prepareCentralDaylight(texture,renderer);applyDistrictLighting();
}).catch(error=>{assetFailures.push('central-daylight.hdr');console.error(error);}));
function grain(base: string, repeat: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  let seed = 733;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 65000; i++) {
    const v = Math.floor(random() * 150);
    ctx.fillStyle = `rgba(${v},${v},${v},${random() * 0.24})`;
    ctx.fillRect(
      random() * 512,
      random() * 512,
      random() * 2 + 0.3,
      random() * 2 + 0.3,
    );
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1800, 1800),
  new THREE.MeshStandardMaterial({ map: grain("#b3aa92", 130), roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.045;
ground.receiveShadow = true;
scene.add(ground);
const asphalt = new THREE.MeshStandardMaterial({
  map: grain("#64625d", 1),
  roughness: 0.96,
});
const concrete = new THREE.MeshStandardMaterial({
  map: grain("#aaa595", 1),
  roughness: 0.93,
});
const textureLoader = new THREE.TextureLoader();
function applyPbr(material: THREE.MeshStandardMaterial, asset: string) {
  const texture = (suffix: string, color = false) => {
    const t = textureLoader.load(
      "/assets/textures/" + asset + "_" + suffix + ".jpg",
    );
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  material.map = texture("Diffuse", true);
  material.normalMap = texture("nor_gl");
  material.normalScale.set(0.35, 0.35);
  material.roughnessMap = texture("Rough");
  material.needsUpdate = true;
}
applyPbr(asphalt, "asphalt_02");
applyPbr(concrete, "concrete_floor_worn_001");
const railMat = new THREE.MeshStandardMaterial({
  color: "#676864",
  roughness: 0.6,
  metalness: 0.7,
});
function ribbon(
  points: THREE.Vector3[],
  width: number,
  material: THREE.Material,
  y: number,
) {
  const vertices: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  let distance = 0;
  points.forEach((p, i) => {
    if (i) distance += p.distanceTo(points[i - 1]);
    const d = points[Math.min(i + 1, points.length - 1)]
      .clone()
      .sub(points[Math.max(i - 1, 0)])
      .normalize();
    const nx = (-d.z * width) / 2,
      nz = (d.x * width) / 2;
    vertices.push(p.x + nx, y, p.z + nz, p.x - nx, y, p.z - nz);
    uvs.push(0, distance / 6, width / 6, distance / 6);
    if (i) {
      const k = i * 2;
      indices.push(k - 2, k, k - 1, k - 1, k, k + 1);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  scene.add(mesh);
}
const roads: { points: THREE.Vector3[]; width: number; custom: boolean }[] = [];
let navigation: ReturnType<typeof createNavigation> | undefined;
let streetNames: ReturnType<typeof createStreetNames> | undefined;
let streetLabels: ReturnType<typeof createStreetLabels> | undefined;
let streetLabelElevation: ((x:number,z:number,wayId:number)=>number) | undefined;
let lastStreetUiUpdate = -Infinity;
let districts: ReturnType<typeof buildDistricts> | undefined;
let selectedDistrict: DistrictId = "station";
let selectedLandmark='';
let landmarkBuildings:THREE.Group|undefined;
function landmarkFrontage(key:string){
  const spec=LANDMARK_VIEWS.find(v=>v.key===key);
  return spec&&landmarkBuildings?.children.find(g=>spec.frontageId?g.userData.frontageId===spec.frontageId:g.userData.wayId===spec.wayId);
}
function updateLandmarkPicker(){
  document.getElementById('landmark-picker')!.hidden=selectedDistrict!=='central-avenue';
  const picker=document.getElementById('landmark') as HTMLSelectElement;
  picker.disabled=!landmarkBuildings;picker.value=selectedLandmark;
}
function refreshPosition(){
  document.getElementById('position')!.textContent=`${(origin.lat-camera.position.z/111320).toFixed(6)}° N · ${(origin.lon+camera.position.x/eastScale).toFixed(6)}° E`;
}
function placeLandmarkCamera(){
  const spec=LANDMARK_VIEWS.find(v=>v.key===selectedLandmark),frontage=landmarkFrontage(selectedLandmark);
  if(!spec||!frontage)return false;
  scene.updateMatrixWorld(true);
  const eye=frontage.localToWorld(new THREE.Vector3(...spec.eye));
  const target=frontage.localToWorld(new THREE.Vector3(...spec.target));
  const ground=navigation?.heightAt(eye.x,eye.z,0)??0;
  eye.y+=ground;target.y+=ground;
  camera.position.copy(eye);controls.target.copy(eye).add(target.sub(eye).normalize().multiplyScalar(.5));
  return true;
}
function navigationUrl(mode:'push'|'replace'){
  const url=new URL(location.href);url.searchParams.set('district',selectedDistrict);
  if(selectedLandmark&&selectedDistrict==='central-avenue')url.searchParams.set('landmark',selectedLandmark);
  else url.searchParams.delete('landmark');
  if(url.href!==location.href)history[mode==='push'?'pushState':'replaceState'](null,'',url);
}
function setLandmark(key:string,historyMode:'push'|'replace'|null='push'){
  if(key&&!landmarkFrontage(key))return false;
  selectedDistrict='central-avenue';selectedLandmark=key;
  (document.getElementById('district') as HTMLSelectElement).value=selectedDistrict;
  setView('street');updateLandmarkPicker();
  document.getElementById('landmark-status')!.textContent=key?`${LANDMARK_VIEWS.find(v=>v.key===key)!.label}. Partial reconstruction.`:'Central Avenue street overview.';
  if(historyMode)navigationUrl(historyMode);return true;
}

function buildRoads(ways: Way[], replacedRoadIds: Set<number> = new Set()) {
  for (const way of ways) {
    if (!way.geometry || way.geometry.length < 2) continue;
    const t = way.tags || {};
    if (!t.highway && !t.railway) continue;
    const points = way.geometry.map((p) => local(p.lat, p.lon));
    if (t.railway === "rail") {
      ribbon(points, 3.2, concrete, 0.04);
      for (const side of [-1, 1]) {
        const offset = points.map((p, i) => {
          const d = points[Math.min(i + 1, points.length - 1)]
            .clone()
            .sub(points[Math.max(0, i - 1)])
            .normalize();
          return p
            .clone()
            .add(new THREE.Vector3(-d.z * 0.838 * side, 0, d.x * 0.838 * side));
        });
        ribbon(offset, 0.08, railMat, 0.13);
      }
      continue;
    }
    if (!t.highway) continue;
    const widths: Record<string, number> = {
      primary: 13,
      secondary: 10,
      tertiary: 8,
      residential: 5.5,
      service: 4,
      footway: 1.5,
      path: 1.2,
    };
    const width = parseFloat(t.width) || widths[t.highway] || 5;
    const custom = replacedRoadIds.has(way.id);
    roads.push({ points, width, custom });
    if (custom) continue;
    const elevation = t.bridge === "yes" ? 5 : 0;
    ribbon(points, width + 0.9, concrete, elevation + 0.018);
    ribbon(points, width, asphalt, elevation + 0.035);
  }
}
let view = "street";
let fittedPhotoPose = false;
function setView(next: string) {
  view = next;
  document.querySelector<HTMLElement>('.walk-pad')!.hidden = next === 'aerial';
  if (next === "photo") {
    selectedDistrict = "station";
    selectedLandmark = "";
    (document.getElementById("district") as HTMLSelectElement).value = selectedDistrict;
  }
  applyDistrictLighting();
  updateLandmarkPicker();
  // Canvas antialiasing does not cover the composer's offscreen scene buffers.
  // Resolve thin Central Avenue casements and AC wires before postprocessing.
  const samples=selectedDistrict==="central-avenue" && new URLSearchParams(location.search).get("centralMSAA")!=="0"
    ? Math.min(4,renderer.capabilities.maxSamples) : 0;
  for(const target of [composer.renderTarget1,composer.renderTarget2])if(target.samples!==samples){target.dispose();target.samples=samples;}
  fittedPhotoPose = next === "photo";
  camera.up.set(0, 1, 0);
  document
    .querySelectorAll(".view-switch button")
    .forEach((b) => b.classList.toggle("active", b.id === next));
  controls.maxPolarAngle = next === "aerial" ? Math.PI * 0.495 : Math.PI - 0.15;
  controls.minPolarAngle = next === "aerial" ? 0.1 : 0.15;
  controls.enablePan = next === "aerial";
  controls.enableZoom = next === "aerial";
  controls.minDistance = next === "aerial" ? 4 : 0.5;
  controls.maxDistance = next === "aerial" ? 800 : 0.5;
  if (next === "aerial") {
    camera.position.fromArray(DISTRICT_VIEWS[selectedDistrict].overview.position);
    controls.target.fromArray(DISTRICT_VIEWS[selectedDistrict].overview.target);
  } else if (next === "photo") {
    // Image-fitted estimate; see docs/station-alignment.md. This raised
    // photo viewpoint is separate from the normal walking eye height.
    camera.position.set(25.2, 3.28, -170.8);
    camera.up.set(0.022916, 0.996788, -0.076732).normalize();
    controls.target
      .copy(camera.position)
      .add(
        new THREE.Vector3(-0.454274, 0.078753, 0.887374).multiplyScalar(0.5),
      );
  } else if (selectedDistrict==='central-avenue' && selectedLandmark && placeLandmarkCamera()) {
    // The selected frontage remains the street/reset anchor after walking or orbiting.
  } else {
    const arrival = DISTRICT_VIEWS[selectedDistrict].street;
    camera.position.copy(local(arrival.lat, arrival.lon));
    const surface = selectedDistrict === "high-road"
      ? districts?.bridgeHeightAt(camera.position.x, camera.position.z) ?? 0
      : selectedDistrict === "central-avenue"
        ? districts?.centralAvenueHeightAt(camera.position.x, camera.position.z) ?? 0
        : navigation?.heightAt(camera.position.x, camera.position.z) ?? 0;
    camera.position.y = surface + 1.68;
    controls.target
      .copy(camera.position)
      .add(new THREE.Vector3().fromArray(arrival.forward).normalize().multiplyScalar(0.5));
  }
  controls.update();
  document.querySelector("#camera-hint")!.textContent =
    next === "aerial"
      ? "Drag to orbit · Scroll or pinch to zoom"
      : "Drag to look · WASD to walk · Shift to move faster";
  refreshPosition();
  streetNames?.update(camera.position);
  streetLabels?.invalidate();
}
function setDistrict(next: DistrictId) {
  if (!(next in DISTRICT_VIEWS)) return;
  selectedDistrict = next;
  selectedLandmark = "";
  (document.getElementById("district") as HTMLSelectElement).value = next;
  setView(next === "central-avenue" ? "street" : "aerial");
}
document.getElementById("district")!.addEventListener("change", (event) => {
  setDistrict((event.target as HTMLSelectElement).value as DistrictId);
  navigationUrl('push');
});
document.getElementById('landmark')!.addEventListener('change',event=>{
  if(!setLandmark((event.target as HTMLSelectElement).value))updateLandmarkPicker();
});
addEventListener('popstate',()=>{
  if(!landmarkBuildings)return;
  const params=new URLSearchParams(location.search),district=params.get('district');
  setDistrict(district&&district in DISTRICT_VIEWS?district as DistrictId:'central-avenue');
  if(selectedDistrict==='central-avenue')setLandmark(params.get('landmark')||'',null);
});
setView("photo");
for (const name of ["street", "aerial", "photo"])
  document.getElementById(name)!.addEventListener("click", () => {setView(name);navigationUrl('push');});
document
  .getElementById("reset")!
  .addEventListener("click", () => setView(view));
const evidence = document.getElementById("evidence")!,
  evidenceButton = document.getElementById("evidence-button")!;
evidenceButton.addEventListener("click", () => {
  evidence.hidden = !evidence.hidden;
  evidenceButton.setAttribute("aria-expanded", String(!evidence.hidden));
});
document.getElementById("close-evidence")!.addEventListener("click", () => {
  evidence.hidden = true;
  evidenceButton.setAttribute("aria-expanded", "false");
});
const pressed = new Set<string>();
addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement)?.closest("select,input,textarea")) return;
  if (
    [
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ShiftLeft",
    ].includes(e.code)
  ) {
    e.preventDefault();
    pressed.add(e.code);
  }
});
addEventListener("keyup", (e) => pressed.delete(e.code));
addEventListener("blur", () => pressed.clear());
for (const b of document.querySelectorAll<HTMLButtonElement>("[data-move]")) {
  b.addEventListener("pointerdown", (e) => {
    b.setPointerCapture(e.pointerId);
    pressed.add(b.dataset.move!);
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    b.addEventListener(event, () => pressed.delete(b.dataset.move!));
}
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});
const shadowAnchor = new THREE.Vector3(10000, 0, 10000);
let then = performance.now();
function animate(now: number) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - then) / 1000, 0.05);
  then = now;
  if (view !== "aerial" && pressed.size) {
    fittedPhotoPose = false;
    camera.up.set(0, 1, 0);
    const forward = controls.target.clone().sub(camera.position);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x),
      delta = new THREE.Vector3();
    if (pressed.has("KeyW") || pressed.has("ArrowUp")) delta.add(forward);
    if (pressed.has("KeyS") || pressed.has("ArrowDown")) delta.sub(forward);
    if (pressed.has("KeyD") || pressed.has("ArrowRight")) delta.add(right);
    if (pressed.has("KeyA") || pressed.has("ArrowLeft")) delta.sub(right);
    delta.normalize().multiplyScalar(dt * (pressed.has("ShiftLeft") ? 8 : 1.5));
    if (
      navigation?.canWalk(
        camera.position.x + delta.x,
        camera.position.z + delta.z,
        camera.position.y - 1.68,
        camera.position.x,
        camera.position.z,
      )
    ) {
      camera.position.add(delta);
      controls.target.add(delta);
    }
  }
  controls.update();
  if (view !== "aerial") {
    const offset =
      (fittedPhotoPose ? 2.23 : 1.68) +
      (navigation?.heightAt(camera.position.x, camera.position.z,
        camera.position.y - (fittedPhotoPose ? 2.23 : 1.68)) ??
        (view === "photo" ? 1.05 : 0)) -
      camera.position.y;
    camera.position.y += offset;
    controls.target.y += offset;
  }
  // The world is static. Reusing its shadow map avoids redrawing every building
  // again during both the color and ambient-occlusion passes on phones.
  // Close orbit views need detail-scale shadows, even though they use the
  // aerial controls. Quantize coverage to avoid reallocating it every frame.
  const shadowExtent = view === "aerial"
    ? THREE.MathUtils.clamp(Math.ceil((controls.getDistance() + 12) / 16) * 16, 32, 140)
    : 64;
  const closeShadows = shadowExtent <= 64;
  if (
    lightingChanged ||
    camera.position.distanceTo(shadowAnchor) > 4 ||
    sun.shadow.camera.right !== shadowExtent
  ) {
    Object.assign(sun.shadow.camera, {
      left: -shadowExtent,
      right: shadowExtent,
      top: shadowExtent,
      bottom: -shadowExtent,
    });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.radius = closeShadows ? 2.2 : 1;
    sun.shadow.normalBias = closeShadows ? 0.02 : 0.035;
    // Central daylight needs a larger depth offset to suppress grazing-angle paving acne.
    sun.shadow.bias = closeShadows ? (selectedDistrict === "central-avenue" ? -0.0002 : -0.00002) : -0.0001;
    shadowAnchor.copy(camera.position);
    sun.target.position.set(camera.position.x, 0, camera.position.z);
    sun.position.copy(sun.target.position).addScaledVector(sunDirection, 240);
    lightingChanged=false;
    renderer.shadowMap.needsUpdate = true;
  }
  renderer.info.reset();
  composer.render();
  const streetUiTime = performance.now();
  if (streetNames && streetLabels && streetUiTime-lastStreetUiUpdate >= 120) {
    lastStreetUiUpdate = streetUiTime;
    streetNames.update(camera.position);
    refreshPosition();
    const exclusions = [...document.querySelectorAll<HTMLElement>('.survey-head > div, .survey-head > button, .view-switch, .survey-foot > div, .survey-foot > button, .walk-pad, #evidence:not([hidden]), .street-name-ui[open] .street-name-panel')]
      .filter(element=>element.getClientRects().length>0)
      .map(element=>{const b=element.getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom};});
    streetLabels.update(camera,{width:innerWidth,height:innerHeight,visible:view!=='photo',elevationAt:streetLabelElevation,occluders:[scene],exclusions});
  }
}
requestAnimationFrame(animate);
async function load() {
  const response = await fetch("/reference/kodambakkam-osm.json");
  if (!response.ok) throw new Error("Map dataset could not be loaded");
  const rawData = await response.json();
  const inferred = inferPlatformEdge(rawData);
  const mappedOnly = new URLSearchParams(location.search).has("mappedOnly");
  const data = mappedOnly ? rawData : inferred.data;
  districts = buildDistricts(data);
  const installedObstacles:((x:number,z:number)=>boolean)[]=[];
  const avinashGroundHeightAt=createAvinashGroundHeightSampler(data);
  const centralObjectSupport=(x:number,z:number)=>avinashGroundHeightAt(x,z)??districts!.centralAvenueHeightAt(x,z);
  const elevatedSurfaces=[districts.bridgeHeightAt,districts.centralAvenueHeightAt,createPrashanthGroundHeightSampler(data),createSuryaGroundHeightSampler(data),avinashGroundHeightAt,createVasanthGroundHeightSampler(data)];
  navigation = createNavigation(data,elevatedSurfaces,installedObstacles);
  scene.add(...districts.groups);
  const centralFrame=centralAvenueFrame(data);
  if (centralFrame && districts.centralAvenue.children.length) {
    const avenue=districts.centralAvenue;
    loadModel(CENTRAL_AVENUE_VAN_ASSET,gltf=>{
      const van=placeCentralAvenueVan(gltf.scene,centralFrame,centralObjectSupport);
      avenue.add(van.group);installedObstacles.push(van.blocks);renderer.shadowMap.needsUpdate=true;
    });
    loadModel(CENTRAL_AVENUE_MOTORCYCLE_ASSET,gltf=>{
      const motorcycle=placeCentralAvenueMotorcycle(gltf.scene,data,centralObjectSupport);
      if(motorcycle){avenue.add(motorcycle.group);installedObstacles.push(motorcycle.blocks);renderer.shadowMap.needsUpdate=true;}
    });
    loadModel("/assets/station-broadleaf.glb",gltf=>{
      const trees=buildCentralAvenueCanopy(gltf.scene,centralFrame);
      avenue.add(trees);avenue.userData.canopyLoaded=true;renderer.shadowMap.needsUpdate=true;
    });
  }
  const wayTags = new Map<number, Record<string,string>>(rawData.elements.filter((e:any)=>e.type==='way').map((e:any)=>[e.id,e.tags||{}]));
  streetLabelElevation = (x,z,wayId) => districts?.replacedRoadIds.has(wayId)
    ? districts.bridgeHeightAt(x,z) ?? 0
    : wayTags.get(wayId)?.bridge === 'yes' ? 5.035 : .035;
  streetNames = createStreetNames(rawData, local);
  streetNames.element.addEventListener("toggle",()=>{if(streetNames?.element.open)pressed.clear();});
  document.querySelector('.survey-head > div')!.append(streetNames.element);
  streetLabels = createStreetLabels(streetNames.index);
  document.querySelector('#app')!.append(streetLabels.element);
  let buildings: THREE.Group;
  let govindam: { loaded: boolean; study?: Record<string, unknown>; window?: Record<string, unknown> } = { loaded: false };
  try {
    // Keep the complete generic shell unless both download and surgical replacement succeed.
    const gltf = await new GLTFLoader().loadAsync(GOVINDAM_BAY_ASSET_PATH);
    const shell = buildGovindamShell(data);
    const study = shell.userData.govindamStudy;
    gltf.scene.name = "Govindam central bay · photo-informed, inferred dimensions and pose";
    gltf.scene.position.fromArray(study.pose);
    gltf.scene.rotation.y = study.yawRadians;
    gltf.scene.traverse(object => {
      if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true;
    });
    buildings = buildNeighborhood({...data, elements: data.elements.filter((e: any) => e.type !== "way" || e.id !== GOVINDAM_WAY_ID)});
    const rest = buildings.userData;
    const combined = {...rest};
    for (const key of ["buildingCount", "knownHeights", "inferredHeights", "rejected", "detailCount"]) combined[key] = rest[key] + shell.userData[key];
    combined.records = [...rest.records, ...shell.userData.records];
    combined.skippedRoofWayIds = [...rest.skippedRoofWayIds, ...shell.userData.skippedRoofWayIds];
    // Root owns aggregate coverage; child metadata avoids duplicate record enumeration.
    shell.userData = {govindamStudy: study};
    buildings.userData = combined;
    buildings.add(shell, gltf.scene);
    govindam = {loaded: true, study};
    loadModel(GOVINDAM_WINDOW_ASSET_PATH, windowAsset => {
      govindam.window = installGovindamWindow(shell, gltf.scene, windowAsset.scene);
      renderer.shadowMap.needsUpdate = true;
    });
    loadModel("/assets/govindam-hardware.glb", hardware => {
      hardware.scene.name = "Govindam entrance hardware · observed details, inferred routing";
      hardware.scene.traverse(object => {
        if (object instanceof THREE.Mesh) object.castShadow = object.receiveShadow = true;
      });
      // Geometry uses the existing bay's local coordinates; inherit its complete pose.
      gltf.scene.add(hardware.scene);
    });
  } catch (error) {
    console.warn("Govindam frontage unavailable; retaining mapped building", error);
    buildings = buildNeighborhood(data);
  }
  try { installCentralAvenueFrontage(buildings,data); }
  catch(error) { console.warn("Central Avenue frontage unavailable; retaining mapped shell",error); }
  const ramsFrontage=buildRams13Frontage();buildings.add(ramsFrontage);
  buildings.userData.rams13Frontage=ramsFrontage.userData;
  elevatedSurfaces.push(sampleRamsGround);installedObstacles.push(ramsFrontageBlocks);
  scene.add(buildings);
  for(const frontage of buildings.children){
    if(frontage instanceof THREE.Group && frontage.userData.barriers)installedObstacles.push(createFrontageBarrierSampler(frontage,frontage.userData.barriers));
  }
  const avinashFront=buildings.children.find(g=>g.userData.wayId===354839974);
  if(avinashFront){const yellow=buildAvinashYellowObject(avinashFront,centralObjectSupport);districts.centralAvenue.add(yellow.group);elevatedSurfaces.push(yellow.heightAt);}
  assetPromises.push(installAvinashVisibility(buildings).catch(error=>{assetFailures.push('avinash-visibility');console.error(error);}));
  assetPromises.push(installEncaarpusCar(buildings).then(()=>installEncaarpusOcclusion(buildings)).catch(error=>{assetFailures.push('encaarpus-visibility');console.error(error);}));
  loadModel("/assets/high-road-tank.glb", gltf => scene.add(placeHighRoadTank(gltf.scene)));
  buildRoads(data.elements, districts.replacedRoadIds);
  document.getElementById("coverage")!.textContent =
    `${roads.length} mapped road ways. Facade details and untagged heights are inferred. Ground materials and road widths are provisional.`;
  scene.add(buildRailway(data));
  scene.add(buildGroundDetail(data));
  scene.add(buildStationDetail());
  loadModel("/assets/station-lamp.glb", (gltf) => {
    gltf.scene.name = "Foreground station lamp · Blender, inferred construction and pose";
    gltf.scene.position.set(20.846, 1.05, -165.497);
    gltf.scene.rotation.y = -0.43195;
    gltf.scene.scale.set(1.039, 0.76407, 1);
    gltf.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    scene.add(gltf.scene);
  });
  loadModel("/assets/station-mast.glb", (gltf) => {
    gltf.scene.name = "Foreground station mast · Blender, inferred construction";
    // Rotate around the image-fitted near upright, preserving that anchor.
    const yaw = -Math.PI / 4;
    gltf.scene.rotation.y = yaw;
    gltf.scene.position.set(
      21.4976 - 0.45 * Math.cos(yaw),
      1.05,
      -168.2354 + 0.45 * Math.sin(yaw),
    );
    gltf.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    scene.add(gltf.scene);
  });
  scene.add(
    buildVegetation(data, [
      { x: 64, z: -150, height: 12, seed: 17 },
      { x: 67, z: -174, height: 10, seed: 23 },
      { x: 70, z: -205, height: 13, seed: 41 },
      { x: 75, z: -232, height: 11, seed: 52 },
      // The old illustrative tree at (81,-268) intersected the flyover deck.
      // Its existence/location was never mapped; omit that unsupported obstacle.
      { x: 86, z: -296, height: 9, seed: 84 },
      { x: 59, z: -120, height: 11, seed: 91 },
      { x: 58, z: -92, height: 10, seed: 107 },
    ]),
  );
  loadModel("/assets/kodambakkam-station-sign.glb", (gltf) => {
    gltf.scene.position.set(23.730001, 1.05, -165.727036);
    gltf.scene.rotation.y = 2.7910495;
    gltf.scene.scale.y = 1.011205855;
    gltf.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    gltf.scene.name =
      "Station nameboard · photo-derived surface, inferred position and size";
    scene.add(gltf.scene);
  });
  loadModel("/assets/station-luggage-trolley.glb", (gltf) => {
    // Revision 2 separates the observed rear rack from the main frame. The
    // inferred pose preserves platform contact and >25 mm sign clearance.
    gltf.scene.position.set(22.781241, 1.05, -166.937995);
    gltf.scene.rotation.y = 1.3351084071;
    gltf.scene.name =
      "Luggage trolley · image-fitted pose, inferred dimensions";
    gltf.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    scene.add(gltf.scene);
  });
  // Photo-informed foreground bay variant and longitudinal phase. Rail contact,
  // track direction and nominal spacing are retained; this is not a train survey.
  const genericTrain = new URLSearchParams(location.search).has("genericTrain");
  const trainStart = genericTrain ? -162 : -175;
  function addCoach(gltf: GLTF, i: number, foreground = false) {
      const z = trainStart + i * 22;
      const coach = gltf.scene.clone();
      coach.name = foreground
        ? "Foreground EMU · inferred photo bay arrangement and position"
        : "EMU coach · generic inferred arrangement";
      coach.position.set(14.47 + (-150 - z) * 0.209, 0.37, z);
      coach.rotation.y = -0.206;
      coach.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      scene.add(coach);
  }
  loadModel("/assets/chennai-emu-coach.glb", (gltf) => {
    for (let i = genericTrain ? 0 : 1; i < 4; i++) {
      addCoach(gltf, i);
    }
  });
  if (!genericTrain) {
    loadModel("/assets/chennai-emu-foreground.glb", (gltf) => addCoach(gltf, 0, true));
  }
  const legacyFoliage = new URLSearchParams(location.search).has("legacyFoliage");
  if (legacyFoliage) {
    scene.add(buildVegetation(data, [
      { x: 0, z: -165, height: 14, crownDiameter: 13, seed: 112 },
      { x: -4, z: -145, height: 13, crownDiameter: 12, seed: 113 },
      { x: -8, z: -126, height: 12, crownDiameter: 10, seed: 114 },
      { x: 4, z: -190, height: 14, crownDiameter: 13, seed: 117 },
    ]));
  } else {
    // Image-informed hypotheses. Occluded trunks, species and dimensions are
    // not surveyed; neither tree represents an identified local specimen.
    for (const tree of [
      { file: "station-palm", name: "Station palm", x: 6.16719, z: -155.38803 },
      { file: "station-broadleaf", name: "Station broadleaf", x: 4.83580, z: -161.06544 },
    ]) {
      loadModel("/assets/" + tree.file + ".glb", (gltf) => {
        gltf.scene.name = tree.name + " · Blender, inferred location and species";
        gltf.scene.position.set(tree.x, 0, tree.z);
        gltf.scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });
        scene.add(gltf.scene);
      });
    }
  }
  loadModel("/assets/kodambakkam-telecom-pole.glb", (gltf) => {
    for (const road of roads.filter(road => !road.custom).slice(0, 16)) {
      const p = road.points[Math.floor(road.points.length / 2)];
      const pole = gltf.scene.clone();
      pole.position.copy(p).add(new THREE.Vector3(road.width / 2 + 0.8, 0, 0));
      pole.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      scene.add(pole);
    }
  });
  await Promise.all(assetPromises);
  renderer.shadowMap.needsUpdate = true;
  document.getElementById("survey-loading")!.hidden =
    assetFailures.length === 0;
  if (assetFailures.length)
    document.getElementById("survey-loading")!.textContent =
      "Some assets could not load. Reload to retry.";
  (window as unknown as { survey: unknown }).survey = {
    scene,
    camera,
    renderer,
    get renderQuality(){return {sceneSamples:composer.readBuffer.samples,maxSamples:renderer.capabilities.maxSamples};},
    get lighting(){return {mode:lightingMode,source:centralDaylight?.evidence,sunDirection:sunDirection.toArray(),sunIntensity:sun.intensity,hemisphereIntensity:hemisphere.intensity,environmentIntensity:scene.environmentIntensity,backgroundIntensity:scene.backgroundIntensity,rotation:scene.environmentRotation.toArray(),exposure:renderer.toneMappingExposure};},
    controls,
    setView,
    setDistrict,
    setLandmark,
    get selectedLandmark(){return selectedLandmark;},
    districts: districts.groups.map(group => group.userData),
    coverage: buildings.userData,
    govindam,
    roads: roads.length,
    streetNames,
    streetLabels,
    assetFailures,
    navigation,
    platformCorrection: mappedOnly ? { applied: false } : inferred.correction,
  };
  const requestedDistrict = new URLSearchParams(location.search).get("district");
  if (requestedDistrict && requestedDistrict in DISTRICT_VIEWS) setDistrict(requestedDistrict as DistrictId);
  else setDistrict("central-avenue");
  landmarkBuildings=buildings;
  const picker=document.getElementById('landmark') as HTMLSelectElement;
  for(const option of picker.options)if(option.value)option.disabled=!landmarkFrontage(option.value);
  const landmark=new URLSearchParams(location.search).get('landmark');
  if(selectedDistrict==='central-avenue' && landmark)setLandmark(landmark,null);
  updateLandmarkPicker();
  navigationUrl('replace');


}
load().catch((error) => {
  document.getElementById("survey-loading")!.textContent =
    `${error.message}. Reload to retry.`;
  console.error(error);
});
