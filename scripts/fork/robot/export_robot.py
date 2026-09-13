"""Export official Unitree visual meshes and joint metadata for faithful replay."""
import json
import shutil
import numpy as np
import mujoco
import trimesh
from g1_policy import G1Controller, ROOT, UPSTREAM

sim = G1Controller()
m = sim.model
scene = trimesh.Scene()
bodies = []
for body in range(1, m.nbody):
    name = f'body_{body}'
    parent = f'body_{m.body_parentid[body]}' if m.body_parentid[body] else 'world'
    transform = trimesh.transformations.quaternion_matrix(m.body_quat[body])
    transform[:3,3] = m.body_pos[body]
    scene.graph.update(frame_to=name, frame_from=parent, matrix=transform)
    joint = int(m.body_jntadr[body])
    bodies.append({'name':name,'parent':parent,'pos':m.body_pos[body].tolist(),
                   'quat':m.body_quat[body].tolist(),
                   'qpos':int(m.jnt_qposadr[joint]) if joint>=0 else None,
                   'axis':m.jnt_axis[joint].tolist() if joint>=0 else None,
                   'free':joint>=0 and int(m.jnt_type[joint])==0})
for geom in range(m.ngeom):
    if m.geom_group[geom] != 1 or m.geom_type[geom] != mujoco.mjtGeom.mjGEOM_MESH:
        continue
    mesh_id = int(m.geom_dataid[geom])
    vstart, vcount = m.mesh_vertadr[mesh_id],m.mesh_vertnum[mesh_id]
    fstart, fcount = m.mesh_faceadr[mesh_id],m.mesh_facenum[mesh_id]
    mesh = trimesh.Trimesh(vertices=m.mesh_vert[vstart:vstart+vcount].copy(),
                           faces=m.mesh_face[fstart:fstart+fcount].copy(),process=False)
    color = (m.geom_rgba[geom]*255).astype(np.uint8)
    mesh.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(
        baseColorFactor=color,metallicFactor=.35,roughnessFactor=.38))
    transform = trimesh.transformations.quaternion_matrix(m.geom_quat[geom])
    transform[:3,3] = m.geom_pos[geom]
    scene.add_geometry(mesh,node_name=f'visual_{geom}',parent_node_name=f'body_{m.geom_bodyid[geom]}',transform=transform)
folder = ROOT/'public/assets/fork'
folder.mkdir(parents=True,exist_ok=True)
(folder/'unitree-g1.glb').write_bytes(scene.export(file_type='glb'))
(folder/'unitree-g1-joints.json').write_text(json.dumps(bodies))
shutil.copyfile(UPSTREAM/'LICENSE',folder/'UNITREE-LICENSE.txt')
print(json.dumps({'visual_meshes':len(scene.geometry),'bodies':len(bodies),'glb_bytes':(folder/'unitree-g1.glb').stat().st_size}))
