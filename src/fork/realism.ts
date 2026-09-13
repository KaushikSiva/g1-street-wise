import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {prepareCentralDaylight} from '../districts/central-avenue-lighting';
import {buildCentralAvenueCanopy} from '../districts/central-avenue-canopy';
import {installAvinashVisibility} from '../districts/avinash-visibility';
import {installEncaarpusOcclusion} from '../districts/encaarpus-occlusion';
import {installEncaarpusCar} from '../districts/encaarpus-entry';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {AlphaAwareGTAOPass} from '../alpha-aware-gtao';

type AvenueFrame = {
  point(station:number,lateral:number,y?:number):THREE.Vector3;
  direction:THREE.Vector3;
  normal:THREE.Vector3;
  length?:number;
};
type RealismOptions = {exposure?:number;shadowMapSize?:number;canopy?:boolean};

/** Restore the survey scene's photographic materials and illumination in the
 * robot fork. This module never changes map geometry or physics collision data.
 * All vegetation placement and edge weathering remain visual hypotheses.
 */
export async function applyCentralAvenueRealism(
  scene:THREE.Scene,
  renderer:THREE.WebGLRenderer,
  frame:AvenueFrame,
  options:RealismOptions={},
) {
  if(scene.userData.centralAvenueRealism)return scene.userData.centralAvenueRealism;
  const detail=new THREE.Group();
  detail.name='Fork Central Avenue · visual surface and daylight restoration';
  scene.add(detail);
  const evidence={
    revision:1,
    lighting:'Loading',
    canopy:false,
    visibility:[] as string[],
    failures:[] as string[],
    geometry:'Stored map, asphalt crown and building footprints unchanged; no new collision obstacles',
    source:'Existing photo-informed Central Avenue geometry; CC0 Poly Haven material and sky assets',
    limits:'Illustrative HDR sky, inferred tree species/placements and surface weathering. This is not a surveyed digital twin or photogrammetric reconstruction.',
  };
  scene.userData.centralAvenueRealism=evidence;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=options.exposure??.9;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate=true;

  const loaders=new THREE.LoadingManager();
  const textures=new THREE.TextureLoader(loaders);
  const anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  // Replace only the fork's untextured fallback plane. Road and property ground
  // meshes retain their specialized material shaders and original elevations.
  for(const object of scene.children){
    if(!(object instanceof THREE.Mesh)||!(object.geometry instanceof THREE.PlaneGeometry))continue;
    if(object.geometry.parameters.width<1000||Array.isArray(object.material))continue;
    const material=object.material;
    if(!(material instanceof THREE.MeshStandardMaterial))continue;
    const texture=(suffix:string,srgb=false)=>{
      const map=textures.load(`/assets/textures/concrete_floor_worn_001_${suffix}.jpg`);
      map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(520,520);map.anisotropy=anisotropy;
      if(srgb)map.colorSpace=THREE.SRGBColorSpace;
      return map;
    };
    material.map=texture('Diffuse',true);material.normalMap=texture('nor_gl');material.roughnessMap=texture('Rough');
    material.color.setHex(0xd9cbb1);material.normalScale.set(.16,.16);material.roughness=1;
    material.needsUpdate=true;object.receiveShadow=true;
    object.name='Fork mineral ground · CC0 scan, inferred soil pigment';
  }

  const buildings=scene.children.find(object=>object instanceof THREE.Group&&object.userData.buildingCount) as THREE.Group|undefined;
  const visibility=buildings?[
    installAvinashVisibility(buildings).then(()=>evidence.visibility.push('Avinash geometry-derived indirect occlusion')),
    installEncaarpusCar(buildings).then(()=>installEncaarpusOcclusion(buildings)).then(()=>evidence.visibility.push('Encaarpus geometry-derived indirect occlusion')),
  ]:[];

  const sky=new RGBELoader().loadAsync('/assets/textures/central-daylight.hdr').then(source=>{
    source.mapping=THREE.EquirectangularReflectionMapping;
    const daylight=prepareCentralDaylight(source,renderer);
    scene.environment=daylight.environment;scene.background=daylight.background;
    scene.environmentIntensity=1;scene.backgroundIntensity=1;
    scene.environmentRotation.set(0,daylight.rotation,0);scene.backgroundRotation.copy(scene.environmentRotation);
    scene.fog=new THREE.FogExp2(0xc8d6dc,.0012);
    // Solar radiance removed from IBL becomes one shadow-casting light. The
    // previous hemisphere must be disabled to avoid flattening every recess.
    const lights:THREE.DirectionalLight[]=[];
    scene.traverse(object=>{
      if(object instanceof THREE.HemisphereLight)object.intensity=0;
      if(object instanceof THREE.DirectionalLight)lights.push(object);
    });
    const sun=lights.shift()??new THREE.DirectionalLight();
    lights.forEach(light=>{light.intensity=0;});
    const center=frame.point(44,0,1);
    sun.name='Fork solar light · separated from CC0 HDR';
    sun.target.position.copy(center);sun.position.copy(center).addScaledVector(daylight.direction,100);
    sun.intensity=daylight.intensity;sun.color.copy(daylight.color);sun.castShadow=true;
    sun.shadow.mapSize.setScalar(options.shadowMapSize??2048);
    Object.assign(sun.shadow.camera,{left:-29,right:29,top:29,bottom:-29,near:.5,far:220});
    sun.shadow.camera.updateProjectionMatrix();sun.shadow.normalBias=.012;sun.shadow.bias=-.00008;sun.shadow.radius=2;
    if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}
    scene.add(sun,sun.target);
    evidence.lighting='Solar-separated CC0 daylight HDR; one coherent directional shadow; ACES exposure '+renderer.toneMappingExposure;
    detail.userData.daylight=daylight.evidence;
  });
  const canopy=options.canopy===false?Promise.resolve():new GLTFLoader().loadAsync('/assets/station-broadleaf.glb').then(gltf=>{
    const trees=buildCentralAvenueCanopy(gltf.scene,{length:frame.length??215,point:frame.point});
    trees.position.y=-.045;
    detail.add(trees);evidence.canopy=true;
  });
  const results=await Promise.allSettled([sky,canopy,...visibility]);
  results.forEach((result,index)=>{
    if(result.status==='rejected'){
      const message=`${['daylight','canopy','avinash visibility','encaarpus visibility'][index]}: ${String(result.reason)}`;
      evidence.failures.push(message);console.warn('Central Avenue realism:',message);
    }
  });
  scene.updateMatrixWorld(true);renderer.shadowMap.needsUpdate=true;
  return evidence;
}

