import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import outlines from './lakshmi-lettering.json';

/** Small original name meshes from local font outlines; metric dimensions are inferred. */
export function createLakshmiLettering() {
  const meshes:THREE.BufferGeometry[]=[];
  const placements=[{x:-2.32,width:2.0},{x:2.32,width:2.42}];
  const words=[];
  for(let wordIndex=0;wordIndex<outlines.words.length;wordIndex++){
    const word=outlines.words[wordIndex],place=placements[wordIndex],paths:THREE.Shape[]=[];
    for(const glyph of word.glyphs){
      const path=new THREE.ShapePath();
      for(const raw of glyph.commands){
        const [command,...values]=raw;const v=values as number[];
        switch(command){
          case 'M':path.moveTo(v[0]+glyph.advance,v[1]);break;
          case 'L':path.lineTo(v[0]+glyph.advance,v[1]);break;
          case 'Q':path.quadraticCurveTo(v[0]+glyph.advance,v[1],v[2]+glyph.advance,v[3]);break;
          case 'C':path.bezierCurveTo(v[0]+glyph.advance,v[1],v[2]+glyph.advance,v[3],v[4]+glyph.advance,v[5]);break;
          case 'Z':path.currentPath!.closePath();break;
        }
      }
      paths.push(...path.toShapes());
    }
    // Normalize XY before extrusion so bevel and letter thickness stay metric.
    const sampled=paths.flatMap(p=>p.getPoints(8));
    const bounds=new THREE.Box2().setFromPoints(sampled),scale=place.width/(bounds.max.x-bounds.min.x);
    for(const shape of paths){
      for(const path of [shape,...shape.holes]){
        for(const curve of path.curves){
          // All commands above create LineCurve, QuadraticBezierCurve or CubicBezierCurve.
          for(const key of ['v0','v1','v2','v3']){
            const point=(curve as unknown as Record<string,unknown>)[key];
            if(point instanceof THREE.Vector2)point.set((point.x-(bounds.min.x+bounds.max.x)/2)*scale,(point.y-(bounds.min.y+bounds.max.y)/2)*scale);
          }
          curve.updateArcLengths();
        }
      }
    }
    const geometry=new THREE.ExtrudeGeometry(paths,{depth:.012,steps:1,curveSegments:5,bevelEnabled:true,bevelThickness:.0008,bevelSize:.0008,bevelSegments:1});
    geometry.translate(place.x,3.27,.0028);geometry.clearGroups();
    words.push({text:word.text,widthMeters:place.width,heightMeters:(bounds.max.y-bounds.min.y)*scale,center:[place.x,3.27],frontZ:.0156,backZ:.002});meshes.push(geometry);
  }
  const merged=mergeGeometries(meshes,false)!;meshes.forEach(g=>g.dispose());
  const material=new THREE.MeshStandardMaterial({color:0x903f32,roughness:.69,metalness:.12});
  const mesh=new THREE.Mesh(merged,material);mesh.name='Lakshmi Apartments raised name lettering';mesh.castShadow=mesh.receiveShadow=true;
  mesh.userData={words,depthMeters:.012,bevelMeters:.0008,mountingGapMeters:.002,typeface:outlines.typeface,limits:'Exact font, size, depth and mounting gap inferred; source shows raised red lettering'};
  return mesh;
}
