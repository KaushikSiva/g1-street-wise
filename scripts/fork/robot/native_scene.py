"""Attach textured Chennai visual meshes; all imported scenery is non-colliding."""
import base64,json,os
from pathlib import Path
import xml.etree.ElementTree as ET
from environment import ROOT,make_scene

ASSETS=ROOT/'public/assets/fork/native-chennai'

def decorate(environment='crossing'):
    if environment=='streetlife':
        from streetlife import streetlife_scene
        source=streetlife_scene()
    elif environment!='crossing':
        from hazards import hazard_scene
        source=hazard_scene()
    else:source=make_scene()
    manifest=ASSETS/'manifest.json'
    if not manifest.exists():raise RuntimeError('Native Chennai assets missing. See scripts/fork/export-native-scene.mjs.')
    data=json.loads(manifest.read_text());tree=ET.parse(source);root=tree.getroot()
    asset=root.find('asset')
    if asset is None:asset=ET.SubElement(root,'asset')
    world=root.find('worldbody')
    # Robot-only XML inherits a ~1.2 m shadow box; extend visual bounds to the street.
    statistic=root.find('statistic')
    if statistic is None:statistic=ET.SubElement(root,'statistic')
    statistic.set('extent','36');statistic.set('center','0 0 5')
    lighting=data.get('lighting',{});sun=lighting.get('sun')
    if sun:
        for light in world.findall('light'):light.set('active','false')
        direction=sun['direction'];position=[-value*70+(5 if i==2 else 0) for i,value in enumerate(direction)]
        color=sun['color'];power=min(.95,max(.50,sun['intensity']/3.141592653589793))
        ET.SubElement(world,'light',name='chennai_browser_sun',pos=' '.join(map(str,position)),dir=' '.join(map(str,direction)),directional='true',castshadow='true',diffuse=' '.join(str(value*power) for value in color),ambient='0 0 0',specular='.10 .10 .10')
    for geom in world.findall('geom'):
        if geom.get('name','').startswith('frontage_') or geom.get('name') in ('parked_van','central_avenue_road'):geom.set('rgba','0 0 0 0')
    # A visual ground apron closes the view outside the captured map; physics plane stays intact.
    ET.SubElement(world,'geom',name='chennai_visual_ground',type='plane',size='100 100 .01',pos='0 0 -.14',rgba=' '.join(map(str,lighting.get('groundColor',[.44,.40,.32])+[1])),contype='0',conaffinity='0',group='2',density='0')
    for i,entry in enumerate(data.get('textures',[])):
        ET.SubElement(asset,'texture',name=entry['name'],type='2d',file=str(ASSETS/entry['file']),nchannel='4',vflip='true' if entry.get('flipY') else 'false')
    for i,entry in enumerate(data['meshes']):
        name=f'chennai_visual_{i}'
        ET.SubElement(asset,'mesh',name=name,file=str(ASSETS/entry['file']),inertia='shell')
        kwargs={'name':name+'_material','rgba':' '.join(map(str,entry['color']+[1])),'specular':str(max(.03,(1-entry.get('roughness',.8))*.4)),'shininess':str(max(.01,(1-entry.get('roughness',.8))*.5))}
        if entry.get('texture'):kwargs.update(texture=entry['texture'],texuniform='false',texrepeat='1 1')
        ET.SubElement(asset,'material',**kwargs)
        ET.SubElement(world,'geom',name=name,type='mesh',mesh=name,material=name+'_material',contype='0',conaffinity='0',group='2',density='0')
    visual=root.find('visual')
    if visual is None:visual=ET.SubElement(root,'visual')
    headlight=visual.find('headlight')
    if headlight is None:headlight=ET.SubElement(visual,'headlight')
    headlight.set('ambient','.34 .34 .34');headlight.set('diffuse','.18 .18 .18');headlight.set('specular','.08 .08 .08')
    quality=visual.find('quality')
    if quality is None:quality=ET.SubElement(visual,'quality')
    quality.set('shadowsize','4096')
    mapping=visual.find('map')
    if mapping is None:mapping=ET.SubElement(visual,'map')
    mapping.set('shadowclip','1');mapping.set('znear','.002');mapping.set('zfar','10')
    ET.SubElement(asset,'texture',name='streetwise_sky',type='skybox',builtin='gradient',rgb1='.65 .75 .82',rgb2='.93 .94 .91',width='256',height='1536')
    global_=visual.find('global')
    if global_ is None:global_=ET.SubElement(visual,'global')
    global_.set('offwidth','1400');global_.set('offheight','900')
    path=ROOT/'.fork-runs/robot'/f'chennai-native-{os.getpid()}.xml';tree.write(path);return path


