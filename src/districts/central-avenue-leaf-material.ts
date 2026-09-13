import * as THREE from 'three';

/** Central-only optical approximation; neither tree species nor leaf spectra were measured. */
export function centralAvenueLeafMaterial(source:THREE.Material,options:{restorePigment?:boolean;transmissionRatio?:number}={}) {
  if(!(source instanceof THREE.MeshStandardMaterial))return source;
  const material=source.clone();
  const restorePigment=options.restorePigment??true;
  const transmissionRatio=THREE.MathUtils.clamp(options.transmissionRatio??.6,0,1);
  material.name=source.name+' · Central Avenue thin leaf';
  material.userData={...source.userData,centralLeaf:{revision:1,restorePigment,transmissionRatio,
    pigment:'Undo the explicit 76% grayscale mix and (.72,.88,.91) encoded tint in build_station_tree.py; retain donor texture variation and vertex tones.',
    transport:'Two-sided Lambert diffuse transmission from shadowed direct lights and the opposite sky hemisphere. Per-channel reflection plus transmission is bounded below one minus dielectric F0.',
    inference:'Transmission/reflection ratio is an optical prior, not measured local foliage. No inter-leaf multiple scattering or translucent shadow maps.'}};
  material.onBeforeCompile=shader=>{
    shader.uniforms.centralLeafTransmissionRatio={value:transmissionRatio};
    const replace=(needle:string,value:string)=>{
      if(!shader.fragmentShader.includes(needle))throw new Error('Central leaf shader hook missing: '+needle);
      shader.fragmentShader=shader.fragmentShader.replace(needle,value);
    };
    if(restorePigment)replace('#include <map_fragment>',`
#ifdef USE_MAP
  vec4 sampledDiffuseColor=texture2D(map,vMapUv);
  // The generator applied this invertible color edit in encoded sRGB space.
  vec3 unmixed=sRGBTransferOETF(sampledDiffuseColor).rgb/vec3(.72,.88,.91);
  float originalLuminance=dot(unmixed,vec3(.2126,.7152,.0722));
  vec3 donorEncoded=clamp((unmixed-vec3(.76*originalLuminance))/.24,0.0,1.0);
  sampledDiffuseColor.rgb=sRGBTransferEOTF(vec4(donorEncoded,1.0)).rgb;
  diffuseColor*=sampledDiffuseColor;
#endif`);
    replace('#include <lights_physical_pars_fragment>',`#include <lights_physical_pars_fragment>
uniform float centralLeafTransmissionRatio;
vec3 centralLeafTransmittance(const in PhysicalMaterial material) {
  vec3 remaining=max(vec3(0.0),vec3(1.0)-material.specularColor-material.diffuseContribution);
  return min(material.diffuseContribution*centralLeafTransmissionRatio,remaining);
}
void RE_Direct_CentralLeaf(const in IncidentLight directLight,const in vec3 geometryPosition,const in vec3 geometryNormal,const in vec3 geometryViewDir,const in vec3 geometryClearcoatNormal,const in PhysicalMaterial material,inout ReflectedLight reflectedLight) {
  RE_Direct_Physical(directLight,geometryPosition,geometryNormal,geometryViewDir,geometryClearcoatNormal,material,reflectedLight);
  // The incoming light already includes distance attenuation and shadow visibility.
  float backCosine=max(0.0,-dot(geometryNormal,directLight.direction));
  reflectedLight.directDiffuse+=backCosine*directLight.color*BRDF_Lambert(centralLeafTransmittance(material));
}
#undef RE_Direct
#define RE_Direct RE_Direct_CentralLeaf`);
    replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
#if defined(USE_ENVMAP) && defined(ENVMAP_TYPE_CUBE_UV)
  // This is a separate transmitted lobe, not a second reflected sky contribution.
  reflectedLight.indirectDiffuse+=getIBLIrradiance(-geometryNormal)*BRDF_Lambert(centralLeafTransmittance(material));
#endif`);
  };
  material.customProgramCacheKey=()=>`central-leaf-v1:${restorePigment}:${transmissionRatio}`;
  return material;
}
