/* ═══════════════════════════════════════════════════════════════════
   The lens (after Lusion). A small flow map remembers where the cursor
   went and how fast; the scene is drawn to a texture and put on screen
   through that map — pixels under the trail are fetched from a displaced
   position, red, green and blue each a little differently. The mark bends
   and fringes; the page's text does not.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import type { HeroConfig } from './config';
import type { Pointer } from './pointer';

export interface Lens { render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, pointer: Pointer): void; resize(): void; dispose(): void; }

export function createLens(renderer: THREE.WebGLRenderer, cfg: HeroConfig): Lens {
  const L = cfg.lens;
  const flowOpts: THREE.RenderTargetOptions = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
  let flowA = new THREE.WebGLRenderTarget(L.res, L.res, flowOpts), flowB = new THREE.WebGLRenderTarget(L.res, L.res, flowOpts);
  const sceneRT = new THREE.WebGLRenderTarget(2, 2, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const FLOW_MAT = new THREE.ShaderMaterial({
    uniforms: { uPrev: { value: null }, uPos: { value: new THREE.Vector2(-9, -9) }, uVel: { value: new THREE.Vector2() }, uAspect: { value: 1 }, uDecay: { value: L.decay }, uRadius: { value: L.radius }, uGain: { value: L.gain } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `precision highp float; varying vec2 vUv;
      uniform sampler2D uPrev; uniform vec2 uPos, uVel; uniform float uAspect, uDecay, uRadius, uGain;
      void main(){
        vec2 prev = texture2D(uPrev, vUv).xy * uDecay;
        vec2 d = (vUv - uPos) * vec2(uAspect, 1.0);
        float blob = exp(-dot(d,d) / (uRadius*uRadius));
        gl_FragColor = vec4(prev + uVel * blob * uGain, 0.0, 1.0);
      }`,
  });
  const POST_MAT = new THREE.ShaderMaterial({
    // replaces the canvas outright: the texture already holds the additive
    // particles as premultiplied colour + alpha, so no second blend
    transparent: false, blending: THREE.NoBlending, depthTest: false, depthWrite: false,
    uniforms: { uScene: { value: null }, uFlow: { value: null }, uStrength: { value: L.strength }, uAber: { value: L.aberration } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `precision highp float; varying vec2 vUv;
      uniform sampler2D uScene, uFlow; uniform float uStrength, uAber;
      void main(){
        vec2 f = texture2D(uFlow, vUv).xy * uStrength;
        vec4 r = texture2D(uScene, vUv - f * (1.0 + uAber));
        vec4 g = texture2D(uScene, vUv - f);
        vec4 b = texture2D(uScene, vUv - f * (1.0 - uAber));
        gl_FragColor = vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
      }`,
  });
  const flowScene = new THREE.Scene(); flowScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), FLOW_MAT));
  const postScene = new THREE.Scene(); postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), POST_MAT));
  const flowPos = new THREE.Vector2(-9, -9), flowPrev = new THREE.Vector2(-9, -9), flowVel = new THREE.Vector2();
  const clear = new THREE.Color(cfg.renderer.ground);

  const resize = () => sceneRT.setSize(renderer.domElement.width, renderer.domElement.height);
  resize();

  return {
    resize,
    render(scene, camera, P) {
      // 1 · stamp the cursor's velocity into the flow map
      if (P.moved) {
        flowPos.set(P.tx, P.ty);
        if (flowPrev.x > -1) flowVel.subVectors(flowPos, flowPrev); else flowVel.set(0, 0);
        const len = flowVel.length(); if (len > L.maxVel) flowVel.multiplyScalar(L.maxVel / len);
        flowPrev.copy(flowPos);
      } else { flowVel.set(0, 0); flowPrev.set(-9, -9); }
      FLOW_MAT.uniforms.uPrev.value = flowA.texture; FLOW_MAT.uniforms.uPos.value.copy(flowPos);
      FLOW_MAT.uniforms.uVel.value.copy(flowVel); FLOW_MAT.uniforms.uAspect.value = camera.aspect;
      renderer.setRenderTarget(flowB); renderer.render(flowScene, postCam);
      [flowA, flowB] = [flowB, flowA];
      // 2 · the scene to a texture, 3 · the texture to screen through the map
      renderer.setRenderTarget(sceneRT); renderer.setClearColor(clear, 0); renderer.clear(); renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      POST_MAT.uniforms.uScene.value = sceneRT.texture; POST_MAT.uniforms.uFlow.value = flowA.texture;
      renderer.render(postScene, postCam);
    },
    dispose() { flowA.dispose(); flowB.dispose(); sceneRT.dispose(); FLOW_MAT.dispose(); POST_MAT.dispose(); },
  };
}
