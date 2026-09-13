import type {MeshStandardMaterial} from 'three';

// The source resolves a broad stained fascia, but does not calibrate its size.
export const RAMS_FASCIA={top:3.18,bottom:2.68,front:.185};

/** Original pigment variation, separate from the scene's shadows and visibility. */
export function applyRamsWeathering(material:MeshStandardMaterial,profile:'wall'|'fascia'){
 const strength={value:1};
 material.userData.weathering={strength,profile,status:'Original analytic pigment. Source supports patchy fascia deposits; scale, coverage and color remain inferred.'};
 material.onBeforeCompile=shader=>{
  shader.uniforms.ramsWeatheringStrength=strength;
  shader.vertexShader='varying vec3 ramsLocal;\nvarying vec3 ramsNormal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nramsLocal=position; ramsNormal=normal;');
  shader.fragmentShader=`
   varying vec3 ramsLocal;
   varying vec3 ramsNormal;
   uniform float ramsWeatheringStrength;
   float rpHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float rpNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(rpHash(i),rpHash(i+vec2(1,0)),f.x),mix(rpHash(i+vec2(0,1)),rpHash(i+vec2(1,1)),f.x),f.y);}
   float rpDeposit(vec3 p){
    // Only the street-facing skin receives the photographed fascia pattern.
    // Excludes the plain returns, recess backs, hoods and distant boundary wall.
    float face=step(.9,ramsNormal.z)*step(-.001,p.z)*step(p.z,.20);
    float broad=rpNoise(vec2(p.x*2.37,p.y*5.8));
    float fine=rpNoise(vec2(p.x*31.3,p.y*41.1));
    float grain=rpNoise(vec2(p.x*157.3,p.y*173.1));
    float channels=rpNoise(vec2(p.x*17.1,5.7));
    float down=${RAMS_FASCIA.bottom.toFixed(2)}-p.y;
    float runoff=step(0.,down)*(1.-smoothstep(.01,.07+.30*channels,down));
    float deposits=smoothstep(.34,.64,broad*.52+fine*.30+grain*.18);
    ${profile==='fascia'
      ? 'return face*(.025+deposits*.65+grain*.035);'
      : 'return face*runoff*(.04+channels*.17)*(.35+deposits*.65);'}
   }
  `+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float ramsDeposit=rpDeposit(ramsLocal)*ramsWeatheringStrength;
   diffuseColor.rgb*=vec3(1.)-ramsDeposit*vec3(.92,.85,.77);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=clamp(roughnessFactor+rpDeposit(ramsLocal)*ramsWeatheringStrength*.10,0.,1.);
  `);
 };
 material.customProgramCacheKey=()=>`rams-original-deposits-2-${profile}`;
}
