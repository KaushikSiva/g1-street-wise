import * as maplibregl from 'maplibre-gl';
import type { LngLatLike, Map as MapLibreMap, Marker } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { RobotRenderer, type MotionMode } from './robot';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const METERS_PER_LATITUDE_DEGREE = 111_320;

maplibregl.setWorkerUrl(maplibreWorkerUrl);

type DestinationName = 'kodambakkam' | 'marina' | 'tnagar' | 'besantnagar' | 'guindy';

interface Destination {
  name: string;
  coordinate: [number, number];
  bearing: number;
}

interface Vehicle {
  id: string;
  coordinate: [number, number];
  bearing: number;
  color: string;
  marker?: Marker;
}

interface Token {
  id: string;
  coordinate: [number, number];
  marker?: Marker;
  collected: boolean;
}

const DESTINATIONS: Record<DestinationName, Destination> = {
  kodambakkam: { name: 'KODAMBAKKAM', coordinate: [80.2306892, 13.0516624], bearing: 72 },
  marina: { name: 'MARINA BEACH', coordinate: [80.2833328, 13.0533969], bearing: 12 },
  tnagar: { name: 'T. NAGAR', coordinate: [80.231836, 13.0378289], bearing: 118 },
  besantnagar: { name: 'BESANT NAGAR', coordinate: [80.2682259, 12.9996907], bearing: 32 },
  guindy: { name: 'GUINDY / KATHIPARA', coordinate: [80.2038388, 13.0076902], bearing: 220 },
};

const VEHICLES: Vehicle[] = [
  { id: 'saffron', coordinate: [80.2309, 13.05152], bearing: 70, color: '#f0a83b' },
  { id: 'teal', coordinate: [80.23042, 13.05184], bearing: 252, color: '#25b9ad' },
  { id: 'indigo', coordinate: [80.2311, 13.05202], bearing: 112, color: '#566de8' },
  { id: 'ivory', coordinate: [80.23212, 13.03792], bearing: 92, color: '#e8ddc4' },
  { id: 'coral', coordinate: [80.28298, 13.0536], bearing: 8, color: '#e86555' },
  { id: 'lime', coordinate: [80.20364, 13.00788], bearing: 222, color: '#9bbf45' },
];

const TOKENS: Token[] = [
  { id: 't1', coordinate: [80.23031, 13.05143], collected: false },
  { id: 't2', coordinate: [80.23104, 13.05191], collected: false },
  { id: 't3', coordinate: [80.23073, 13.05231], collected: false },
  { id: 't4', coordinate: [80.23216, 13.03754], collected: false },
  { id: 't5', coordinate: [80.28318, 13.05308], collected: false },
  { id: 't6', coordinate: [80.26801, 12.99937], collected: false },
];

const DISTRICTS = [
  { name: 'KODAMBAKKAM', coordinate: [80.23069, 13.05166] as [number, number] },
  { name: 'VADAPALANI', coordinate: [80.2121, 13.0524] as [number, number] },
  { name: 'T. NAGAR', coordinate: [80.23184, 13.03783] as [number, number] },
  { name: 'NUNGAMBAKKAM', coordinate: [80.2405, 13.0604] as [number, number] },
  { name: 'MARINA BEACH', coordinate: [80.28333, 13.0534] as [number, number] },
  { name: 'MYLAPORE', coordinate: [80.2687, 13.0334] as [number, number] },
  { name: 'BESANT NAGAR', coordinate: [80.26823, 12.99969] as [number, number] },
  { name: 'GUINDY', coordinate: [80.20384, 13.00769] as [number, number] },
];

function element<T extends HTMLElement>(selector: string) {
  const value = document.querySelector<T>(selector);
  if (!value) throw new Error(`Missing UI element: ${selector}`);
  return value;
}

function haversineMeters(a: [number, number], b: [number, number]) {
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLng = (b[0] - a[0]) * toRad;
  const lat1 = a[1] * toRad;
  const lat2 = b[1] * toRad;
  const chord = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}

