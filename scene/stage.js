// 共用 3D 舞台：渲染器、鏡頭、燈光、點擊偵測、補間動畫與小狗角色。
import * as THREE from "../vendor/three.module.min.js";

export { THREE };

const matCache = new Map();
export function mat(color, options = {}) {
  const key = `${color}|${JSON.stringify(options)}`;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...options }));
  return matCache.get(key);
}

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function box(w, h, d, color, options) {
  return shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, options)));
}

export function cyl(rTop, rBottom, h, color, segments = 24, options) {
  return shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), mat(color, options)));
}

export function ball(r, color, options) {
  return shadowed(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat(color, options)));
}

export function at(object, x = 0, y = 0, z = 0) {
  object.position.set(x, y, z);
  return object;
}

export function group(...children) {
  const g = new THREE.Group();
  children.forEach(child => g.add(child));
  return g;
}

// 永遠面向鏡頭的文字/emoji 看板
export function label(text, { size = 0.9, color = "#17324d", background = "rgba(255,255,255,.92)" } = {}) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const font = "900 64px 'Noto Sans TC', 'Microsoft JhengHei', system-ui, sans-serif";
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(text).width) + 56;
  canvas.width = width;
  canvas.height = 100;
  ctx.font = font;
  if (background) {
    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.roundRect(4, 4, width - 8, 92, 40);
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, 54);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set(size * width / 100, size, 1);
  sprite.renderOrder = 10;
  return sprite;
}

// 給小手指的大點擊範圍（看不見）
export function hitBox(object, w, h, d, y = h / 2) {
  const hit = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = y;
  object.add(hit);
  return object;
}

export const ease = t => 1 - Math.pow(1 - t, 3);

