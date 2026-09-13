// Transfer the existing Rocketbox FBX skin, texture and walking bones to MuJoCo.
import {chromium} from '@playwright/test';import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();
await page.goto('http://127.0.0.1:5188/?robot=1');await page.waitForFunction(()=>window.forkRobot?.ready,null,{timeout:60000});
const data=await page.evaluate(async()=>{
 const THREE=await import('/node_modules/three/build/three.module.js');const r=window.forkRobot;r.select('after',20002);r.seek(0);const root=r.human,physical=root.parent;
 const localize=()=>{physical.updateMatrixWorld(true);root.updateMatrixWorld(true);return new THREE.Matrix4().makeTranslation(-root.position.x,-root.position.y,0).multiply(physical.matrixWorld.clone().invert());};
 const meshes=[];root.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
 const output=[];
 for(const mesh of meshes){
  const transform=localize().multiply(mesh.matrixWorld).multiply(mesh.bindMatrixInverse);
  const vertexTransform=transform.clone().multiply(mesh.bindMatrix),position=mesh.geometry.attributes.position,indices=mesh.geometry.index,uv=mesh.geometry.attributes.uv,skinI=mesh.geometry.attributes.skinIndex,skinW=mesh.geometry.attributes.skinWeight;
  const vertices=[],texcoord=[],faces=[];const bones=mesh.skeleton.bones.map((b,i)=>{const m=transform.clone().multiply(mesh.skeleton.boneInverses[i].clone().invert()),pos=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();m.decompose(pos,q,scale);return {name:b.name,bindscale:scale.toArray(),bindpos:pos.toArray(),bindquat:[q.w,q.x,q.y,q.z],vertices:[],weights:[]};});
  for(let i=0;i<position.count;i++){vertices.push(...new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(vertexTransform).toArray());texcoord.push(uv?.getX(i)||0,uv?.getY(i)||0);for(let j=0;j<4;j++){const w=skinW.getComponent(i,j);if(w>0){const b=bones[skinI.getComponent(i,j)];b.vertices.push(i);b.weights.push(w);}}}
  for(let i=0;i<(indices?.count||position.count);i++)faces.push(indices?indices.getX(i):i);
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];const surfaces=[];
  for(const group of mesh.geometry.groups.length?mesh.geometry.groups:[{start:0,count:faces.length,materialIndex:0}]){
    const material=materials[group.materialIndex||0];let texture=null;
    if(material.map?.image){const im=material.map.image,c=document.createElement('canvas');c.width=Math.min(1024,im.width);c.height=Math.min(1024,im.height);c.getContext('2d').drawImage(im,0,0,c.width,c.height);texture=c.toDataURL('image/png');}
    surfaces.push({texture,color:material.color.toArray(),faces:faces.slice(group.start,group.start+group.count)});
  }
  const currentScale=new THREE.Vector3();transform.clone().multiply(mesh.skeleton.bones[0].matrixWorld).decompose(new THREE.Vector3(),new THREE.Quaternion(),currentScale);const scaleRatio=currentScale.x/bones[0].bindscale[0];for(let i=0;i<vertices.length;i++)vertices[i]*=scaleRatio;for(const bone of bones)bone.bindpos=bone.bindpos.map(v=>v*scaleRatio);
  output.push({name:mesh.name,scaleRatio,vertices,faces,texcoord,bones,surfaces,poses:[]});
 }
 // Use one full FBX walking cycle; native locomotion root positions remain simulation-driven.
 const model=root.children[0],clip=model.animations.find(a=>/walk/i.test(a.name))||model.animations[0],mixer=new THREE.AnimationMixer(model);mixer.clipAction(clip).play();
 for(let k=0;k<34;k++){mixer.setTime(clip.duration*k/33);root.updateMatrixWorld(true);
  meshes.forEach((mesh,i)=>{const transform=localize().multiply(mesh.matrixWorld).multiply(mesh.bindMatrixInverse);output[i].poses.push(mesh.skeleton.bones.map(b=>{const m=transform.clone().multiply(b.matrixWorld),p=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();m.decompose(p,q,scale);return [...p.toArray(),q.w,q.x,q.y,q.z];}));});
 }
 return {source:'Existing Microsoft Rocketbox Male_Adult_01 FBX and compatible baked walking animation; actual skin weights, skeleton transforms and albedo maps.',duration:clip.duration,meshes:output};
});
const folder='public/assets/fork/native-human';await fs.mkdir(folder,{recursive:true});for(let i=0;i<data.meshes.length;i++)for(let j=0;j<data.meshes[i].surfaces.length;j++){const m=data.meshes[i].surfaces[j];if(m.texture){await fs.writeFile(`${folder}/skin-${i}-${j}.png`,Buffer.from(m.texture.split(',')[1],'base64'));m.texture=`skin-${i}-${j}.png`;}}
await fs.writeFile(`${folder}/human.json`,JSON.stringify(data));console.log({meshes:data.meshes.length,bones:data.meshes.map(m=>m.bones.length),vertices:data.meshes.map(m=>m.vertices.length/3)});await browser.close();