function moveCoordinate(coordinate: [number, number], bearing: number, meters: number): [number, number] {
  const radians = bearing * Math.PI / 180;
  const north = Math.cos(radians) * meters;
  const east = Math.sin(radians) * meters;
  const latitude = coordinate[1] + north / METERS_PER_LATITUDE_DEGREE;
  const longitude = coordinate[0] + east / (METERS_PER_LATITUDE_DEGREE * Math.cos(coordinate[1] * Math.PI / 180));
  return [longitude, latitude];
}

function expLerp(current: number, target: number, speed: number, delta: number) {
  return current + (target - current) * (1 - Math.exp(-speed * delta));
}

export class ChennaiGame {
  private readonly map: MapLibreMap;
  private minimap?: MapLibreMap;
  private readonly robot: RobotRenderer;
  private readonly keys = new Set<string>();
  private readonly vehicles = VEHICLES.map((vehicle) => ({ ...vehicle }));
  private readonly tokens = TOKENS.map((token) => ({ ...token }));
  private destination: Destination = DESTINATIONS.kodambakkam;
  private coordinate: [number, number] = [...DESTINATIONS.kodambakkam.coordinate];
  private bearing = DESTINATIONS.kodambakkam.bearing;
  private pitch = 67;
  private speed = 0;
  private altitude = 8;
  private jumpHeight = 0;
  private verticalVelocity = 0;
  private mode: MotionMode = 'walk';
  private activeVehicle?: Vehicle;
  private cameraWide = false;
  private mapReady = false;
  private firstFrameReady = false;
  private lastTime = performance.now();
  private interfaceClock = 0;
  private nearestVehicle?: { vehicle: Vehicle; distance: number };
  private tokensCollected = 0;
  private battery = 100;
  private climbProbeClock = 0;
  private buildingAhead = false;
  private cityDataReady = false;
  private toastTimer?: number;

  private readonly ui = {
    loading: element<HTMLElement>('#loading'),
    loadProgress: element<HTMLElement>('#load-progress'),
    loadStatus: element<HTMLElement>('#load-status'),
    district: element<HTMLElement>('#district-name'),
    mode: element<HTMLElement>('#mode-label'),
    speed: element<HTMLElement>('#speed-readout'),
    missionCopy: element<HTMLElement>('#mission-copy'),
    missionDistance: element<HTMLElement>('#mission-distance'),
    missionIndex: element<HTMLElement>('.mission-index'),
    interaction: element<HTMLElement>('#interaction'),
    interactionCopy: element<HTMLElement>('#interaction-copy'),
    coords: element<HTMLElement>('#coords'),
    radarArrow: element<HTMLElement>('#radar-arrow'),
    altitude: element<HTMLElement>('#altitude-readout'),
    battery: element<HTMLElement>('#battery-fill'),
    coinCount: element<HTMLElement>('#coin-count'),
    menu: element<HTMLDialogElement>('#city-menu'),
    toast: element<HTMLElement>('#toast'),
    cameraLink: element<HTMLButtonElement>('#camera-link'),
    meshSource: element<HTMLElement>('#mesh-source'),
  };

  constructor() {
    this.robot = new RobotRenderer(element<HTMLCanvasElement>('#character-layer'));
    this.map = new maplibregl.Map({
      container: 'world',
      style: STYLE_URL,
      center: this.coordinate as LngLatLike,
      zoom: 17.2,
      pitch: this.pitch,
      bearing: this.bearing,
      maxPitch: 82,
      minZoom: 11,
      maxZoom: 19,
      attributionControl: false,
      interactive: false,
      renderWorldCopies: false,
      fadeDuration: 140,
    });

    this.map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Public-data city' }), 'bottom-right');
    this.bindInputs();
    this.bindMenus();
    this.resizeMapPadding();
    window.addEventListener('resize', () => this.resizeMapPadding());

    this.map.on('styledata', () => {
      if (!this.mapReady) this.setLoading(44, 'Drawing streets and landmarks…');
    });
    this.map.on('load', () => this.onMapLoaded());
    this.map.on('error', (event) => {
      if (!this.mapReady) this.setLoading(70, 'Retrying a city tile…');
      console.warn('Map tile error', event.error);
    });

    requestAnimationFrame((time) => this.frame(time));
  }

