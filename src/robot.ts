import * as THREE from 'three';

export type MotionMode = 'walk' | 'drive' | 'glide' | 'climb';

export interface RobotVisualState {
  mode: MotionMode;
  speed: number;
  jumpHeight: number;
  steering: number;
}

interface LimbRig {
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftElbow: THREE.Group;
  rightElbow: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
}

const graphite = new THREE.MeshStandardMaterial({ color: 0x151a1b, roughness: 0.56, metalness: 0.68 });
const alloy = new THREE.MeshStandardMaterial({ color: 0xb9bec0, roughness: 0.35, metalness: 0.84 });
const armor = new THREE.MeshStandardMaterial({ color: 0xe5e2dc, roughness: 0.52, metalness: 0.34 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x090b0c, roughness: 0.9, metalness: 0.05 });
const sensor = new THREE.MeshStandardMaterial({ color: 0x061112, roughness: 0.2, metalness: 0.55, emissive: 0x16f0d0, emissiveIntensity: 0.5 });

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
) {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(...position);
  part.rotation.set(...rotation);
  part.castShadow = true;
  part.receiveShadow = true;
  return part;
}

function motor(radius = 0.105) {
  const joint = new THREE.Group();
  joint.add(mesh(new THREE.CylinderGeometry(radius, radius, 0.12, 18), alloy, [0, 0, 0], [0, 0, Math.PI / 2]));
  joint.add(mesh(new THREE.CylinderGeometry(radius * 0.46, radius * 0.46, 0.126, 18), sensor, [0, 0, 0], [0, 0, Math.PI / 2]));
  return joint;
}

function limbSection(length: number, radius: number, material: THREE.Material) {
  const section = new THREE.Group();
  section.add(mesh(new THREE.CapsuleGeometry(radius, length - radius * 2, 7, 12), material, [0, -length / 2, 0]));
  return section;
}

function buildG1(): { robot: THREE.Group; rig: LimbRig } {
  const robot = new THREE.Group();
  robot.name = 'Unitree G1';

  const pelvis = new THREE.Group();
  pelvis.position.y = 1.36;
  pelvis.add(mesh(new THREE.BoxGeometry(0.47, 0.23, 0.3), graphite, [0, 0, 0]));
  pelvis.add(mesh(new THREE.BoxGeometry(0.34, 0.13, 0.32), armor, [0, 0.03, -0.025]));
  robot.add(pelvis);

  const torso = new THREE.Group();
  torso.position.y = 1.67;
  torso.add(mesh(new THREE.CapsuleGeometry(0.28, 0.32, 8, 16), graphite, [0, 0.08, 0]));
  torso.add(mesh(new THREE.BoxGeometry(0.51, 0.45, 0.26), armor, [0, 0.06, -0.025]));
  torso.add(mesh(new THREE.BoxGeometry(0.34, 0.19, 0.275), graphite, [0, 0.06, -0.15]));
  torso.add(mesh(new THREE.BoxGeometry(0.22, 0.04, 0.018), sensor, [0, 0.13, -0.292]));
  robot.add(torso);

  const neck = motor(0.075);
  neck.position.set(0, 2.08, 0);
  robot.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 2.23, -0.01);
  head.add(mesh(new THREE.CapsuleGeometry(0.17, 0.12, 8, 18), armor, [0, 0, 0], [0, 0, Math.PI / 2]));
  head.add(mesh(new THREE.CapsuleGeometry(0.125, 0.13, 8, 18), sensor, [0, 0.012, -0.115], [0, 0, Math.PI / 2]));
  head.add(mesh(new THREE.BoxGeometry(0.19, 0.035, 0.025), new THREE.MeshBasicMaterial({ color: 0x83fff0 }), [0, 0.025, -0.221]));
  robot.add(head);

  const makeArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.37, 1.91, 0);
    shoulder.add(motor(0.115));
    const upper = limbSection(0.47, 0.088, graphite);
    upper.children[0].scale.set(0.86, 1, 0.95);
    shoulder.add(upper);
    shoulder.add(mesh(new THREE.BoxGeometry(0.17, 0.32, 0.15), armor, [0, -0.22, 0]));

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.47, 0);
    elbow.add(motor(0.09));
    const lower = limbSection(0.43, 0.07, alloy);
    elbow.add(lower);
    elbow.add(mesh(new THREE.BoxGeometry(0.13, 0.26, 0.13), graphite, [0, -0.23, 0.005]));
    elbow.add(mesh(new THREE.BoxGeometry(0.12, 0.12, 0.18), rubber, [0, -0.49, -0.02]));
    shoulder.add(elbow);
    robot.add(shoulder);
    return { shoulder, elbow };
  };

  const makeLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.18, 1.3, 0);
    hip.add(motor(0.125));
    const upper = limbSection(0.57, 0.105, graphite);
    hip.add(upper);
    hip.add(mesh(new THREE.BoxGeometry(0.18, 0.34, 0.18), armor, [0, -0.27, 0]));

    const knee = new THREE.Group();
    knee.position.set(0, -0.57, 0);
    knee.add(motor(0.115));
    const lower = limbSection(0.54, 0.09, alloy);
    knee.add(lower);
    knee.add(mesh(new THREE.BoxGeometry(0.16, 0.34, 0.16), graphite, [0, -0.29, 0]));
    knee.add(mesh(new THREE.BoxGeometry(0.19, 0.1, 0.35), rubber, [0, -0.57, -0.07]));
    hip.add(knee);
    robot.add(hip);
    return { hip, knee };
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  robot.scale.setScalar(0.92);
  // Third-person camera: show the G1's back while it faces into the city.
  robot.rotation.y = 0;

  return {
    robot,
    rig: {
      leftArm: leftArm.shoulder,
      rightArm: rightArm.shoulder,
      leftElbow: leftArm.elbow,
      rightElbow: rightArm.elbow,
      leftLeg: leftLeg.hip,
      rightLeg: rightLeg.hip,
      leftKnee: leftLeg.knee,
      rightKnee: rightLeg.knee,
      torso,
      head,
    },
  };
}

