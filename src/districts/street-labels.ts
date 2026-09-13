import { Camera, Object3D, Raycaster, Vector3 } from 'three';
import type { NamedStreet, StreetPoint, buildStreetNameIndex } from './street-names';
import './street-names.css';

type Index = ReturnType<typeof buildStreetNameIndex>;
type LabelOptions = {
  width: number;
  height: number;
  visible?: boolean;
  elevationAt?: (x: number, z: number, wayId: number) => number | null;
  /** Supply the scene or visible building groups to suppress labels behind geometry. */
  occluders?: Object3D[];
  /** Screen rectangles reserved for controls or an open panel. */
  exclusions?: { left: number; top: number; right: number; bottom: number }[];
};
type Anchor = { street: NamedStreet; wayId: number; tamilName: string; point: StreetPoint };

/** Screen annotations attached to mapped centerlines, not physical sign assets. */
export function createStreetLabels(index: Index) {
  const element = document.createElement('div'); element.className = 'street-label-overlay';
  element.setAttribute('aria-hidden', 'true'); // Accessible names and source links live in the directory.
  const anchors: Anchor[] = [];
  for (const street of index.streets) for (const path of street.paths) {
    let carry = 0;
    anchors.push({ street, wayId: path.wayId, tamilName: path.tamilName, point: { ...path.points[0] } });
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1], b = path.points[i], length = Math.hypot(b.x - a.x, b.z - a.z);
      if (length === 0) continue;
      for (let distance = 35 - carry; distance <= length; distance += 35) {
        const t = distance / length;
        anchors.push({ street, wayId: path.wayId, tamilName: path.tamilName, point: { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t } });
      }
      carry = (carry + length) % 35;
    }
    anchors.push({ street, wayId: path.wayId, tamilName: path.tamilName, point: { ...path.points.at(-1)! } });
  }
  const ray = new Raycaster(), world = new Vector3(), projected = new Vector3(), direction = new Vector3();
  const nodes = Array.from({length: 5}, () => {
    const node = document.createElement('div'); node.className = 'street-map-label'; node.hidden = true;
    const name = document.createElement('span'); name.className = 'street-map-label-name';
    const tamil = document.createElement('span'); tamil.className = 'street-map-label-tamil'; tamil.lang = 'ta';
    node.append(name, tamil); element.append(node); return { node, name, tamil };
  });
  let lastTime = -Infinity, lastMatrix = '', lastSize = '', lastExclusions = '', forceNext = true;
  let lastReport: { street: string; wayId: number; x: number; y: number; anchor: number[] }[] = [];
  function update(camera: Camera, options: LabelOptions) {
    element.hidden = options.visible === false;
    if (element.hidden) { forceNext = true; return []; }
    const now = performance.now(), size = `${options.width},${options.height}`;
    const exclusions = JSON.stringify(options.exclusions || []);
    camera.updateMatrixWorld();
    const matrix = camera.matrixWorld.elements.join(',') + camera.projectionMatrix.elements.join(',');
    // This reconstruction is static. Reuse an unchanged camera/layout result;
    // never raycast an idle scene periodically just to keep the names visible.
    if (!forceNext && size === lastSize && matrix === lastMatrix && exclusions === lastExclusions) return lastReport;
    if (!forceNext && size === lastSize && now - lastTime < 120) return lastReport;
    forceNext = false; lastTime = now; lastMatrix = matrix; lastSize = size; lastExclusions = exclusions;
    nodes.forEach(({node}) => { node.hidden = true; });
    const maxLabels = options.width < 600 ? 3 : 5;
    const candidates = anchors.map(anchor => {
      const h = options.elevationAt?.(anchor.point.x, anchor.point.z, anchor.wayId) ?? 0;
      world.set(anchor.point.x, h + .3, anchor.point.z);
      projected.copy(world).project(camera);
      return { ...anchor, world: world.clone(), ndc: projected.clone(), distance: world.distanceTo(camera.position) };
    }).filter(a => a.distance < 900 && a.ndc.z >= -1 && a.ndc.z <= 1 && Math.abs(a.ndc.x) < .94 && Math.abs(a.ndc.y) < .9)
      .sort((a,b) => a.distance - b.distance);
    const used = new Set<string>(), boxes = [...(options.exclusions || [])];
    let testedOcclusion = 0;
    lastReport = [];
    for (const candidate of candidates) {
      if (lastReport.length >= maxLabels || testedOcclusion >= 18) break;
      if (used.has(candidate.street.id)) continue;
      const x = (candidate.ndc.x + 1) * options.width / 2, y = (1 - candidate.ndc.y) * options.height / 2;
      const {node, name, tamil} = nodes[lastReport.length];
      name.textContent = candidate.street.name;
      // Use only the tag on this way: related segments can contain spelling variants.
      tamil.textContent = candidate.tamilName; tamil.hidden = !tamil.textContent;
      node.hidden = false; node.style.visibility = 'hidden';
      const width = node.offsetWidth, height = node.offsetHeight;
      const box = {left:x-width/2-8,right:x+width/2+8,top:y-height-10,bottom:y+8};
      const overlap = boxes.some(b => box.left < b.right && box.right > b.left && box.top < b.bottom && box.bottom > b.top);
      if (box.left < 10 || box.right > options.width - 10 || box.top < 12 || box.bottom > options.height - 12 || overlap) { node.hidden = true; continue; }
      if (options.occluders?.length) {
        testedOcclusion++;
        direction.copy(candidate.world).sub(camera.position).normalize(); ray.set(camera.position,direction); ray.far = Math.max(0,candidate.distance - .5);
        const hits = ray.intersectObjects(options.occluders,true);
        const blocked = hits.some(hit => {
          let object: Object3D | null = hit.object;
          while (object) { if (!object.visible) return false; object = object.parent; }
          return true;
        });
        if (blocked) { node.hidden = true; continue; }
      }
      node.style.left = `${x}px`; node.style.top = `${y}px`; node.style.visibility = '';
      node.dataset.wayId = String(candidate.wayId); used.add(candidate.street.id); boxes.push(box);
      lastReport.push({ street:candidate.street.name,wayId:candidate.wayId,x,y,anchor:candidate.world.toArray() });
    }
    return lastReport;
  }
  return { element, update, anchorCount: anchors.length, invalidate: () => { forceNext=true; lastReport=[]; nodes.forEach(({node})=>{node.hidden=true;}); }, dispose: () => element.remove() };
}
