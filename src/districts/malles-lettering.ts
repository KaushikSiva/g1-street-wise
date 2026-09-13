import * as THREE from 'three';
import lettering from './malles-lettering.json';
/** Original displayed-word outlines. Typeface, size and relief are inferred. */
export function buildMallesLettering(width:number,height:number,depth=.003){
 const shapes:THREE.Shape[]=[];
 for(const glyph of lettering.glyphs){const path=new THREE.ShapePath();for(const raw of glyph.commands){const [command,...values]=raw,v=values as number[];if(command==='M')path.moveTo(v[0]+glyph.advance,v[1]);else if(command==='L')path.lineTo(v[0]+glyph.advance,v[1]);else if(command==='Q')path.quadraticCurveTo(v[0]+glyph.advance,v[1],v[2]+glyph.advance,v[3]);else if(command==='C')path.bezierCurveTo(v[0]+glyph.advance,v[1],v[2]+glyph.advance,v[3],v[4]+glyph.advance,v[5]);else path.currentPath!.closePath();}shapes.push(...path.toShapes());}
 const g=new THREE.ExtrudeGeometry(shapes,{depth:1,bevelEnabled:false,curveSegments:3});g.computeBoundingBox();const b=g.boundingBox!;g.translate(-(b.min.x+b.max.x)/2,-b.min.y,0);g.scale(width/(b.max.x-b.min.x),height/(b.max.y-b.min.y),depth);g.userData={text:lettering.text,font:lettering.font,evidence:'MALLES visible on the southern/right wing cream fascia in gallery photograph8; exact font, pigment and dimensions unknown'};return g;
}