def apply_appearance(data,manifest):
    """Transfer the web road/verge albedo shader bake without changing any vertex."""
    import numpy as np
    if data.get('lighting'):manifest['lighting']=data['lighting']
    atlas=data.get('appearanceAtlas')
    if not atlas:return manifest
    file='road-verge-albedo.png';name='chennai_road_verge_albedo';(ASSETS/file).write_bytes(base64.b64decode(atlas['png']))
    manifest['textures']=[t for t in manifest.get('textures',[]) if t['name']!=name]
    manifest['textures'].append({'name':name,'file':file,'width':atlas['width'],'height':atlas['height'],'flipY':True})
    xmin,xmax,ymin,ymax=atlas['bounds'];changed=[]
    for mesh in manifest['meshes']:
        if mesh['name'] not in atlas['materials']:continue
        path=ASSETS/mesh['file'];blob=bytearray(path.read_bytes());nv,nn,nt,nf=np.frombuffer(blob,dtype=np.int32,count=4)
        vertices=np.frombuffer(blob,dtype=np.float32,count=int(nv)*3,offset=16).reshape(-1,3)
        assert nv==nt,'Atlas requires a texture coordinate per vertex'
        uv=np.column_stack([(vertices[:,0]-xmin)/(xmax-xmin),(vertices[:,1]-ymin)/(ymax-ymin)]).clip(0,1).astype(np.float32)
        offset=16+int(nv+nn)*12;blob[offset:offset+uv.nbytes]=uv.tobytes();path.write_bytes(blob)
        mesh['texture']=name;mesh['color']=[1,1,1];mesh['appearance']='Actual browser shader albedo atlas, no lighting baked';changed.append(mesh['file'])
    manifest['appearanceAtlas']={k:v for k,v in atlas.items() if k!='png'}
    manifest['appearanceAtlas']['updatedMeshes']=changed
    return manifest


def prepare():
    import numpy as np
    data=json.loads((ROOT/'.fork-runs/robot/chennai-native.json').read_text())
    ASSETS.mkdir(parents=True,exist_ok=True);meshes=[];textures=[];lookup={}
    for i,texture in enumerate(data.get('textures',[])):
        file=f'texture-{i:03}.png';name=f'chennai_texture_{i}';(ASSETS/file).write_bytes(base64.b64decode(texture['png']));lookup[texture['id']]=name
        textures.append({'file':file,'name':name,'flipY':texture['flipY'],'width':texture['width'],'height':texture['height']})
    for i,group in enumerate(data['groups']):
        vertices=np.array(group['vertices'],dtype=np.float32).reshape(-1,3);faces=np.array(group['faces'],dtype=np.int32).reshape(-1,3)
        normals=np.array(group.get('normals',[]),dtype=np.float32).reshape(-1,3);uvs=np.array(group.get('uvs',[]),dtype=np.float32).reshape(-1,2)
        if not len(faces):continue
        if len(normals)!=len(vertices):normals=np.tile([0,0,1],(len(vertices),1)).astype(np.float32)
        if len(uvs)!=len(vertices):uvs=np.zeros((len(vertices),2),dtype=np.float32)
        for part,start in enumerate(range(0,len(faces),150000)):
            source_faces=faces[start:start+150000];used,inverse=np.unique(source_faces.ravel(),return_inverse=True);v=vertices[used];n=normals[used];uv=uvs[used];f=inverse.reshape(-1,3).astype(np.int32)
            # Discard degenerate triangles before the native mesh compiler sees them.
            valid=np.linalg.norm(np.cross(v[f[:,1]]-v[f[:,0]],v[f[:,2]]-v[f[:,0]]),axis=1)>2e-10;f=f[valid]
            if not len(f):continue
            planar=np.linalg.matrix_rank(v-v.mean(axis=0),tol=1e-5)<3
            if planar:
                # MuJoCo requires a 3-D hull. Add a 2 mm visual backing to one triangle;
                # the original visible surface and every collision property are retained.
                face=f[0];normal=np.cross(v[face[1]]-v[face[0]],v[face[2]]-v[face[0]]);normal/=np.linalg.norm(normal)
                index=len(v);v=np.vstack([v,v[face].mean(axis=0)-normal*.002]).astype(np.float32);n=np.vstack([n,-normal]).astype(np.float32);uv=np.vstack([uv,uv[face].mean(axis=0)]).astype(np.float32)
                f=np.vstack([f,[face[1],face[0],index],[face[2],face[1],index],[face[0],face[2],index]]).astype(np.int32)
            file=f'street-{i:03}-{part}.msh'
            with (ASSETS/file).open('wb') as stream:
                np.array([len(v),len(n),len(uv),len(f)],dtype=np.int32).tofile(stream);v.tofile(stream);n.tofile(stream);uv.tofile(stream);f.tofile(stream)
            meshes.append({'file':file,'name':group.get('name',''),'color':group['color'],'texture':lookup.get(group.get('texture')),'roughness':group.get('roughness',.8),'triangles':len(f),'visualBacking':bool(planar)})
    keep={m['file'] for m in meshes}|{t['file'] for t in textures}
    for pattern in ['street-*.stl','street-*.msh','texture-*.png']:
        for old in ASSETS.glob(pattern):
            if old.name not in keep:old.unlink()
    manifest={'source':data['source'],'collision':'Decorative meshes only, contype=conaffinity=0 and density=0. Original road, van and frontage collision geoms retained with transparent rendering.','limits':'Native OpenGL lighting differs from the web renderer; shader-only weathering, AO and normal mapping are not transferred. Foliage uses alpha-sampled triangle trimming instead of browser alpha testing. Planar visual faces use a 2 mm backing for mesh compilation.','textures':textures,'meshes':meshes,'exportWarnings':data.get('warnings',[])}
    manifest=apply_appearance(data,manifest)
    (ASSETS/'manifest.json').write_text(json.dumps(manifest,indent=2));print({'meshes':len(meshes),'textures':len(textures),'triangles':sum(m['triangles'] for m in meshes)})

if __name__=='__main__':
    import sys
    if '--appearance-only' in sys.argv:
        data=json.loads((ROOT/'.fork-runs/robot/chennai-native.json').read_text());manifest=json.loads((ASSETS/'manifest.json').read_text());manifest=apply_appearance(data,manifest);(ASSETS/'manifest.json').write_text(json.dumps(manifest,indent=2));print({'appearanceMeshes':manifest.get('appearanceAtlas',{}).get('updatedMeshes',[])})
    else:prepare()