  private onMapLoaded() {
    this.mapReady = true;
    this.setLoading(62, 'Coloring Chennai aerial imagery…');
    this.rethemeMap(this.map);

    try {
      if (!this.map.getSource('chennai-terrain')) {
        this.map.addSource('chennai-terrain', {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          tileSize: 256,
          maxzoom: 15,
          encoding: 'terrarium',
          attribution: 'Terrain: public elevation sources via AWS Open Data',
        });
        this.map.setTerrain({ source: 'chennai-terrain', exaggeration: 1.06 });
      }
    } catch (error) {
      console.warn('Terrain unavailable; continuing with buildings.', error);
    }

    this.addWorldObjects();
    this.createMinimap();
    this.cityDataReady = true;
    this.ui.meshSource.textContent = 'OSM BUILDING PARTS / AERIAL';
    window.setTimeout(() => this.finishLoading(), 700);
  }

  private rethemeMap(target: MapLibreMap) {
    const style = target.getStyle();
    if (!target.getSource('chennai-imagery')) {
      target.addSource('chennai-imagery', {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Imagery: Esri, Vantor, Earthstar Geographics, and the GIS User Community',
      });
      const imageryCeiling = (style.layers ?? []).find((layer) => layer.type === 'line' || layer.type === 'symbol')?.id;
      target.addLayer({
        id: 'chennai-imagery',
        type: 'raster',
        source: 'chennai-imagery',
        minzoom: 0,
        maxzoom: 20,
        paint: {
          'raster-opacity': target === this.map ? 1 : 0.92,
          'raster-saturation': target === this.map ? 0.02 : -0.08,
          'raster-contrast': target === this.map ? 0.06 : 0.08,
          'raster-brightness-min': 0.02,
          'raster-brightness-max': 1,
        },
      }, imageryCeiling);
    }

    if (target === this.map) {
      this.installBuildingMaterials(target);
      target.setLight({ anchor: 'viewport', position: [1.25, 190, 36], color: '#fff0d2', intensity: 0.62 });
      target.setSky({
        'sky-color': '#75b9c9',
        'horizon-color': '#efd5a8',
        'fog-color': '#d7c8aa',
        'fog-ground-blend': 0.58,
        'horizon-fog-blend': 0.66,
        'sky-horizon-blend': 0.46,
        'atmosphere-blend': 0.84,
      });
    }
    for (const layer of style.layers ?? []) {
      const id = layer.id.toLowerCase();
      try {
        if (id === 'background') target.setPaintProperty(layer.id, 'background-color', '#c9b38b');
        if (id === 'natural_earth' && layer.type === 'raster') {
          target.setPaintProperty(layer.id, 'raster-saturation', 0.5);
          target.setPaintProperty(layer.id, 'raster-contrast', 0.24);
        }
        if (id === 'water') target.setPaintProperty(layer.id, 'fill-color', '#178ea5');
        if (id.includes('waterway') && layer.type === 'line') target.setPaintProperty(layer.id, 'line-color', '#35b4bd');
        if (id.includes('park') && layer.type === 'fill') target.setPaintProperty(layer.id, 'fill-color', '#397b4b');
        if (id.includes('grass') && layer.type === 'fill') target.setPaintProperty(layer.id, 'fill-color', '#5a9449');
        if (id.includes('wood') && layer.type === 'fill') target.setPaintProperty(layer.id, 'fill-color', '#2b6842');
        if (id.includes('sand') && layer.type === 'fill') target.setPaintProperty(layer.id, 'fill-color', '#dcb46b');
        if (id.includes('pitch') && layer.type === 'fill') target.setPaintProperty(layer.id, 'fill-color', '#3ba66f');
        if (id.includes('cemetery') && layer.type === 'fill') target.setPaintProperty(layer.id, 'fill-color', '#5a9671');
        if (id.includes('hospital') && layer.type === 'fill') target.setPaintProperty(layer.id, 'fill-color', '#eaa49e');
        if (id.includes('school') && layer.type === 'fill') target.setPaintProperty(layer.id, 'fill-color', '#e8cd72');
        if (id === 'landuse_residential') target.setPaintProperty(layer.id, 'fill-color', '#d9ad80');
        if (id === 'building-3d') {
          target.setPaintProperty(layer.id, 'fill-extrusion-color', [
            'case',
            ['>', ['to-number', ['coalesce', ['get', 'render_height'], ['get', 'height']], 0], 48],
            '#5f797d',
            [
              'match',
              ['%', ['to-number', ['coalesce', ['id'], ['get', 'render_height']], 0], 6],
              0, '#c1b29a',
              1, '#d0c0a5',
              2, '#aaa395',
              3, '#d5cbbb',
              4, '#a9907d',
              '#b9ad99',
            ],
          ]);
          target.setPaintProperty(layer.id, 'fill-extrusion-opacity', target === this.map ? 1 : 0.9);
          target.setPaintProperty(layer.id, 'fill-extrusion-vertical-gradient', true);
          if (target === this.map) {
            target.setPaintProperty(layer.id, 'fill-extrusion-pattern', [
              'case',
              ['>', ['to-number', ['coalesce', ['get', 'render_height'], ['get', 'height']], 0], 48],
              ['image', 'chennai-facade-glass'],
              ['image', 'chennai-facade-plaster'],
            ]);
          }
        }
        if (target === this.map && layer.type === 'symbol') {
          target.setLayoutProperty(layer.id, 'visibility', 'none');
        }
        if ((id.includes('road') || id.includes('bridge') || id.includes('tunnel')) && id.includes('casing') && layer.type === 'line') {
          target.setPaintProperty(layer.id, 'line-color', target === this.map ? '#555958' : '#3f4a4b');
          if (target === this.map) target.setPaintProperty(layer.id, 'line-opacity', 0.32);
        } else if ((id.startsWith('road_') || id.startsWith('bridge_')) && layer.type === 'line') {
          target.setPaintProperty(layer.id, 'line-color', id.includes('motorway') ? '#b69c71' : '#d1cec6');
          if (target === this.map) target.setPaintProperty(layer.id, 'line-opacity', 0.36);
        } else if (id.startsWith('tunnel_') && layer.type === 'line') {
          target.setPaintProperty(layer.id, 'line-color', '#8d8d88');
          if (target === this.map) target.setPaintProperty(layer.id, 'line-opacity', 0.24);
        }
        if (id.includes('highway-name') && layer.type === 'symbol') {
          target.setPaintProperty(layer.id, 'text-color', '#eef5eb');
          target.setPaintProperty(layer.id, 'text-halo-color', '#1b3034');
          target.setPaintProperty(layer.id, 'text-halo-width', 1.2);
        }
      } catch {
        // A remote style can evolve; unsupported paint properties are harmless.
      }
    }

  }

