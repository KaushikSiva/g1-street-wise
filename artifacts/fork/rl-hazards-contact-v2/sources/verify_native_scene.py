"""Check actual exported vertices, native compilation and a fresh policy episode.

Run after export-native-scene.mjs and native_scene.py. This verifies renderer
transfer and collision invariance; it is not a new policy benchmark.
"""
import hashlib
import json
from pathlib import Path

import mujoco
import numpy as np
from stable_baselines3 import PPO

from environment import CentralAvenueG1, ROOT
from g1_policy import G1Controller
from native_human import NativeHumans, attach
from native_scene import ASSETS, decorate


def verify_geometry(manifest):
    source_path=ROOT/'.fork-runs/robot/chennai-native.json'
    assert hashlib.sha256(source_path.read_bytes()).hexdigest()==manifest['sourceExportSha256']
    exported=json.loads(source_path.read_text())
    checked_vertices=checked_triangles=backings=removed=0
    for mesh in manifest['meshes']:
        group=exported['groups'][mesh['sourceGroup']]
        vertices=np.asarray(group['vertices'],dtype=np.float32).reshape(-1,3)
        faces=np.asarray(group['faces'],dtype=np.int32).reshape(-1,3)
        start=mesh['sourceFaceStart']
        faces=faces[start:start+mesh['sourceFaceCount']]
        used,inverse=np.unique(faces.ravel(),return_inverse=True)
        expected_vertices=vertices[used]
        expected_faces=inverse.reshape(-1,3).astype(np.int32)
        valid=np.linalg.norm(np.cross(expected_vertices[expected_faces[:,1]]-expected_vertices[expected_faces[:,0]],expected_vertices[expected_faces[:,2]]-expected_vertices[expected_faces[:,0]]),axis=1)>2e-10
        expected_faces=expected_faces[valid]
        with (ASSETS/mesh['file']).open('rb') as stream:
            nv,nn,nt,nf=np.fromfile(stream,dtype=np.int32,count=4)
            actual_vertices=np.fromfile(stream,dtype=np.float32,count=int(nv)*3).reshape(-1,3)
            np.fromfile(stream,dtype=np.float32,count=int(nn)*3+int(nt)*2)
            actual_faces=np.fromfile(stream,dtype=np.int32,count=int(nf)*3).reshape(-1,3)
        np.testing.assert_array_equal(expected_vertices,actual_vertices[:len(expected_vertices)])
        np.testing.assert_array_equal(expected_faces,actual_faces[:len(expected_faces)])
        assert len(actual_vertices)==len(expected_vertices)+int(mesh['visualBacking'])
        assert len(actual_faces)==len(expected_faces)+3*int(mesh['visualBacking'])
        checked_vertices+=len(expected_vertices);checked_triangles+=len(expected_faces)
        backings+=int(mesh['visualBacking']);removed+=int((~valid).sum())
    return {'exactFloat32Vertices':checked_vertices,'exactSourceTriangles':checked_triangles,'planarBackings':backings,'discardedDegenerateTriangles':removed,'sourceExportSha256':manifest['sourceExportSha256']}


def verify_facades(manifest):
    neighbors=next(m for m in manifest['sceneMetadata'] if 'neighbors' in m['name'])
    batches=[m for m in manifest['meshes'] if any('Inferred neighboring facade' in n for n in m['sourceObjects'])]
    triangles=sum(m['triangles'] for m in batches)
    evidence=ROOT/f"artifacts/web-city-realism/revision-{neighbors['revision']}/after-verification.json"
    if evidence.exists():
        web=json.loads(evidence.read_text())
        assert web['records']==neighbors['records']
        assert web['triangles']==triangles,'Neighbor facade triangles omitted in native transfer'
    return {'revision':neighbors['revision'],'buildings':len(neighbors['records']),'materialBatches':len(batches),'triangles':triangles,'comparedToWebEvidence':evidence.exists(),'plasterBatchesWithTexture':sum(bool(m['texture']) for m in batches if 'mineral plaster' in m['name'])}


