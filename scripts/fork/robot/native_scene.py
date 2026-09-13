"""Attach actual exported Chennai visual meshes without altering collision physics."""
import json,os
from pathlib import Path
import xml.etree.ElementTree as ET
from environment import ROOT,make_scene

ASSETS=ROOT/'public/assets/fork/native-chennai'

def decorate(environment='crossing'):
    if environment!='crossing':
        from hazards import hazard_scene
        source=hazard_scene()
    else:source=make_scene()
    manifest=ASSETS/'manifest.json'
    if not manifest.exists():raise RuntimeError('Native Chennai assets missing. See scripts/fork/export-native-scene.mjs.')
    data=json.loads(manifest.read_text());tree=ET.parse(source);root=tree.getroot()
    asset=root.find('asset')
    if asset is None:asset=ET.SubElement(root,'asset')
    world=root.find('worldbody')
    for geom in world.findall('geom'):
        if geom.get('name','').startswith('frontage_') or geom.get('name')=='parked_van':geom.set('rgba','0 0 0 0')
    for i,entry in enumerate(data['meshes']):
        name=f'chennai_visual_{i}'
        ET.SubElement(asset,'mesh',name=name,file=str(ASSETS/entry['file']),inertia='shell')
        ET.SubElement(world,'geom',name=name,type='mesh',mesh=name,rgba=' '.join(map(str,entry['color']+[1])),contype='0',conaffinity='0',group='2',density='0')
    visual=root.find('visual')
    if visual is None:visual=ET.SubElement(root,'visual')
    headlight=ET.SubElement(visual,'headlight',ambient='.5 .5 .5',diffuse='.6 .6 .6',specular='.1 .1 .1')
    ET.SubElement(asset,'texture',name='streetwise_sky',type='skybox',builtin='gradient',rgb1='.65 .75 .82',rgb2='.93 .94 .91',width='256',height='1536')
    global_=visual.find('global')
    if global_ is None:global_=ET.SubElement(visual,'global')
    global_.set('offwidth','1400');global_.set('offheight','900')
    path=ROOT/'.fork-runs/robot'/f'chennai-native-{os.getpid()}.xml';tree.write(path);return path


def prepare():
    import numpy as np
    import trimesh
    data=json.loads((ROOT/'.fork-runs/robot/chennai-native.json').read_text())
    ASSETS.mkdir(parents=True,exist_ok=True);meshes=[]
    for i,group in enumerate(data['groups']):
        vertices=np.array(group['vertices']).reshape(-1,3);faces=np.array(group['faces']).reshape(-1,3)
        if len(faces)<4:continue
        # STL removes unused vertices and transfers the real triangle surface.
        mesh=trimesh.Trimesh(vertices=vertices,faces=faces,process=False)
        if np.linalg.matrix_rank(vertices-vertices.mean(axis=0))<3:continue
        for part,start in enumerate(range(0,len(faces),150000)):
            chunk=trimesh.Trimesh(vertices=vertices,faces=faces[start:start+150000],process=False)
            chunk.remove_unreferenced_vertices()
            if np.linalg.matrix_rank(chunk.vertices-chunk.vertices.mean(axis=0))<3:continue
            name=f'street-{i:03}-{part}.stl';chunk.export(ASSETS/name)
            meshes.append({'file':name,'color':group['color'],'triangles':len(chunk.faces)})
    keep={m['file'] for m in meshes}
    for old in ASSETS.glob('street-*.stl'):
        if old.name not in keep:old.unlink()
    (ASSETS/'manifest.json').write_text(json.dumps({'source':data['source'],'collision':'Decorative meshes only; collision model is unchanged.','meshes':meshes},indent=2))
    print({'meshes':len(meshes),'triangles':sum(m['triangles'] for m in meshes)})


if __name__=='__main__':prepare()
