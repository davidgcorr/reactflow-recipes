import { defaultModule } from './model';
export const moduleRecipes = {
  DOM: defaultModule,
  LaTeX: `import katex from 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.mjs';
export default function mount({ element, inputs, value, emit }) {
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css';
  document.head.append(css);
  function update(inputs, value) {
    const x = inputs['in-0'] ?? Number(value);
    katex.render(String.raw\`f(x) = x^2 = \${Number(x) ** 2}\`, element, { throwOnError: false });
    emit(Number(x) ** 2);
  }
  update(inputs, value);
  return { update, destroy() { css.remove(); } };
}`,
  'Three.js': `import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
export default function mount({ element, inputs, value, emit }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 4;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  element.append(renderer.domElement);
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshNormalMaterial();
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);
  let speed = 1;
  function update(inputs, value) { speed = Number(inputs['in-0'] ?? value) || 0; emit(speed); }
  update(inputs, value);
  const observer = new ResizeObserver(() => {
    const w = element.clientWidth, h = element.clientHeight;
    renderer.setSize(w, h); camera.aspect = w / (h || 1); camera.updateProjectionMatrix();
  });
  observer.observe(element);
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    cube.rotation.y += clock.getDelta() * speed;
    cube.rotation.x = 0.4; renderer.render(scene, camera);
  });
  return { update, destroy() {
    observer.disconnect(); renderer.setAnimationLoop(null);
    geometry.dispose(); material.dispose(); renderer.dispose();
  } };
}`,
};
