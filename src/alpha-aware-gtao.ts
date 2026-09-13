import * as THREE from "three";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";

type CutoutMaterial = THREE.Material & {
  map?: THREE.Texture | null;
  alphaMap?: THREE.Texture | null;
};

/** Preserve material sidedness and shipped UV0 alpha masks in GTAO's normal/depth pass. */
export class AlphaAwareGTAOPass extends GTAOPass {
  private masks = new Map<THREE.Material, THREE.MeshNormalMaterial>();
  private opaqueSides = new Map<THREE.Material, Map<THREE.Side, THREE.Material>>();

  private normalFor(source: CutoutMaterial, opaque: THREE.Material) {
    if (source.alphaTest <= 0 || (!source.map && !source.alphaMap)) {
      if (source.side === opaque.side) return opaque;
      let variants = this.opaqueSides.get(opaque);
      if (!variants) { variants = new Map(); this.opaqueSides.set(opaque, variants); }
      let normal = variants.get(source.side);
      if (!normal) { normal = opaque.clone(); normal.side = source.side; variants.set(source.side, normal); }
      return normal;
    }
    let normal = this.masks.get(source);
    if (!normal) {
      normal = new THREE.MeshNormalMaterial({ side: source.side });
      normal.blending = THREE.NoBlending;
      normal.onBeforeCompile = (shader) => {
        const mapMatrix = new THREE.Matrix3(), alphaMatrix = new THREE.Matrix3();
        shader.uniforms.cutoutMap = { value: source.map ?? null };
        shader.uniforms.cutoutAlphaMap = { value: source.alphaMap ?? null };
        shader.uniforms.cutoutHasMap = { value: !!source.map };
        shader.uniforms.cutoutHasAlphaMap = { value: !!source.alphaMap };
        shader.uniforms.cutoutOpacity = { value: source.opacity };
        shader.uniforms.cutoutThreshold = { value: source.alphaTest };
        shader.uniforms.cutoutMapTransform = { value: mapMatrix };
        shader.uniforms.cutoutAlphaTransform = { value: alphaMatrix };
        if (source.map) { source.map.updateMatrix(); mapMatrix.copy(source.map.matrix); }
        if (source.alphaMap) { source.alphaMap.updateMatrix(); alphaMatrix.copy(source.alphaMap.matrix); }
        shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
          varying vec2 vCutoutMapUv;
          varying vec2 vCutoutAlphaUv;
          uniform mat3 cutoutMapTransform;
          uniform mat3 cutoutAlphaTransform;`)
          .replace("#include <uv_vertex>", `#include <uv_vertex>
          vCutoutMapUv = (cutoutMapTransform * vec3(uv, 1.0)).xy;
          vCutoutAlphaUv = (cutoutAlphaTransform * vec3(uv, 1.0)).xy;`);
        shader.fragmentShader = shader.fragmentShader.replace("#include <uv_pars_fragment>", `#include <uv_pars_fragment>
          varying vec2 vCutoutMapUv;
          varying vec2 vCutoutAlphaUv;
          uniform sampler2D cutoutMap;
          uniform sampler2D cutoutAlphaMap;
          uniform bool cutoutHasMap;
          uniform bool cutoutHasAlphaMap;
          uniform float cutoutOpacity;
          uniform float cutoutThreshold;`)
          .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
          float cutoutAlpha = cutoutOpacity;
          if (cutoutHasMap) cutoutAlpha *= texture2D(cutoutMap, vCutoutMapUv).a;
          if (cutoutHasAlphaMap) cutoutAlpha *= texture2D(cutoutAlphaMap, vCutoutAlphaUv).g;
          if (cutoutAlpha < cutoutThreshold) discard;`);
      };
      normal.customProgramCacheKey = () => "gtao-uv0-cutout-v1";
      this.masks.set(source, normal);
    }
    return normal;
  }

  // GTAOPass r185 calls this hook only for its normal/depth buffer. Its stock
  // MeshNormalMaterial omits alpha testing, filling transparent leaf regions.
  _renderOverride(
    renderer: THREE.WebGLRenderer,
    overrideMaterial: THREE.Material,
    target: THREE.WebGLRenderTarget,
    clearColor?: THREE.ColorRepresentation,
    clearAlpha?: number,
  ) {
    const color = renderer.getClearColor(new THREE.Color());
    const alpha = renderer.getClearAlpha(), autoClear = renderer.autoClear;
    const override = this.scene.overrideMaterial;
    const originals: Array<[THREE.Mesh, THREE.Material | THREE.Material[]]> = [];
    try {
      renderer.setRenderTarget(target);
      renderer.autoClear = false;
      if (clearColor !== undefined) {
        renderer.setClearColor(clearColor, clearAlpha ?? 0);
        renderer.clear();
      }
      this.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        originals.push([object, object.material]);
        object.material = Array.isArray(object.material)
          ? object.material.map((material) => this.normalFor(material, overrideMaterial))
          : this.normalFor(object.material, overrideMaterial);
      });
      this.scene.overrideMaterial = null;
      renderer.render(this.scene, this.camera);
    } finally {
      for (const [mesh, material] of originals) mesh.material = material;
      this.scene.overrideMaterial = override;
      renderer.autoClear = autoClear;
      renderer.setClearColor(color, alpha);
    }
  }

  dispose() {
    for (const variants of this.opaqueSides.values()) for (const normal of variants.values()) normal.dispose();
    this.opaqueSides.clear();
    for (const normal of this.masks.values()) normal.dispose();
    this.masks.clear();
    super.dispose();
  }
}
