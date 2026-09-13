"""Convert an actual rigged Mixamo human and walk cycle into embedded-texture FBX."""
import bpy
from pathlib import Path
root=Path(__file__).resolve().parents[3]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root/'.fork-runs/robot/soldier-source.glb'))
for obj in list(bpy.context.scene.objects):
 if obj.type=='MESH' and not any(mod.type=='ARMATURE' for mod in obj.modifiers):
  bpy.data.objects.remove(obj,do_unlink=True)
print('SOURCE_ACTIONS',[(a.name,tuple(a.frame_range)) for a in bpy.data.actions])
for image in bpy.data.images:
 if image.type=='IMAGE':
  image.filepath_raw=str(root/'public/assets/fork'/f'{image.name}.png')
  image.file_format='PNG'
  image.save()
  image.pack()
bpy.ops.export_scene.fbx(filepath=str(root/'public/assets/fork/walking-human.fbx'),path_mode='COPY',embed_textures=True,use_selection=False,add_leaf_bones=False,bake_anim=True,bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,axis_forward='-Z',axis_up='Y')
print('Saved real human FBX with embedded textures')
