// Transfer the actual browser street meshes, material albedo maps and UVs to MuJoCo.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1200,height:850}});
await page.goto('http://127.0.0.1:5188/?robot=1');await page.waitForFunction(()=>window.forkRobot?.ready,null,{timeout:60000});await page.waitForTimeout(2000);
const appearanceOnly=process.argv.includes('--appearance-only'),buildingsOnly=process.argv.includes('--buildings-only');
const result=JSON.parse(await page.evaluate(async({appearanceOnly,buildingsOnly})=>{
 const THREE=await import('/node_modules/three/build/three.module.js');
 const {scene,g1}=window.forkRobot;const frame=scene.frame;const origin=frame.point(75,0,.07);
 const transform=new THREE.Matrix4().makeBasis(frame.direction,frame.normal.clone().negate(),new THREE.Vector3(0,1,0));transform.setPosition(origin);transform.invert();
 const lighting={source:'Direction and chromaticity from the actual browser solar-separated HDR light; native OpenGL intensity/ambient approximation.',sun:null,groundColor:[.44,.40,.32]};
 scene.scene.updateMatrixWorld(true);scene.scene.traverse(o=>{if(o.isDirectionalLight&&o.intensity>0){const position=o.getWorldPosition(new THREE.Vector3()),target=o.target.getWorldPosition(new THREE.Vector3());lighting.sun={direction:target.sub(position).normalize().transformDirection(transform).toArray(),color:o.color.toArray(),intensity:o.intensity};}if(o.isMesh&&o.geometry.type==='PlaneGeometry'&&o.geometry.parameters.width>=1500)lighting.groundColor=o.material.color.clone().convertLinearToSRGB().toArray();});
 const albedoScene=new THREE.Scene(),albedoRenderer=new THREE.WebGLRenderer({antialias:false,alpha:true,preserveDrawingBuffer:true});
 albedoRenderer.setSize(4096,512,false);albedoRenderer.setClearColor(0,0);albedoRenderer.toneMapping=THREE.NoToneMapping;albedoRenderer.outputColorSpace=THREE.SRGBColorSpace;
 scene.scene.updateMatrixWorld(true);const bakedMaterials=[];
 scene.scene.traverse(o=>{if(!o.isMesh||!/Central Avenue asphalt|Central Avenue compacted shoulder/.test(o.name))return;const source=o.material;
  const material=new THREE.MeshBasicMaterial({map:source.map,color:source.color,side:THREE.DoubleSide});material.onBeforeCompile=source.onBeforeCompile;material.customProgramCacheKey=source.customProgramCacheKey;
  const geometry=o.geometry.clone();geometry.applyMatrix4(o.matrixWorld.clone().premultiply(transform));const mesh=new THREE.Mesh(geometry,material);albedoScene.add(mesh);bakedMaterials.push(source.name||o.name);
 });
 const atlasCamera=new THREE.OrthographicCamera(-46,46,5,-5,.1,200);atlasCamera.position.set(0,0,100);atlasCamera.up.set(0,1,0);atlasCamera.lookAt(0,0,0);albedoRenderer.render(albedoScene,atlasCamera);
 const appearanceAtlas={name:'road-verge-unlit',png:albedoRenderer.domElement.toDataURL('image/png').split(',')[1],width:4096,height:512,bounds:[-46,46,-5,5],materials:[...new Set(bakedMaterials)],source:'Actual Three.js asphalt stochastic sampling and verge mineral pigment shaders rendered without lights or shadows; original map geometry/UVs, no invented surface detail.'};
 albedoScene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});albedoRenderer.dispose();
 if(appearanceOnly)return JSON.stringify({appearanceAtlas,lighting});
 const groups=new Map(),textures=new Map(),texturePixels=new Map(),warnings=[];let meshes=0;
 function textureFor(mat){
  const map=mat.map;if(!map)return null;const key=map.uuid+(mat.userData.centralLeaf?.restorePigment?'_leaf':'');if(textures.has(key))return key;
  try{const image=map.image;if(!image?.width||!image?.height)return null;const scale=Math.min(1,1024/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);const ctx=canvas.getContext('2d');
   if(image.data){const source=document.createElement('canvas');source.width=image.width;source.height=image.height;const c=source.getContext('2d'),pixels=c.createImageData(image.width,image.height),channels=image.data.length/(image.width*image.height);for(let i=0;i<image.width*image.height;i++){for(let j=0;j<3;j++)pixels.data[4*i+j]=image.data[i*channels+Math.min(j,channels-1)];pixels.data[4*i+3]=channels===4?image.data[i*channels+3]:255;}c.putImageData(pixels,0,0);ctx.drawImage(source,0,0,canvas.width,canvas.height);}else ctx.drawImage(image,0,0,canvas.width,canvas.height);
   if(mat.userData.centralLeaf?.restorePigment){const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),p=pixels.data;for(let i=0;i<p.length;i+=4){const unmixed=[p[i]/255/.72,p[i+1]/255/.88,p[i+2]/255/.91],lum=unmixed[0]*.2126+unmixed[1]*.7152+unmixed[2]*.0722;for(let j=0;j<3;j++)p[i+j]=255*Math.max(0,Math.min(1,(unmixed[j]-.76*lum)/.24));}ctx.putImageData(pixels,0,0);}
   texturePixels.set(key,{data:ctx.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height,flipY:map.flipY});textures.set(key,{id:key,png:canvas.toDataURL('image/png').split(',')[1],flipY:map.flipY,width:canvas.width,height:canvas.height});return key;
  }catch(e){warnings.push(`Texture ${mat.name}: ${e.message}`);return null;}
 }
 scene.scene.updateMatrixWorld(true);
 scene.scene.traverse(o=>{
  if(!o.isMesh||o.isSkinnedMesh||!o.visible)return;
  if(buildingsOnly&&!/Mapped building shells|Flat roof surfaces/.test(o.name))return;
  let staticVan=false;for(let parent=o;parent;parent=parent.parent)if(parent.parent===g1.group.parent&&Math.abs(parent.position.x+3.1)<.001&&Math.abs(parent.position.y+2)<.001)staticVan=true;
  for(let parent=o;parent;parent=parent.parent)if((parent===g1.group.parent&&!staticVan)||parent===scene.stage||!parent.visible)return;
  const geo=o.geometry;if(!geo?.attributes.position)return;
  for(let inst=0;inst<(o.isInstancedMesh?o.count:1);inst++){
   const matrix=o.matrixWorld.clone();if(o.isInstancedMesh){const im=new THREE.Matrix4();o.getMatrixAt(inst,im);matrix.multiply(im);}matrix.premultiply(transform);
   geo.computeBoundingSphere();const sphere=geo.boundingSphere.clone().applyMatrix4(matrix);if(sphere.center.length()-sphere.radius>38||(sphere.radius>100&&!/Central Avenue asphalt|Central Avenue compacted shoulder|Mapped building shells|Flat roof surfaces/.test(o.name)))continue;
   const normals=new THREE.Matrix3().getNormalMatrix(matrix),materials=Array.isArray(o.material)?o.material:[o.material],ranges=geo.groups.length?geo.groups:[{start:0,count:geo.index?.count||geo.attributes.position.count,materialIndex:0}];
   for(const range of ranges){const mat=materials[range.materialIndex||0];if(!mat||mat.opacity<.6)continue;
    const texture=geo.attributes.uv?textureFor(mat):null,color=mat.color?.clone()||new THREE.Color(.5,.5,.5);if(o.isInstancedMesh&&o.instanceColor){const c=new THREE.Color();o.getColorAt(inst,c);color.multiply(c);}
    // Match the displayed albedo scale; MuJoCo's fixed-function viewer lacks Three's tone map.
    color.convertLinearToSRGB();const rgb=[color.r,color.g,color.b].map(v=>Math.round(v*1000)/1000);
    if(mat.alphaTest>.1&&!texture)rgb.splice(0,3,.20,.34,.12);
    const key=[mat.uuid,texture,...rgb].join(',');let group=groups.get(key);if(!group){group={name:mat.name||o.name,color:rgb,texture,roughness:mat.roughness??.8,vertices:[],normals:[],uvs:[],faces:[]};groups.set(key,group);}
    const end=Math.min(range.start+range.count,geo.index?.count||geo.attributes.position.count),mapping=new Map();mat.map?.updateMatrix();
    for(let i=range.start;i+2<end;i+=3){
     const sourceIds=[0,1,2].map(j=>geo.index?geo.index.getX(i+j):i+j);
     if(sphere.radius>100){const center=new THREE.Vector3();for(const idx of sourceIds)center.add(new THREE.Vector3().fromBufferAttribute(geo.attributes.position,idx).applyMatrix4(matrix));center.multiplyScalar(1/3);if(Math.hypot(center.x,center.y)>(/Mapped building shells|Flat roof surfaces/.test(o.name)?90:46))continue;}
     if(mat.alphaTest>.1&&texture){const pixels=texturePixels.get(texture),uv=new THREE.Vector2();for(const idx of sourceIds)uv.add(new THREE.Vector2().fromBufferAttribute(geo.attributes.uv,idx));uv.multiplyScalar(1/3).applyMatrix3(mat.map.matrix);const u=((uv.x%1)+1)%1,v=((uv.y%1)+1)%1,x=Math.min(pixels.width-1,Math.floor(u*pixels.width)),y=Math.min(pixels.height-1,Math.floor((pixels.flipY?1-v:v)*pixels.height));if(pixels.data[4*(y*pixels.width+x)+3]/255<Math.max(.45,mat.alphaTest))continue;}
     const ids=[];for(let j=0;j<3;j++){const idx=geo.index?geo.index.getX(i+j):i+j;if(!mapping.has(idx)){const v=new THREE.Vector3().fromBufferAttribute(geo.attributes.position,idx).applyMatrix4(matrix);mapping.set(idx,group.vertices.length/3);group.vertices.push(...v.toArray().map(x=>Math.round(x*1e5)/1e5));const n=geo.attributes.normal?new THREE.Vector3().fromBufferAttribute(geo.attributes.normal,idx).applyMatrix3(normals).normalize():new THREE.Vector3(0,0,1);group.normals.push(...n.toArray().map(x=>Math.round(x*1e5)/1e5));const uv=geo.attributes.uv?new THREE.Vector2().fromBufferAttribute(geo.attributes.uv,idx):new THREE.Vector2();if(mat.map)uv.applyMatrix3(mat.map.matrix);group.uvs.push(Math.round(uv.x*1e5)/1e5,Math.round(uv.y*1e5)/1e5);}ids.push(mapping.get(idx));}if(matrix.determinant()<0)ids.reverse();group.faces.push(...ids);}
   }meshes++;
  }
 });
 return JSON.stringify({source:'Actual Chennai Three.js meshes intersecting the 38 m neighborhood of station 75, with nearby merged building shells retained to 90 m for the street backdrop, original albedo texture images and transformed UVs. Browser shader-only weathering, normal maps, GTAO and lighting are not reproduced. Decorative only, no collision changes.',appearanceAtlas,lighting,meshes,warnings,textures:[...textures.values()],groups:[...groups.values()]});
},{appearanceOnly,buildingsOnly}));
if(appearanceOnly){const data=JSON.parse(await fs.readFile('.fork-runs/robot/chennai-native.json','utf8'));data.appearanceAtlas=result.appearanceAtlas;data.lighting=result.lighting;await fs.writeFile('.fork-runs/robot/chennai-native.json',JSON.stringify(data));console.log({appearanceAtlas:result.appearanceAtlas.materials,resolution:[4096,512]});await browser.close();process.exit(0);}
if(buildingsOnly){const data=JSON.parse(await fs.readFile('.fork-runs/robot/chennai-native.json','utf8'));data.source=result.source;data.groups=data.groups.filter(g=>!/Mapped building shells|Flat roof surfaces/.test(g.name)).concat(result.groups);data.textures=data.textures.concat(result.textures);data.appearanceAtlas=result.appearanceAtlas;data.lighting=result.lighting;await fs.writeFile('.fork-runs/robot/chennai-native.json',JSON.stringify(data));console.log({localBuildingGroups:result.groups.length,vertices:result.groups.reduce((n,g)=>n+g.vertices.length/3,0)});await browser.close();process.exit(0);}
await fs.mkdir('.fork-runs/robot',{recursive:true});await fs.writeFile('.fork-runs/robot/chennai-native.json',JSON.stringify(result));console.log({meshes:result.meshes,materials:result.groups.length,textures:result.textures.length,warnings:result.warnings,vertices:result.groups.reduce((n,g)=>n+g.vertices.length/3,0)});await browser.close();
