"""Build a natural human FBX with Microsoft Rocketbox's compatible walk clip.
Run with Blender --background --python scripts/fork/robot/prepare_pedestrian.py.
Upstream inputs are MIT licensed; paths and exact revision are recorded below.
"""
import bpy
from pathlib import Path
import urllib.request
ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'.fork-runs/robot/rocketbox'
OUTPUT=ROOT/'public/assets/fork/pedestrian'
REV='0943055db6ec570bcef9f2c8b41c9e5467c808f9'
BASE=f'https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/{REV}/'
SOURCE.mkdir(parents=True,exist_ok=True);OUTPUT.mkdir(parents=True,exist_ok=True)
files={'Male_Adult_01.fbx':'Assets/Avatars/Adults/Male_Adult_01/Export/Male_Adult_01.fbx','walk.fbx':'Assets/Animations/all_animations_max_motextr_xy/m_walk_neutral.max.fbx','LICENSE.md':'LICENSE.md'}
for name in ['m002_body_color.tga','m002_head_color.tga','m002_opacity_color.tga','m002_body_normal.tga','m002_head_normal.tga']:
 files[name]='Assets/Avatars/Adults/Male_Adult_01/Textures/'+name
for name,path in files.items():
 if not (SOURCE/name).exists():urllib.request.urlretrieve(BASE+path,SOURCE/name)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=str(SOURCE/'Male_Adult_01.fbx'))
keep=set(bpy.context.scene.objects);arm=next(o for o in keep if o.type=='ARMATURE')
bpy.ops.import_scene.fbx(filepath=str(SOURCE/'walk.fbx'))
source_arm=next(o for o in bpy.context.scene.objects if o not in keep and o.type=='ARMATURE')
walk=source_arm.animation_data.action
arm.animation_data_clear()
for bone in arm.pose.bones:
 if bone.name in source_arm.pose.bones:
  constraint=bone.constraints.new('COPY_ROTATION');constraint.target=source_arm;constraint.subtarget=bone.name;constraint.target_space='WORLD';constraint.owner_space='WORLD'
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.nla.bake(frame_start=1,frame_end=33,only_selected=False,visual_keying=True,clear_constraints=True,use_current_action=False,bake_types={'POSE'})
walk=arm.animation_data.action
walk.name='Natural walking'
for obj in list(bpy.context.scene.objects):
 if obj not in keep or obj.type=='EMPTY':bpy.data.objects.remove(obj,do_unlink=True)
for material in bpy.data.materials:
 if not material.name.startswith('m002_'):continue
 material.use_nodes=True;material.node_tree.nodes.clear()
 nodes=material.node_tree.nodes;links=material.node_tree.links
 bsdf=nodes.new('ShaderNodeBsdfPrincipled');bsdf.inputs['Roughness'].default_value=.85
 output=nodes.new('ShaderNodeOutputMaterial');links.new(bsdf.outputs['BSDF'],output.inputs['Surface'])
 def texture(suffix):
  image=bpy.data.images.load(str(SOURCE/(material.name+'_'+suffix+'.tga')),check_existing=False)
  _loaded_pixel=image.pixels[0]
  image.filepath_raw=str(OUTPUT/(material.name+'_'+suffix+'.png'));image.file_format='PNG';image.save();image.pack()
  node=nodes.new('ShaderNodeTexImage');node.image=image;return node
 color=texture('color');links.new(color.outputs['Color'],bsdf.inputs['Base Color'])
 if material.name=='m002_opacity':
  links.new(color.outputs['Alpha'],bsdf.inputs['Alpha']);material.surface_render_method='DITHERED'
 else:
  normal=texture('normal');normal.image.colorspace_settings.name='Non-Color';n=nodes.new('ShaderNodeNormalMap');links.new(normal.outputs['Color'],n.inputs['Color']);links.new(n.outputs['Normal'],bsdf.inputs['Normal'])
bpy.ops.object.select_all(action='SELECT')
bpy.context.scene.frame_start=1;bpy.context.scene.frame_end=33;bpy.context.scene.render.fps=30;bpy.context.scene.frame_set(1)
bpy.ops.export_scene.fbx(filepath=str(OUTPUT/'walking-human.fbx'),path_mode='COPY',embed_textures=True,use_selection=True,add_leaf_bones=False,bake_anim=True,bake_anim_use_all_actions=False,bake_anim_use_nla_strips=False,axis_forward='-Z',axis_up='Y')
(OUTPUT/'LICENSE.md').write_text((SOURCE/'LICENSE.md').read_text())
print('Exported MIT Rocketbox human and compatible natural walk')