/** Optional final render pipeline. Call this render() instead of the direct
 * renderer.render(scene,camera) so local contacts receive modest screen-space AO.
 * Geometry alpha cutouts are preserved by the existing survey pass. Resize is
 * detected from the renderer, including cinema/fullscreen and DPR changes.
 */
export function createCentralAvenueRender(
  scene:THREE.Scene,
  renderer:THREE.WebGLRenderer,
  camera:THREE.PerspectiveCamera,
) {
  const composer=new EffectComposer(renderer);
  const size=renderer.getSize(new THREE.Vector2());
  const ao=new AlphaAwareGTAOPass(scene,camera,size.x,size.y);
  ao.updateGtaoMaterial({radius:.42,thickness:.28,distanceExponent:2,distanceFallOff:1,samples:8});
  ao.updatePdMaterial({radius:2,samples:6});
  ao.blendIntensity=.34;
  composer.addPass(new RenderPass(scene,camera));composer.addPass(ao);composer.addPass(new OutputPass());composer.addPass(new SMAAPass());
  let width=0,height=0,pixelRatio=0;
  const render=()=>{
    renderer.getSize(size);
    const ratio=renderer.getPixelRatio();
    if(size.x!==width||size.y!==height||ratio!==pixelRatio){
      width=size.x;height=size.y;pixelRatio=ratio;
      composer.setPixelRatio(ratio);composer.setSize(width,height);
    }
    composer.render();
  };
  return {render,composer,ao,dispose:()=>{composer.passes.forEach(pass=>pass.dispose());composer.dispose();}};
}