function buildGlider() {
  const glider = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -2.25, 0, 0, 0, 0.18, -0.15, -0.18, 0, 0.5,
    2.25, 0, 0, 0.18, 0, 0.5, 0, 0.18, -0.15,
  ], 3));
  geometry.computeVertexNormals();
  glider.add(mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xff5b36, side: THREE.DoubleSide, roughness: 0.6 }), [0, 0, 0]));

  const blueWing = new THREE.BufferGeometry();
  blueWing.setAttribute('position', new THREE.Float32BufferAttribute([
    -2.16, 0.012, 0.01, -0.08, 0.19, -0.14, -0.18, 0.012, 0.48,
    2.16, 0.012, 0.01, 0.18, 0.012, 0.48, 0.08, 0.19, -0.14,
  ], 3));
  blueWing.computeVertexNormals();
  glider.add(mesh(blueWing, new THREE.MeshStandardMaterial({ color: 0x28c8ff, side: THREE.DoubleSide, roughness: 0.45 }), [0, 0, 0]));
  glider.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 4.6, 10), alloy, [0, 0.02, 0], [0, 0, Math.PI / 2]));
  glider.position.set(0, 2.52, 0.05);
  glider.rotation.x = -0.12;
  return glider;
}

function buildCar() {
  const car = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xff4f34, roughness: 0.36, metalness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x163c42, roughness: 0.16, metalness: 0.72 });
  car.add(mesh(new THREE.BoxGeometry(1.5, 0.34, 2.9), red, [0, 0.4, 0]));
  car.add(mesh(new THREE.BoxGeometry(1.22, 0.42, 1.38), glass, [0, 0.76, 0.03]));
  car.add(mesh(new THREE.BoxGeometry(1.08, 0.08, 0.18), sensor, [0, 0.42, -1.5]));
  for (const x of [-0.78, 0.78]) {
    for (const z of [-0.95, 0.95]) {
      car.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.2, 18), rubber, [x, 0.25, z], [0, 0, Math.PI / 2]));
    }
  }
  car.rotation.y = Math.PI;
  car.scale.setScalar(0.72);
  return car;
}

