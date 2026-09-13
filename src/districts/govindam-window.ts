import * as THREE from 'three';

export const GOVINDAM_WINDOW_ASSET_PATH = '/assets/govindam-window.glb';
// Conditional photograph correspondence; cropped left jamb and all metric values inferred.
export const GOVINDAM_WINDOW_APERTURE = {x0: -4.55, x1: -3.14, y0: 4.88, y1: 6.58};

/** Called only after the window GLB loads. Retain original wall for failure recovery. */
export function installGovindamWindow(shell: THREE.Group, bay: THREE.Group, asset: THREE.Group) {
  const original = shell.getObjectByName('Govindam north wall panels · reference-informed plaster');
  if (!(original instanceof THREE.Group) || !original.visible || shell.userData.govindamWindow) {
    throw new Error('Expected unmodified Govindam north wall panels');
  }
  const wall = original.clone();
  wall.name = 'Govindam north wall panels · partial photographed window';
  const aperture = GOVINDAM_WINDOW_APERTURE;
  const allocated: THREE.BufferGeometry[] = [];
  let containingPanels = 0;
  try {
    for (const object of [...wall.children]) {
      if (!(object instanceof THREE.Mesh)) continue;
      const bounds = new THREE.Box3().setFromBufferAttribute(object.geometry.getAttribute('position') as THREE.BufferAttribute).translate(object.position);
      if (!(bounds.min.x < aperture.x0 && bounds.max.x > aperture.x1 && bounds.min.y < aperture.y0 && bounds.max.y > aperture.y1)) continue;
      containingPanels++;
      wall.remove(object);
      const uv = object.geometry.getAttribute('uv');
      for (const [x0,x1,y0,y1] of [
        [bounds.min.x,aperture.x0,bounds.min.y,bounds.max.y],
        [aperture.x1,bounds.max.x,bounds.min.y,bounds.max.y],
        [aperture.x0,aperture.x1,bounds.min.y,aperture.y0],
        [aperture.x0,aperture.x1,aperture.y1,bounds.max.y],
      ]) {
        const geometry = new THREE.PlaneGeometry(x1-x0,y1-y0); allocated.push(geometry);
        const position = geometry.getAttribute('position'), nextUv = geometry.getAttribute('uv');
        // Interpolate the original wall's physical UV scale instead of stretching a new tile.
        for (let i=0;i<position.count;i++) {
          const x=(x0+x1)/2+position.getX(i), y=(y0+y1)/2+position.getY(i);
          const tx=(x-bounds.min.x)/(bounds.max.x-bounds.min.x),ty=(y-bounds.min.y)/(bounds.max.y-bounds.min.y);
          for (let k=0;k<2;k++) {
            const bottom=uv.getComponent(2,k)*(1-tx)+uv.getComponent(3,k)*tx;
            const top=uv.getComponent(0,k)*(1-tx)+uv.getComponent(1,k)*tx;
            nextUv.setComponent(i,k,bottom*(1-ty)+top*ty);
          }
        }
        const panel = new THREE.Mesh(geometry,object.material);
        panel.position.set((x0+x1)/2,(y0+y1)/2,0);
        panel.castShadow=panel.receiveShadow=true; wall.add(panel);
      }
    }
    if (containingPanels!==1) throw new Error('Window must lie within exactly one retained wall panel');
    asset.name='Govindam partial left window · photographed construction, inferred dimensions';
    asset.traverse(object=>{
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow=object.receiveShadow=true;
      for (const material of Array.isArray(object.material)?object.material:[object.material]) {
        if (material.transparent || (material instanceof THREE.MeshPhysicalMaterial && material.transmission>0)) {
          material.depthWrite=false; material.forceSinglePass=true; object.castShadow=false;
        }
      }
    });
    // Mutate the visible scene only after all construction and validation succeeds.
    bay.add(asset); shell.add(wall); original.visible=false;
    const result={loaded:true,aperture:{...aperture},containingPanels,originalWallRetained:true,
      geometryTriangles:2612,materialCount:5,glass:'Physical transmission; additional scene render pass',
      limitations:'Partial source crop; left jamb, dimensions, hidden room and exact pose inferred'};
    shell.userData.govindamWindow=result;
    return result;
  } catch (error) {
    allocated.forEach(geometry=>geometry.dispose());
    throw error;
  }
}
