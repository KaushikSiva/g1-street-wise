// Export real existing street geometry, using flat material colors for MuJoCo.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1200,height:850}});
await page.goto('http://127.0.0.1:5188/?robot=1');await page.waitForFunction(()=>window.forkRobot?.ready,null,{timeout:60000});
const result=await page.evaluate(async()=>{
 const THREE=await import('/node_modules/three/build/three.module.js');
 const {scene,g1}=window.forkRobot;const frame=scene.frame;const origin=frame.point(75,0,.07);
 const transform=new THREE.Matrix4().makeBasis(frame.direction,frame.normal.clone().negate(),new THREE.Vector3(0,1,0));transform.setPosition(origin);transform.invert();
 const groups=new Map();let meshes=0;
 scene.scene.updateMatrixWorld(true);
 scene.scene.traverse(o=>{
  if(!o.isMesh||o.isSkinnedMesh||!o.visible)return;
  let staticVan=false;for(let parent=o;parent;parent=parent.parent)if(parent.parent===g1.group.parent&&Math.abs(parent.position.x+3.1)<.001&&Math.abs(parent.position.y+2)<.001)staticVan=true;
  for(let parent=o;parent;parent=parent.parent)if((parent===g1.group.parent&&!staticVan)||parent===scene.stage||!parent.visible)return;
  const geo=o.geometry;if(!geo?.attributes.position)return;
  const n=o.isInstancedMesh?o.count:1;
  for(let inst=0;inst<n;inst++){
   const matrix=o.matrixWorld.clone();if(o.isInstancedMesh){const im=new THREE.Matrix4();o.getMatrixAt(inst,im);matrix.multiply(im);}
   matrix.premultiply(transform);geo.computeBoundingSphere();const sphere=geo.boundingSphere.clone().applyMatrix4(matrix);
   if(sphere.center.length()-sphere.radius>38||sphere.radius>100)continue;
   const materials=Array.isArray(o.material)?o.material:[o.material];const ranges=geo.groups.length?geo.groups:[{start:0,count:geo.index?.count||geo.attributes.position.count,materialIndex:0}];
   for(const range of ranges){const mat=materials[range.materialIndex||0];if(!mat||mat.opacity<.6)continue;
    const color=mat.color?.clone()||new THREE.Color(.5,.5,.5);if(mat.alphaTest>.1&&mat.map)color.setRGB(.15,.25,.08);if(o.isInstancedMesh&&o.instanceColor){const c=new THREE.Color();o.getColorAt(inst,c);color.multiply(c);}
    const rgb=[color.r,color.g,color.b].map(v=>Math.round(v*100)/100),key=rgb.join(',');let group=groups.get(key);if(!group){group={color:rgb,vertices:[],faces:[]};groups.set(key,group);}
    const end=Math.min(range.start+range.count,geo.index?.count||geo.attributes.position.count);const mapping=new Map();
    for(let i=range.start;i+2<end;i+=3){const ids=[];for(let j=0;j<3;j++){const idx=geo.index?geo.index.getX(i+j):i+j;if(!mapping.has(idx)){const v=new THREE.Vector3().fromBufferAttribute(geo.attributes.position,idx).applyMatrix4(matrix);mapping.set(idx,group.vertices.length/3);group.vertices.push(...v.toArray().map(x=>Math.round(x*10000)/10000));}ids.push(mapping.get(idx));}group.faces.push(...ids);}
   }meshes++;
  }
 });
 return {source:'Actual Chennai Three.js geometry within 38 m of station 75, transformed into the robot physics coordinate system. Flat material colors; textures and browser postprocessing are not transferred. Decorative only, no collision changes.',meshes,groups:[...groups.values()]};
});
await fs.mkdir('.fork-runs/robot',{recursive:true});await fs.writeFile('.fork-runs/robot/chennai-native.json',JSON.stringify(result));console.log({meshes:result.meshes,materials:result.groups.length,vertices:result.groups.reduce((n,g)=>n+g.vertices.length/3,0)});await browser.close();