  private installBuildingMaterials(target: MapLibreMap) {
    const makeMaterial = (name: string, base: string, seam: string, window: string, glass = false) => {
      if (target.hasImage(name)) return;
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) return;

      context.fillStyle = base;
      context.fillRect(0, 0, size, size);
      for (let y = 5; y < size; y += glass ? 10 : 13) {
        context.fillStyle = seam;
        context.globalAlpha = glass ? 0.72 : 0.38;
        context.fillRect(0, y - 2, size, 1);
        for (let x = 5; x < size; x += glass ? 11 : 15) {
          context.fillStyle = window;
          context.globalAlpha = glass ? 0.82 : 0.58;
          context.fillRect(x, y, glass ? 8 : 7, glass ? 6 : 5);
          context.fillStyle = '#ffffff';
          context.globalAlpha = glass ? 0.09 : 0.06;
          context.fillRect(x + 1, y + 1, glass ? 6 : 5, 1);
        }
      }
      context.globalAlpha = 1;
      if (glass) {
        context.fillStyle = '#27383b';
        context.globalAlpha = 0.35;
        for (let x = 0; x < size; x += 11) context.fillRect(x, 0, 1, size);
      } else {
        context.fillStyle = '#5f5a54';
        context.globalAlpha = 0.05;
        for (let index = 0; index < 45; index += 1) {
          const x = (index * 29) % size;
          const y = (index * 47) % size;
          context.fillRect(x, y, 1, 1);
        }
      }
      context.globalAlpha = 1;
      target.addImage(name, context.getImageData(0, 0, size, size), { pixelRatio: 2 });
    };

