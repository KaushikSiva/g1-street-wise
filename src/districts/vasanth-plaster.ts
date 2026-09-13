import * as THREE from 'three';

/** Original pigment/deposit variation; deliberately contains no baked lighting. */
export function applyVasanthWeathering(material:THREE.MeshStandardMaterial,profile:'wall'|'trim'|'base'){
  const strength={value:1};
  material.userData.weathering={strength,profile,status:'Original analytic deposit prior. No photo pixels; extent and pigment uncalibrated.'};
  material.onBeforeCompile=shader=>{
    shader.uniforms.vasanthWeatheringStrength=strength;
    shader.vertexShader='varying vec3 vasanthLocal;\nvarying vec3 vasanthLocalNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvasanthLocal=position;\nvasanthLocalNormal=normal;');
    shader.fragmentShader=`
      varying vec3 vasanthLocal;
      varying vec3 vasanthLocalNormal;
      uniform float vasanthWeatheringStrength;
      float vvHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float vvNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(vvHash(i),vvHash(i+vec2(1,0)),f.x),mix(vvHash(i+vec2(0,1)),vvHash(i+vec2(1,1)),f.x),f.y);}
      float vvRunoff(float ledge,vec3 p){
        // Descending streaks start beneath physical bands; they are pigment,
        // not a substitute for shadows or local ambient visibility.
        float along=p.x-p.z,down=ledge-p.y;
        float channels=smoothstep(.40,.82,vvNoise(vec2(along*12.7,ledge*4.3)));
        float length=.10+.55*vvNoise(vec2(along*3.4,ledge));
        return step(0.,down)*(1.-smoothstep(.025,length,down))*(.25+.75*channels);
      }
      float vvDeposit(vec3 p){
        float fine=vvNoise(p.xz*1.8+vec2(p.y*.31,0.));
        float broad=vvNoise(vec2(p.x*.24-p.z*.21,p.y*.37));
        float foot=(1.-smoothstep(.02,.46,p.y))*(.12+.11*fine);
        // The plain, unobserved south/rear walls have no modeled floor ledges.
        // Do not paint phantom runoff bands onto those faces or roof surfaces.
        float observedFace=step(.5,max(vasanthLocalNormal.x,vasanthLocalNormal.z));
        float runoff=(vvRunoff(3.0,p)+vvRunoff(6.1,p)+vvRunoff(9.2,p)+vvRunoff(12.1,p))*observedFace;
        return clamp(foot+runoff*${profile==='trim'?'.17':'.23'}+broad*${profile==='base'?'.11':'.065'},0.,.38);
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float vvAmount=vvDeposit(vasanthLocal)*vasanthWeatheringStrength;
      diffuseColor.rgb*=vec3(1.)-vvAmount*vec3(.85,.80,.72);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=clamp(roughnessFactor+vvDeposit(vasanthLocal)*vasanthWeatheringStrength*.12,0.,1.);
    `);
  };
  material.customProgramCacheKey=()=>`vasanth-original-deposits-1-${profile}`;
}
