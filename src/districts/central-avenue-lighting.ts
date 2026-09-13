import * as THREE from 'three';

/** Separate the HDR solar core from unshadowed image-based illumination.
 * Keep the original full sky for the background. Integrate the removed radiance
 * with pixel solid angles into one shadow-casting directional light.
 */
export function prepareCentralDaylight(source:THREE.DataTexture,renderer:THREE.WebGLRenderer) {
  const {width,height,data}=source.image as {width:number;height:number;data:Uint16Array};
  if(source.type!==THREE.HalfFloatType || data.length!==width*height*4)throw new Error('Central daylight requires half-float RGBA HDR data');
  const read=(i:number)=>THREE.DataUtils.fromHalfFloat(data[i]);
  let brightest=-Infinity,peak=0;
  for(let i=0;i<width*height;i++){const l=.2126*read(i*4)+.7152*read(i*4+1)+.0722*read(i*4+2);if(l>brightest){brightest=l;peak=i;}}
  const phi=((peak%width+.5)/width-.5)*2*Math.PI,theta=(Math.floor(peak/width)+.5)/height*Math.PI;
  const rawDirection=new THREE.Vector3(Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi));
  const radius=3*Math.PI/180,ringRadius=5*Math.PI/180,cosRadius=Math.cos(radius),cosRing=Math.cos(ringRadius);
  const solar:{i:number;solidAngle:number}[]=[],ringRGB=[0,0,0],removedRGB=[0,0,0];let ringWeight=0;
  const columns=Array.from({length:width},(_,x)=>{const a=((x+.5)/width-.5)*Math.PI*2;return [Math.cos(a),Math.sin(a)];});
  for(let y=0;y<height;y++){
    const a=(y+.5)/height*Math.PI,s=Math.sin(a),c=Math.cos(a),solidAngle=s*2*Math.PI/width*Math.PI/height;
    for(let x=0;x<width;x++){
      const dot=s*(columns[x][0]*rawDirection.x+columns[x][1]*rawDirection.z)+c*rawDirection.y;
      if(dot<cosRing)continue;
      const i=(y*width+x)*4;
      if(dot>cosRadius)solar.push({i,solidAngle});
      else {ringWeight+=solidAngle;for(let k=0;k<3;k++)ringRGB[k]+=read(i+k)*solidAngle;}
    }
  }
  const fillRGB=ringRGB.map(v=>v/ringWeight),filtered=data.slice();
  for(const {i,solidAngle}of solar)for(let k=0;k<3;k++){
    const replacement=Math.min(read(i+k),fillRGB[k]);
    removedRGB[k]+=(read(i+k)-replacement)*solidAngle;
    filtered[i+k]=THREE.DataUtils.toHalfFloat(replacement);
  }
  const diffuse=new THREE.DataTexture(filtered,width,height,THREE.RGBAFormat,THREE.HalfFloatType);
  diffuse.mapping=THREE.EquirectangularReflectionMapping;diffuse.colorSpace=THREE.LinearSRGBColorSpace;
  diffuse.flipY=source.flipY;diffuse.minFilter=diffuse.magFilter=THREE.LinearFilter;diffuse.needsUpdate=true;
  const generator=new THREE.PMREMGenerator(renderer),target=generator.fromEquirectangular(diffuse);generator.dispose();diffuse.dispose();
  // Front/side shadow direction inferred from the reference, not a solar-date fit.
  const desiredAzimuth=Math.atan2(.57,-.82),rotation=phi-desiredAzimuth;
  const direction=rawDirection.clone().applyAxisAngle(new THREE.Vector3(0,1,0),rotation);
  const intensity=Math.max(...removedRGB),color=new THREE.Color().setRGB(...removedRGB.map(v=>v/intensity) as [number,number,number]);
  return {background:source,environment:target.texture,target,direction,rotation,intensity,color,
    evidence:{source:'https://polyhaven.com/a/kloofendal_38d_partly_cloudy_puresky',license:'CC0',authors:['Greg Zaal','Jarod Guest'],size:[width,height],peakPixel:[peak%width,Math.floor(peak/width)],rawDirection:rawDirection.toArray(),direction:direction.toArray(),rotationY:rotation,solarRadiusDegrees:3,backgroundAnnulusDegrees:[3,5],solarPixels:solar.length,annulusRGB:fillRGB,removedIntegratedRGB:removedRGB,lightIntensity:intensity,lightColor:color.toArray(),limits:'Illustrative sky, not captured in Chennai. Azimuth inferred from facade shadows; solar elevation comes from this HDR, not a calibrated date or time. A 3-degree solar/halo core is approximated by a directional light; indirect occlusion and bounce remain incomplete.'}};
}