export class RobotRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  private readonly stage = new THREE.Group();
  private readonly robot: THREE.Group;
  private readonly glider: THREE.Group;
  private readonly car: THREE.Group;
  private readonly rig: LimbRig;
  private state: RobotVisualState = { mode: 'walk', speed: 0, jumpHeight: 0, steering: 0 };
  private elapsed = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.add(this.stage);
    const robotBuild = buildG1();
    this.robot = robotBuild.robot;
    this.rig = robotBuild.rig;
    this.glider = buildGlider();
    this.car = buildCar();
    this.stage.add(this.robot, this.glider, this.car);

    const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x00100c, transparent: true, opacity: 0.28, depthWrite: false });
    const shadow = mesh(new THREE.CircleGeometry(0.55, 32), shadowMaterial, [0, 0.015, 0], [-Math.PI / 2, 0, 0]);
    shadow.scale.y = 0.42;
    shadow.receiveShadow = false;
    this.stage.add(shadow);

    const hemi = new THREE.HemisphereLight(0xe9fff8, 0x163336, 2.8);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 4.8);
    key.position.set(-3, 7, 5);
    key.castShadow = true;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x35ffe0, 3.4);
    rim.position.set(4, 3, -5);
    this.scene.add(rim);

    this.camera.position.set(0, 2.5, 7.1);
    this.camera.lookAt(0, 1.18, 0);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setState(state: RobotVisualState) {
    this.state = state;
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.fov = width < 700 ? 38 : 32;
    this.camera.updateProjectionMatrix();
    this.stage.scale.setScalar(width < 700 ? 0.72 : 1);
    this.stage.position.x = width < 700 ? 0 : 0.14;
  }

  render(delta: number) {
    this.elapsed += delta;
    const speedAmount = THREE.MathUtils.clamp(this.state.speed / 8, 0, 1.6);
    const cadence = this.elapsed * (5.5 + speedAmount * 4.5);
    const swing = Math.sin(cadence) * 0.62 * Math.min(speedAmount, 1);
    const bounce = Math.abs(Math.sin(cadence)) * 0.045 * Math.min(speedAmount, 1);

    this.robot.visible = this.state.mode !== 'drive';
    this.car.visible = this.state.mode === 'drive';
    this.glider.visible = this.state.mode === 'glide';

    this.stage.position.y = this.state.jumpHeight * 0.28 - 1.05 + bounce;
    this.stage.rotation.z = THREE.MathUtils.lerp(this.stage.rotation.z, -this.state.steering * 0.08, 0.12);

    if (this.state.mode === 'climb') {
      this.rig.leftArm.rotation.x = Math.PI - Math.sin(cadence) * 0.25;
      this.rig.rightArm.rotation.x = Math.PI + Math.sin(cadence) * 0.25;
      this.rig.leftLeg.rotation.x = -swing * 0.55;
      this.rig.rightLeg.rotation.x = swing * 0.55;
      this.rig.leftElbow.rotation.x = -0.45;
      this.rig.rightElbow.rotation.x = -0.45;
    } else if (this.state.mode === 'glide') {
      this.rig.leftArm.rotation.z = -1.0;
      this.rig.rightArm.rotation.z = 1.0;
      this.rig.leftArm.rotation.x = 0.35;
      this.rig.rightArm.rotation.x = 0.35;
      this.rig.leftElbow.rotation.x = -0.75;
      this.rig.rightElbow.rotation.x = -0.75;
      this.rig.leftLeg.rotation.x = 0.17;
      this.rig.rightLeg.rotation.x = -0.17;
    } else {
      this.rig.leftArm.rotation.x = -swing * 0.7;
      this.rig.rightArm.rotation.x = swing * 0.7;
      this.rig.leftArm.rotation.z = 0;
      this.rig.rightArm.rotation.z = 0;
      this.rig.leftElbow.rotation.x = -0.08 - Math.max(0, swing) * 0.25;
      this.rig.rightElbow.rotation.x = -0.08 + Math.min(0, swing) * 0.25;
      this.rig.leftLeg.rotation.x = swing;
      this.rig.rightLeg.rotation.x = -swing;
      this.rig.leftKnee.rotation.x = Math.max(0, -swing) * 0.55;
      this.rig.rightKnee.rotation.x = Math.max(0, swing) * 0.55;
    }

    this.rig.torso.rotation.y = Math.sin(cadence * 0.5) * 0.025 * speedAmount;
    this.rig.head.rotation.y = Math.sin(this.elapsed * 0.8) * 0.07;
    this.car.rotation.z = -this.state.steering * 0.06;
    this.car.position.y = Math.sin(this.elapsed * 13) * 0.012 * speedAmount;
    this.glider.rotation.z = -this.state.steering * 0.12;

    this.renderer.render(this.scene, this.camera);
  }
}