def episode(policy,decorated):
    env=CentralAvenueG1()
    humans=None
    if decorated:
        env.robot=G1Controller(attach(decorate()))
        humans=NativeHumans(env.robot.model)
    model=env.robot.model
    physical={}
    for i in range(model.ngeom):
        if model.geom_contype[i] or model.geom_conaffinity[i]:
            name=mujoco.mj_id2name(model,mujoco.mjtObj.mjOBJ_GEOM,i)
            physical[name]=np.concatenate([model.geom_size[i],model.geom_pos[i],model.geom_quat[i],model.geom_friction[i],[model.geom_contype[i],model.geom_conaffinity[i],model.geom_type[i]]]).tolist()
    if decorated:
        for i in range(model.ngeom):
            name=mujoco.mj_id2name(model,mujoco.mjtObj.mjOBJ_GEOM,i) or ''
            if name.startswith('chennai_'):assert model.geom_contype[i]==model.geom_conaffinity[i]==0
    obs,_=env.reset(seed=20002)
    trajectory=[];actions=[];captured=False
    while True:
        action=int(policy.predict(obs,deterministic=True)[0]);actions.append(action)
        obs,_,done,truncated,info=env.step(action)
        if humans:humans.update(env)
        if decorated and not captured and env.t>=3:
            capture(env)
            captured=True
        trajectory.append(env.robot.data.qpos.copy())
        if done or truncated:break
    return np.array(trajectory),actions,info,physical


def capture(env):
    import matplotlib.pyplot as plt
    camera=mujoco.MjvCamera()
    camera.lookat[:]=[-1,-1,1.1];camera.distance=12;camera.azimuth=-35;camera.elevation=-15
    directory=ROOT/'artifacts/fork/media'
    with mujoco.Renderer(env.robot.model,height=900,width=1400) as renderer:
        renderer.update_scene(env.robot.data,camera=camera)
        pixels=renderer.render()
        plt.imsave(directory/'native-mujoco.png',pixels)
        plt.imsave(directory/'native-human.png',pixels)
        position=np.mean([c.pos for c in renderer.scene.camera],axis=0)
        forward=np.mean([c.forward for c in renderer.scene.camera],axis=0)
        (directory/'native-camera.json').write_text(json.dumps({'position':position.tolist(),'target':(position+forward*12).tolist(),'up':[0,0,1],'fov':float(env.robot.model.vis.global_.fovy),'width':1400,'height':900,'seed':20002,'time':env.t,'nativeQpos':env.robot.data.qpos.tolist()},indent=2)+'\n')


def main():
    manifest=json.loads((ASSETS/'manifest.json').read_text())
    geometry=verify_geometry(manifest)
    print('Source geometry verified; comparing fresh policy episodes.',flush=True)
    policy=PPO.load(ROOT/'artifacts/fork/rl-corridor-v2/best.zip',device='cpu')
    plain,plain_actions,plain_info,plain_physics=episode(policy,False)
    native,native_actions,native_info,native_physics=episode(policy,True)
    assert plain_physics==native_physics,'Collision geometry changed'
    assert plain_actions==native_actions,'Decorative assets changed policy actions'
    np.testing.assert_allclose(plain,native,rtol=0,atol=1e-10)
    assert plain_info==native_info,'Decorative assets changed episode outcome'
    report={'freshPhysics':True,'nativeModelCompile':'passed','decorativeGeometryPreservesOutcome':True,'seed':20002,'outcome':native_info,'maxJointPositionDifference':float(np.max(np.abs(plain-native))),'matchedPolicyActions':len(plain_actions),'collisionGeomsCompared':len(plain_physics),'geometry':geometry,'sceneMetadata':manifest['sceneMetadata'],'nativeMeshes':len(manifest['meshes']),'nativeTriangles':sum(m['triangles'] for m in manifest['meshes']),'nativeTextures':len(manifest['textures']),'exportedAt':manifest['exportedAt'],'limits':manifest['limits'],'scope':'One deterministic crossing episode proves invariance for this seed, not a policy benchmark. Native images are renderer captures; browser material and lighting differences remain.'}
    report['facadeParity']=verify_facades(manifest)
    path=ROOT/'artifacts/fork/media/native-verification.json'
    path.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='sceneMetadata'},indent=2))


if __name__=='__main__':main()
