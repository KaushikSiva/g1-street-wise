"""Render the same Rocketbox skin and walking bones in native MuJoCo.

Skins/mocap bones are visual only. Original pedestrian collision capsules remain
active but are hidden. Actor root motion continues to come from the simulator.
"""
import json,os,struct
from pathlib import Path
import xml.etree.ElementTree as ET
import numpy as np
import mujoco
from g1_policy import ROOT
ASSETS=ROOT/'public/assets/fork/native-human'


def attach(xml,instances=1):
    info=json.loads((ASSETS/'human.json').read_text());tree=ET.parse(xml);root=tree.getroot()
    asset=root.find('asset');world=root.find('worldbody')
    if asset is None:asset=ET.SubElement(root,'asset')
    for geom in world.iter('geom'):
        if geom.get('name')=='pedestrian_body' or geom.get('name','').startswith('additional_person_'):geom.set('rgba','0 0 0 0')
    for inst in range(instances):
        for mi,mesh in enumerate(info['meshes']):
            for bi,bone in enumerate(mesh['bones']):
                pose=mesh['poses'][0][bi]
                ET.SubElement(world,'body',name=f'human{inst}_{mi}_{bi}',mocap='true',pos=' '.join(map(str,pose[:3])),quat=' '.join(map(str,pose[3:])))
            for si,surface in enumerate(mesh['surfaces']):
                name=f'human_skin_{inst}_{mi}_{si}'
                if surface['texture']:
                    ET.SubElement(asset,'texture',name=name,type='2d',file=str(ASSETS/surface['texture']),vflip='true')
                    ET.SubElement(asset,'material',name=name,texture=name,rgba='1 1 1 1',specular='.1',shininess='.1')
                else:ET.SubElement(asset,'material',name=name,rgba=' '.join(map(str,surface['color']+[1])))
                skin=ROOT/'.fork-runs/robot'/f'{name}-{os.getpid()}.skn'
                bones=[(bi,b) for bi,b in enumerate(mesh['bones']) if b['vertices']]
                with skin.open('wb') as f:
                    f.write(struct.pack('<4i',len(mesh['vertices'])//3,len(mesh['texcoord'])//2,len(surface['faces'])//3,len(bones)))
                    for value,dtype in [(mesh['vertices'],'<f4'),(mesh['texcoord'],'<f4'),(surface['faces'],'<i4')]:f.write(np.asarray(value,dtype=dtype).tobytes())
                    for bi,bone in bones:
                        f.write(f'human{inst}_{mi}_{bi}'.encode().ljust(40,b'\0'))
                        f.write(np.asarray(bone['bindpos']+bone['bindquat'],dtype='<f4').tobytes());f.write(struct.pack('<i',len(bone['vertices'])))
                        f.write(np.asarray(bone['vertices'],dtype='<i4').tobytes());f.write(np.asarray(bone['weights'],dtype='<f4').tobytes())
                ET.SubElement(asset,'skin',name=name,file=str(skin),material=name,group='2')
    target=ROOT/'.fork-runs/robot'/f'native-human-{os.getpid()}.xml';tree.write(target);return target


class NativeHumans:
    def __init__(self,model,instances=1):
        self.info=json.loads((ASSETS/'human.json').read_text());self.instances=instances
        self.ids=[[[int(model.body_mocapid[mujoco.mj_name2id(model,mujoco.mjtObj.mjOBJ_BODY,f'human{inst}_{mi}_{bi}')]) for bi in range(len(mesh['bones']))] for mi,mesh in enumerate(self.info['meshes'])] for inst in range(instances)]

    def update(self,env):
        actors=[{'x':env.crossing,'y':env.py,'start':env.start,'v':1,'active':getattr(env,'kind',0)==0}]
        actors.extend({**a,'active':True} for a in getattr(env,'people',[]))
        for inst in range(self.instances):
            a=actors[inst] if inst<len(actors) else {'x':0,'y':100,'start':100,'v':1,'active':False}
            distance=abs(a['y']-a['start']);phase=(distance/.8)%self.info['duration'];index=min(33,int(phase/self.info['duration']*33))
            reverse=a['v']<0
            for mi,mesh in enumerate(self.info['meshes']):
                for bi,pose in enumerate(mesh['poses'][index]):
                    position=np.array(pose[:3]);quat=np.array(pose[3:])
                    if reverse:
                        position[:2]*=-1
                        # World Z rotation by pi: qz * q.
                        w,x,y,z=quat;quat=np.array([-z,-y,x,w])
                    position+=np.array([a['x'],a['y'],0 if a['active'] else -100])
                    mid=self.ids[inst][mi][bi];env.robot.data.mocap_pos[mid]=position;env.robot.data.mocap_quat[mid]=quat
        mujoco.mj_kinematics(env.robot.model,env.robot.data)