    makeMaterial('chennai-facade-plaster', '#b9aa91', '#766d61', '#5b6667');
    makeMaterial('chennai-facade-glass', '#587579', '#293e41', '#79a0a4', true);
  }

  private createMinimap() {
    const minimap = new maplibregl.Map({
      container: 'minimap',
      style: STYLE_URL,
      center: this.coordinate as LngLatLike,
      zoom: 14.6,
      bearing: 0,
      pitch: 0,
      attributionControl: false,
      interactive: false,
      renderWorldCopies: false,
      fadeDuration: 0,
    });
    minimap.on('load', () => this.rethemeMap(minimap));
    this.minimap = minimap;
  }

  private addWorldObjects() {
    for (const vehicle of this.vehicles) this.addVehicleMarker(vehicle);
    for (const token of this.tokens) {
      const node = document.createElement('div');
      node.className = 'world-token';
      node.innerHTML = '<i></i><span>MAA</span>';
      token.marker = new maplibregl.Marker({ element: node, anchor: 'center', pitchAlignment: 'map' })
        .setLngLat(token.coordinate)
        .addTo(this.map);
    }
  }

  private addVehicleMarker(vehicle: Vehicle) {
    vehicle.marker?.remove();
    const node = document.createElement('div');
    node.className = 'world-car';
    node.style.setProperty('--car-color', vehicle.color);
    node.innerHTML = '<i class="car-cabin"></i><i class="car-light"></i>';
    vehicle.marker = new maplibregl.Marker({
      element: node,
      anchor: 'center',
      rotation: vehicle.bearing,
      pitchAlignment: 'map',
      rotationAlignment: 'map',
    }).setLngLat(vehicle.coordinate).addTo(this.map);
  }

  private bindInputs() {
    const movementCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space']);
    window.addEventListener('keydown', (event) => {
      if (this.ui.menu.open) return;
      if (movementCodes.has(event.code)) event.preventDefault();
      this.keys.add(event.code);
      if (event.repeat) return;

      if (event.code === 'Space') this.jump();
      if (event.code === 'KeyV') this.toggleVehicle();
      if (event.code === 'KeyH') this.toggleGlider();
      if (event.code === 'KeyC') this.toggleCamera();
      if (event.code === 'KeyR') this.respawn();
      if (event.code === 'KeyM') this.openMenu();
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.keys.clear());

    const world = element<HTMLElement>('#world');
    world.addEventListener('click', () => {
      if (window.matchMedia('(pointer: fine)').matches && !this.ui.menu.open) world.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      const linked = document.pointerLockElement === world;
      this.ui.cameraLink.classList.toggle('linked', linked);
      this.ui.cameraLink.innerHTML = linked ? '<span></span> CAMERA LINKED · ESC TO RELEASE' : '<span></span> CLICK TO LINK CAMERA';
    });
    document.addEventListener('mousemove', (event) => {
      if (document.pointerLockElement !== world) return;
      this.bearing = (this.bearing + event.movementX * 0.12 + 360) % 360;
      this.pitch = Math.max(48, Math.min(79, this.pitch - event.movementY * 0.06));
    });
    this.ui.cameraLink.addEventListener('click', () => world.requestPointerLock());

    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-key]')) {
      const code = button.dataset.key!;
      const down = (event: Event) => { event.preventDefault(); this.keys.add(code); };
      const up = (event: Event) => { event.preventDefault(); this.keys.delete(code); };
      button.addEventListener('pointerdown', down);
      button.addEventListener('pointerup', up);
      button.addEventListener('pointercancel', up);
      button.addEventListener('pointerleave', up);
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action]')) {
      button.addEventListener('click', () => {
        if (button.dataset.action === 'jump') this.jump();
        if (button.dataset.action === 'vehicle') this.toggleVehicle();
        if (button.dataset.action === 'glider') this.toggleGlider();
      });
    }
  }

  private bindMenus() {
    element<HTMLButtonElement>('#brand-button').addEventListener('click', () => this.openMenu());
    element<HTMLButtonElement>('#expand-map').addEventListener('click', () => this.openMenu());
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-destination]')) {
      button.addEventListener('click', () => {
        const name = button.dataset.destination as DestinationName;
        this.destination = DESTINATIONS[name];
        this.coordinate = [...this.destination.coordinate];
        this.bearing = this.destination.bearing;
        this.mode = 'walk';
        this.speed = 0;
        this.altitude = 8;
        this.jumpHeight = 0;
        this.activeVehicle = undefined;
        this.ui.menu.close();
        this.showToast(`LINKED · ${this.destination.name}`);
      });
    }
  }

  private openMenu() {
    this.keys.clear();
    if (!this.ui.menu.open) this.ui.menu.showModal();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private jump() {
    if (this.mode === 'drive') return;
    if (this.mode === 'glide') {
      this.toggleGlider();
      return;
    }
    if (this.jumpHeight <= 0.05) {
      this.verticalVelocity = 5.8;
      this.showToast('SERVO BURST');
    }
  }

  private toggleVehicle() {
    if (this.mode === 'drive' && this.activeVehicle) {
      this.activeVehicle.coordinate = [...this.coordinate];
      this.activeVehicle.bearing = this.bearing;
      this.addVehicleMarker(this.activeVehicle);
      this.activeVehicle = undefined;
      this.mode = 'walk';
      this.speed = 0;
      this.showToast('G1 DEPLOYED');
      return;
    }

    if (this.mode === 'glide') this.toggleGlider();
    if (!this.nearestVehicle || this.nearestVehicle.distance > 28) {
      this.showToast('NO VEHICLE IN RANGE');
      return;
    }

    this.activeVehicle = this.nearestVehicle.vehicle;
    this.activeVehicle.marker?.remove();
    this.activeVehicle.marker = undefined;
    this.bearing = this.activeVehicle.bearing;
    this.mode = 'drive';
    this.speed = 0;
    this.showToast('VEHICLE LINKED · SHIFT TO BOOST');
  }

  private toggleGlider() {
    if (this.mode === 'drive') {
      this.showToast('EXIT VEHICLE BEFORE GLIDING');
      return;
    }
    if (this.mode === 'glide') {
      this.mode = 'walk';
      this.altitude = 8;
      this.jumpHeight = 1.4;
      this.verticalVelocity = -1;
      this.showToast('GLIDER STOWED');
    } else {
      this.mode = 'glide';
      this.altitude = Math.max(this.altitude, 120);
      this.jumpHeight = 3.6;
      this.speed = Math.max(this.speed, 14);
      this.showToast('AEROFOIL DEPLOYED');
    }
  }

  private toggleCamera() {
    this.cameraWide = !this.cameraWide;
    this.showToast(this.cameraWide ? 'CAMERA · CITY WIDE' : 'CAMERA · THIRD PERSON');
  }

  private respawn() {
    this.coordinate = [...this.destination.coordinate];
    this.bearing = this.destination.bearing;
    this.mode = 'walk';
    this.activeVehicle = undefined;
    this.speed = 0;
    this.altitude = 8;
    this.jumpHeight = 0;
    this.verticalVelocity = 0;
    this.showToast('G1 RECALIBRATED');
  }

  private frame(time: number) {
    const delta = Math.min((time - this.lastTime) / 1_000, 0.05);
    this.lastTime = time;
    this.update(delta);
    this.robot.render(delta);
    requestAnimationFrame((nextTime) => this.frame(nextTime));
  }

  private update(delta: number) {
    const forward = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const steering = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const sprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const climbingIntent = this.keys.has('Space') && forward > 0;

    if (this.mode === 'drive') {
      const maxSpeed = sprinting ? 36 : 24;
      const target = forward > 0 ? maxSpeed : forward < 0 ? -8 : 0;
      this.speed = expLerp(this.speed, target, forward === 0 ? 2.4 : 1.55, delta);
      this.bearing = (this.bearing + steering * Math.min(74, 32 + Math.abs(this.speed) * 1.9) * delta * Math.sign(this.speed || 1) + 360) % 360;
    } else if (this.mode === 'glide') {
      const target = forward < 0 ? 8 : sprinting ? 27 : 17;
      this.speed = expLerp(this.speed, target, 1.9, delta);
      this.bearing = (this.bearing + steering * 42 * delta + 360) % 360;
      this.altitude = Math.max(30, this.altitude + (forward > 0 ? -1.4 : forward < 0 ? 2.5 : -0.4) * delta);
      this.jumpHeight = 3.5 + Math.sin(performance.now() / 560) * 0.14;
    } else {
      this.climbProbeClock -= delta;
      if (this.climbProbeClock <= 0 && climbingIntent) {
        this.climbProbeClock = 0.22;
        this.buildingAhead = this.probeBuildingAhead();
      }
      if (climbingIntent && this.buildingAhead && this.speed > 0.8) {
        this.mode = 'climb';
        this.altitude = Math.min(180, this.altitude + 7.2 * delta);
        this.jumpHeight = Math.min(7.2, this.jumpHeight + 2.8 * delta);
        this.speed = expLerp(this.speed, 1.25, 5, delta);
      } else {
        if (this.mode === 'climb') {
          this.mode = 'walk';
          this.verticalVelocity = -0.5;
        }
        const target = forward * (sprinting ? 8.4 : 4.5);
        this.speed = expLerp(this.speed, target, forward === 0 ? 8 : 5.5, delta);
        this.bearing = (this.bearing + steering * (sprinting ? 112 : 92) * delta + 360) % 360;
        this.verticalVelocity -= 12.8 * delta;
        this.jumpHeight += this.verticalVelocity * delta;
        if (this.jumpHeight <= 0) {
          this.jumpHeight = 0;
          this.verticalVelocity = 0;
          this.altitude = 8;
        } else {
          this.altitude = 8 + this.jumpHeight * 3;
        }
      }
    }

    if (Math.abs(this.speed) > 0.04 && this.mode !== 'climb') {
      this.coordinate = moveCoordinate(this.coordinate, this.bearing, this.speed * delta);
    }

    this.battery = Math.max(12, this.battery - Math.abs(this.speed) * delta * 0.0008);
    this.updateCamera();
    this.checkWorldInteractions();

    this.interfaceClock -= delta;
    if (this.interfaceClock <= 0) {
      this.interfaceClock = 0.12;
      this.updateInterface();
      if (this.minimap?.loaded()) this.minimap.jumpTo({ center: this.coordinate as LngLatLike, zoom: this.mode === 'glide' ? 13.4 : 14.6 });
    }

    this.robot.setState({ mode: this.mode, speed: Math.abs(this.speed), jumpHeight: this.jumpHeight, steering });
  }

  private updateCamera() {
    if (!this.mapReady) return;
    const zoom = this.mode === 'glide' ? (this.cameraWide ? 13.5 : 15.6)
      : this.mode === 'climb' ? 16.2
        : this.mode === 'drive' ? (this.cameraWide ? 15.7 : 17.1)
          : (this.cameraWide ? 16.1 : 17.45);
    const targetPitch = this.mode === 'glide' ? 73 : this.cameraWide ? 61 : this.pitch;
    this.map.jumpTo({
      center: this.coordinate as LngLatLike,
      bearing: this.bearing,
      pitch: targetPitch,
      zoom,
    });
    if (!this.firstFrameReady && this.cityDataReady && this.map.areTilesLoaded()) {
      this.firstFrameReady = true;
      this.finishLoading();
    }
  }

  private probeBuildingAhead() {
    const buildingLayer = 'building-3d';
    if (!this.mapReady || !this.map.getLayer(buildingLayer)) return false;
    const width = this.map.getCanvas().clientWidth;
    const height = this.map.getCanvas().clientHeight;
    try {
      const hits = this.map.queryRenderedFeatures([
        [width * 0.43, height * 0.35],
        [width * 0.57, height * 0.66],
      ], { layers: [buildingLayer] });
      return hits.length > 0;
    } catch {
      return false;
    }
  }

  private checkWorldInteractions() {
    const available = this.vehicles
      .filter((vehicle) => vehicle !== this.activeVehicle && vehicle.marker)
      .map((vehicle) => ({ vehicle, distance: haversineMeters(this.coordinate, vehicle.coordinate) }))
      .sort((a, b) => a.distance - b.distance);
    this.nearestVehicle = available[0];

    for (const token of this.tokens) {
      if (token.collected || haversineMeters(this.coordinate, token.coordinate) > (this.mode === 'drive' ? 18 : 10)) continue;
      token.collected = true;
      token.marker?.remove();
      this.tokensCollected += 1;
      this.showToast(`CITY TOKEN ${String(this.tokensCollected).padStart(2, '0')} SECURED`);
    }
  }

  private updateInterface() {
    const kmh = Math.round(Math.abs(this.speed) * 3.6);
    this.ui.speed.textContent = String(kmh).padStart(2, '0');
    this.ui.mode.textContent = this.mode === 'drive' ? 'VEHICLE' : this.mode === 'glide' ? 'AERO' : this.mode === 'climb' ? 'MAG-LOCK' : 'BIPED';
    this.ui.altitude.textContent = `ALT ${String(Math.round(this.altitude)).padStart(3, '0')} M`;
    this.ui.battery.style.width = `${this.battery}%`;
    this.ui.coinCount.textContent = String(this.tokensCollected).padStart(2, '0');
    this.ui.coords.textContent = `${this.coordinate[1].toFixed(4)} / ${this.coordinate[0].toFixed(4).replace('-', '−')}`;
    this.ui.radarArrow.style.transform = `translate(-50%, -50%) rotate(${this.bearing}deg)`;

    const district = DISTRICTS
      .map((place) => ({ ...place, distance: haversineMeters(this.coordinate, place.coordinate) }))
      .sort((a, b) => a.distance - b.distance)[0];
    this.ui.district.textContent = district.distance < 3_500 ? district.name : 'CHENNAI';

    if (this.mode === 'drive') {
      this.ui.interaction.classList.add('visible');
      this.ui.interactionCopy.textContent = 'EXIT VEHICLE';
    } else if (this.nearestVehicle && this.nearestVehicle.distance < 28) {
      this.ui.interaction.classList.add('visible');
      this.ui.interactionCopy.textContent = `LINK ${this.nearestVehicle.vehicle.id.toUpperCase()} VEHICLE`;
    } else {
      this.ui.interaction.classList.remove('visible');
    }

    if (!this.activeVehicle && this.tokensCollected === 0) {
      this.ui.missionIndex.textContent = '01';
      this.ui.missionCopy.textContent = 'Reach a vehicle';
      this.ui.missionDistance.textContent = this.nearestVehicle ? `${Math.round(this.nearestVehicle.distance)} M` : '—';
    } else if (this.tokensCollected < 3) {
      this.ui.missionIndex.textContent = '02';
      this.ui.missionCopy.textContent = 'Collect 3 city tokens';
      this.ui.missionDistance.textContent = `${this.tokensCollected} / 3`;
    } else if (this.mode !== 'glide') {
      this.ui.missionIndex.textContent = '03';
      this.ui.missionCopy.textContent = 'Deploy the aerofoil';
      this.ui.missionDistance.textContent = 'PRESS H';
    } else {
      this.ui.missionIndex.textContent = '∞';
      this.ui.missionCopy.textContent = 'Explore without limits';
      this.ui.missionDistance.textContent = 'CITY OPEN';
    }
  }

  private resizeMapPadding() {
    if (!this.map) return;
    const bottom = window.innerWidth < 700 ? Math.round(window.innerHeight * 0.24) : Math.round(window.innerHeight * 0.28);
    this.map.setPadding({ top: 0, right: 0, bottom, left: 0 });
  }

  private setLoading(progress: number, status: string) {
    this.ui.loadProgress.style.width = `${progress}%`;
    this.ui.loadStatus.textContent = status;
  }

  private finishLoading() {
    if (this.ui.loading.classList.contains('done')) return;
    this.setLoading(100, 'G1 control link ready.');
    window.setTimeout(() => this.ui.loading.classList.add('done'), 450);
    const startupHint = window.matchMedia('(pointer: coarse)').matches
      ? 'TOUCH CONTROLS ACTIVE · MAP FOR FAST TRAVEL'
      : 'WASD TO MOVE · CLICK TO LINK CAMERA';
    window.setTimeout(() => this.showToast(startupHint), 1_250);
  }

  private showToast(message: string) {
    window.clearTimeout(this.toastTimer);
    this.ui.toast.textContent = message;
    this.ui.toast.classList.add('visible');
    this.toastTimer = window.setTimeout(() => this.ui.toast.classList.remove('visible'), 2_200);
  }
}