export class Stage {
  constructor(container, { background = "#bfe7ff", cameraPos = [0, 9, 10], lookAt = [0, 0, -0.5], fitWidth = 13 } = {}) {
    this.container = container;
    this.enabled = false;
    this.updaters = new Set();
    this.tweens = new Set();
    this.fitWidth = fitWidth;
    this.lookAt = new THREE.Vector3(...lookAt);
    this.baseCamera = new THREE.Vector3(...cameraPos);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.append(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(background);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

    this.scene.add(new THREE.HemisphereLight("#ffffff", "#c9b28f", 1.6));
    const sun = new THREE.DirectionalLight("#fff4de", 2.2);
    sun.position.set(5, 12, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.onPointer = event => this.handleTap(event);
    this.renderer.domElement.addEventListener("pointerdown", this.onPointer);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.timer = new THREE.Timer();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // 直式手機畫面會把鏡頭拉遠，確保整個場景的寬度都看得到
    const dir = this.baseCamera.clone().sub(this.lookAt);
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const needed = this.fitWidth / 2 / Math.tan(vFov / 2) / this.camera.aspect;
    const scale = Math.max(1, needed / dir.length());
    this.camera.position.copy(this.lookAt).add(dir.multiplyScalar(scale));
    this.camera.lookAt(this.lookAt);
    this.camera.updateProjectionMatrix();
  }

  add(...objects) {
    objects.forEach(object => this.scene.add(object));
    return objects[0];
  }

  // 讓物件可以被點；會往父層找第一個有 onTap 的物件
  tappable(object, onTap) {
    object.userData.onTap = onTap;
    return object;
  }

  handleTap(event) {
    if (!this.enabled) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    for (const hit of this.raycaster.intersectObjects(this.scene.children, true)) {
      let node = hit.object;
      while (node && !node.userData.onTap) node = node.parent;
      if (!node) continue;
      this.pop(node);
      node.userData.onTap(node, hit.point);
      return;
    }
  }

  onUpdate(fn) {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }

  tween(duration, step, done) {
    const tween = { t: 0, duration, step, done };
    this.tweens.add(tween);
    step(0);
    return tween;
  }

  // 被點到時彈一下
  pop(object) {
    const base = object.userData.baseScale ?? object.scale.x;
    object.userData.baseScale = base;
    this.tween(0.25, t => object.scale.setScalar(base * (1 + Math.sin(t * Math.PI) * 0.12)));
  }

  // 物件沿拋物線飛到世界座標 target
  fly(object, target, { duration = 0.45, height = 1.2, done } = {}) {
    const world = new THREE.Vector3();
    object.getWorldPosition(world);
    if (object.parent !== this.scene) {
      this.scene.attach(object);
    }
    const from = world.clone();
    this.tween(duration, t => {
      object.position.lerpVectors(from, target, t);
      object.position.y += Math.sin(t * Math.PI) * height;
    }, done);
  }

  frame() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    for (const tween of [...this.tweens]) {
      tween.t = Math.min(1, tween.t + dt / tween.duration);
      tween.step(tween.t);
      if (tween.t >= 1) {
        this.tweens.delete(tween);
        tween.done?.();
      }
    }
    this.updaters.forEach(fn => fn(dt));
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointer);
    this.scene.traverse(object => {
      object.geometry?.dispose();
      if (object.material?.map) object.material.map.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

// 藍色小狗：可以走路、拿東西
export function createPup(stage) {
  const blue = "#5b9bd5";
  const light = "#cfe6f7";
  const dark = "#1f4e79";
  const pup = new THREE.Group();
  const body = group(
    at(ball(0.55, blue), 0, 0, 0),
    at(ball(0.4, light), 0, -0.05, 0.28)
  );
  body.scale.set(1, 1.15, 0.9);
  body.position.y = 0.95;
  const head = group(
    ball(0.5, blue),
    at(ball(0.3, light), 0, -0.12, 0.35),
    at(ball(0.09, dark), 0, -0.02, 0.62),
    at(ball(0.07, "#111"), -0.2, 0.12, 0.42),
    at(ball(0.07, "#111"), 0.2, 0.12, 0.42)
  );
  head.position.y = 1.9;
  [-1, 1].forEach(side => {
    const ear = cyl(0, 0.2, 0.55, dark, 12);
    ear.position.set(side * 0.28, 0.5, -0.05);
    ear.rotation.z = -side * 0.35;
    head.add(ear);
  });
  const tail = cyl(0.05, 0.1, 0.6, dark, 10);
  tail.position.set(0, 1.0, -0.6);
  tail.rotation.x = -0.9;
  const legs = [-1, 1].map(side => at(cyl(0.14, 0.16, 0.5, dark, 12), side * 0.25, 0.25, 0.05));
  const hand = at(new THREE.Group(), 0, 1.25, 0.75);
  pup.add(body, head, tail, ...legs, hand);
  pup.userData = { hand, target: null, onArrive: null, queue: [], speed: 6.5, walk: 0 };

  // 小朋友常常連點好幾下：依序排隊執行，最多記住 3 件事
  pup.walkTo = (x, z, onArrive, face) => {
    const data = pup.userData;
    const job = { target: new THREE.Vector3(x, 0, z), onArrive, face };
    if (!data.target) return startJob(job);
    if (data.queue.length < 3) data.queue.push(job);
  };
  function startJob(job) {
    Object.assign(pup.userData, job);
  }
  pup.holding = () => hand.children[0] ?? null;
  pup.carry = object => {
    hand.clear();
    object.position.set(0, 0, 0);
    object.rotation.set(0, 0, 0);
    hand.add(object);
  };
  pup.release = () => {
    const object = hand.children[0];
    if (object) stage.scene.attach(object);
    return object ?? null;
  };

  stage.onUpdate(dt => {
    const data = pup.userData;
    tail.rotation.z = Math.sin(performance.now() / 120) * 0.5;
    if (!data.target) {
      legs.forEach(leg => { leg.rotation.x *= 0.8; });
      body.position.y = 0.95;
      return;
    }
    const delta = data.target.clone().sub(pup.position);
    delta.y = 0;
    const dist = delta.length();
    if (dist < 0.05) {
      pup.position.copy(data.target);
      if (data.face) pup.rotation.y = Math.atan2(data.face.x - pup.position.x, data.face.z - pup.position.z);
      const done = data.onArrive;
      data.target = null;
      data.onArrive = null;
      done?.();
      if (data.queue.length) startJob(data.queue.shift());
      return;
    }
    const step = Math.min(dist, data.speed * dt);
    pup.position.add(delta.multiplyScalar(step / dist));
    const heading = Math.atan2(data.target.x - pup.position.x, data.target.z - pup.position.z);
    let turn = heading - pup.rotation.y;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    pup.rotation.y += turn * Math.min(1, dt * 12);
    data.walk += dt * 14;
    legs[0].rotation.x = Math.sin(data.walk) * 0.6;
    legs[1].rotation.x = -Math.sin(data.walk) * 0.6;
    body.position.y = 0.95 + Math.abs(Math.sin(data.walk)) * 0.08;
  });

  stage.add(pup);
  return pup;
}

// 地板與牆
export function room(stage, { floor = "#f3dfb8", wall = "#fff3d6", width = 16, depth = 11 } = {}) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat(floor));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = 0.5;
  ground.receiveShadow = true;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(width, 6), mat(wall));
  back.position.set(0, 3, -5);
  back.receiveShadow = true;
  stage.add(ground, back);
}
