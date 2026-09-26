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
  sprite.userData.isLabel = true;
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
    // 直式畫面（手機）改成比較俯視的角度，場景會佔滿更多高度
    if (this.camera.aspect < 1) {
      const portrait = Math.min(1, (1 - this.camera.aspect) * 2);
      dir.y *= 1 + 0.6 * portrait;
      dir.z *= 1 - 0.5 * portrait;
    }
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
  // 身上的深藍色斑點：小球稍微突出身體表面，看起來像一塊塊花紋
  const spotColor = "#2f6aa8";
  [[0, 0.3, -1, 0.17], [-0.65, 0.45, -0.6, 0.14], [0.7, 0.1, -0.7, 0.15], [-0.95, -0.1, 0.1, 0.12],
   [0.95, 0.4, 0, 0.12], [0.25, 0.95, -0.3, 0.13], [-0.25, -0.55, -0.8, 0.13], [0.55, -0.5, 0.45, 0.1],
   [-0.7, 0.6, 0.4, 0.12], [0.75, 0.55, 0.35, 0.11]]
    .forEach(([x, y, z, r]) => {
      const dir = new THREE.Vector3(x, y, z).normalize();
      body.add(at(ball(r, spotColor), ...dir.multiplyScalar(0.55 - r * 0.72).toArray()));
    });
  body.position.y = 0.95;
  const head = group(
    ball(0.5, blue),
    at(ball(0.3, "#f2d3ab"), 0, -0.12, 0.35), // 鼻子周圍是皮膚色
    at(ball(0.09, dark), 0, -0.02, 0.62)
  );
  head.position.y = 1.9;
  [[0, 0.75, -0.65, 0.15], [-0.7, 0.5, -0.5, 0.11], [0.75, 0.25, -0.6, 0.1]].forEach(([x, y, z, r]) => {
    const dir = new THREE.Vector3(x, y, z).normalize();
    head.add(at(ball(r, spotColor), ...dir.multiplyScalar(0.5 - r * 0.72).toArray()));
  });
  // 大眼睛（眼白＋黑眼珠＋反光）與白眉毛
  const eyes = [-1, 1].map(side => {
    const eye = group(
      ball(0.22, "#ffffff"),
      at(ball(0.135, "#1a1a1a"), 0, -0.01, 0.12),
      at(ball(0.05, "#ffffff"), -0.045, 0.045, 0.245)
    );
    eye.position.set(side * 0.21, 0.14, 0.34);
    head.add(eye);
    // 眼睛外側的深藍色半圓花紋：扁圓片貼在頭上，被眼白蓋住一半
    const normal = new THREE.Vector3(side * 0.78, 0.3, 0.55).normalize();
    const patch = ball(0.25, dark);
    patch.scale.set(1, 1, 0.22);
    patch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    patch.position.copy(normal.multiplyScalar(0.48));
    head.add(patch);
    const brow = cyl(0.045, 0.045, 0.24, light, 10);
    brow.position.set(side * 0.22, 0.42, 0.34);
    brow.rotation.set(0.5, 0, Math.PI / 2 - side * 0.25);
    head.add(brow);
    return eye;
  });
  [-1, 1].forEach(side => {
    const ear = cyl(0, 0.2, 0.55, dark, 12);
    ear.position.set(side * 0.28, 0.5, -0.05);
    ear.rotation.z = -side * 0.35;
    // 耳朵內側是皮膚色
    const inner = cyl(0, 0.13, 0.38, "#f2d3ab", 12);
    inner.scale.z = 0.45;
    inner.position.set(0, -0.06, 0.13);
    ear.add(inner);
    head.add(ear);
  });
  const tail = cyl(0.05, 0.1, 0.6, dark, 10);
  tail.position.set(0, 1.0, -0.6);
  tail.rotation.x = -0.9;
  const legs = [-1, 1].map(side => at(cyl(0.14, 0.16, 0.5, dark, 12), side * 0.25, 0.25, 0.05));
  // 手臂：空手時垂下，拿東西時往前伸，東西夾在兩隻手掌中間
  const arms = [-1, 1].map(side => {
    const pivot = at(new THREE.Group(), side * 0.36, 1.32, 0.2);
    pivot.add(at(cyl(0.1, 0.11, 0.62, blue, 12), 0, -0.31, 0), at(ball(0.13, light), 0, -0.64, 0));
    pivot.rotation.z = side * 0.25;
    return pivot;
  });
  const hand = at(new THREE.Group(), 0, 1.5, 0.78);
  pup.add(body, head, tail, ...legs, ...arms, hand);
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
  // 把手上的東西放到世界座標 target：短短滑過去，不會飛走
  pup.putDown = (target, done) => {
    const object = pup.release();
    if (!object) return done?.();
    const from = object.position.clone();
    stage.tween(0.22, t => object.position.lerpVectors(from, target, t), () => done?.(object));
  };
  pup.release = () => {
    const object = hand.children[0];
    if (object) stage.scene.attach(object);
    return object ?? null;
  };

  stage.onUpdate(dt => {
    const data = pup.userData;
    tail.rotation.z = Math.sin(performance.now() / 120) * 0.5;
    const holding = hand.children.length > 0;
    arms.forEach((arm, i) => {
      const goal = holding ? -1.95 : 0;
      arm.rotation.x += (goal - arm.rotation.x) * 0.3;
      arm.rotation.z = (i ? 1 : -1) * (holding ? -0.18 : 0.25);
    });
    hand.position.y = 1.5 + (body.position.y - 0.95);
    // 每 3.5 秒眨一次眼
    const blink = performance.now() % 3500 < 120 ? 0.15 : 1;
    eyes.forEach(eye => { eye.scale.y = blink; });
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
      // done 可能已經自己安排了下一段路（例如把蛋餅端去盤子），那就不要蓋掉
      if (!data.target && data.queue.length) startJob(data.queue.shift());
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

// 提示：把目標原本的招牌換成黃色提示牌（寫著拿什麼／放哪裡），下面有跳動的箭頭。
// 沒有招牌的東西（地上的玩具）就用 height 決定提示牌的高度。
export function createHints(stage) {
  let markers = [];
  let key = "";
  stage.onUpdate(() => {
    const bounce = Math.abs(Math.sin(performance.now() / 260)) * 0.25;
    markers.forEach(marker => { marker.userData.arrow.position.y = marker.userData.arrowY + bounce; });
  });
  return list => {
    const nextKey = list.map(hint => `${hint.object.uuid}:${hint.text}`).join("|");
    if (nextKey === key) return;
    key = nextKey;
    markers.forEach(marker => {
      if (marker.userData.hidden) marker.userData.hidden.visible = true;
      marker.traverse(object => object.material?.map?.dispose());
      marker.removeFromParent();
    });
    markers = list.map(({ object, text, height = 1.2 }) => {
      const sign = object.children.find(child => child.userData.isLabel && child.visible);
      const anchor = (sign ?? object).getWorldPosition(new THREE.Vector3());
      const labelY = sign ? anchor.y + 0.25 : anchor.y + height;
      if (sign) sign.visible = false;
      const arrow = cyl(0.22, 0, 0.4, "#ffb703", 16, { emissive: "#b86e00", emissiveIntensity: 0.4 });
      arrow.castShadow = false;
      const marker = group(arrow, at(label(`👉 ${text}`, { size: 0.55, background: "rgba(255,183,3,.95)" }), 0, labelY, 0));
      marker.position.set(anchor.x, 0, anchor.z);
      marker.userData = { arrow, arrowY: labelY - 0.6, hidden: sign };
      stage.add(marker);
      return marker;
    });
  };
}
