/* global THREE */
/**
 * 固定 2.5D 视角 3D 渲染 — Orthographic 正交相机，便于手机点选建塔
 */
(function (global) {
  'use strict';

  var canvas, renderer, scene, camera, raycaster, mouse;
  var ambientLight, dirLight, hemiLight;
  var mapObjects = [];
  var theme = {};
  var orthoHalf = 30;
  var zoom = 1;
  var hoverKey = null;

  var CAM = {
    pos: new THREE.Vector3(38, 46, 38),
    target: new THREE.Vector3(0, 0, 0),
  };
  /** 固定 2.5D 俯仰：水平距离 + 高度不变，仅绕 Y 轴转四个面 */
  var CAM_ORBIT_H = Math.sqrt(38 * 38 + 38 * 38);
  var CAM_HEIGHT = 46;
  var CAM_YAW_BASE = Math.PI / 4;
  var viewFace = 0;

  function applyViewFace() {
    var yaw = CAM_YAW_BASE + viewFace * (Math.PI / 2);
    CAM.pos.set(
      CAM_ORBIT_H * Math.cos(yaw),
      CAM_HEIGHT,
      CAM_ORBIT_H * Math.sin(yaw)
    );
  }

  function rotateView(step) {
    viewFace = (viewFace + step + 4) % 4;
    applyViewFace();
    updateCamera();
  }

  function setViewFace(face) {
    viewFace = ((face % 4) + 4) % 4;
    applyViewFace();
    updateCamera();
  }

  function getViewFace() {
    return viewFace;
  }

  applyViewFace();

  function init(cvs) {
    canvas = cvs;
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a5080);
    scene.fog = new THREE.Fog(0x2a5080, 55, 110);

    resize();

    ambientLight = new THREE.AmbientLight(0xaaccff, 0.65);
    scene.add(ambientLight);
    hemiLight = new THREE.HemisphereLight(0x88ccff, 0x3a6a40, 0.4);
    scene.add(hemiLight);
    dirLight = new THREE.DirectionalLight(0xfff4e0, 1.45);
    dirLight.position.set(18, 28, 12);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 80;
    dirLight.shadow.camera.left = -35;
    dirLight.shadow.camera.right = 35;
    dirLight.shadow.camera.top = 35;
    dirLight.shadow.camera.bottom = -35;
    scene.add(dirLight);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    updateCamera();
  }

  function updateCamera() {
    camera.position.copy(CAM.pos);
    camera.lookAt(CAM.target);
  }

  function resize() {
    if (!canvas || !renderer) return;
    var w = global.innerWidth;
    var h = global.innerHeight;
    var a = w / h;
    var half = orthoHalf * zoom;
    camera = new THREE.OrthographicCamera(-half * a, half * a, half, -half, 0.1, 200);
    camera.position.copy(CAM.pos);
    camera.lookAt(CAM.target);
    renderer.setSize(w, h);
    updateCamera();
  }

  var ZOOM_MIN = 0.30;
  var ZOOM_MAX = 1.90;

  function setZoom(delta) {
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + delta));
    resize();
  }

  function resetZoom() {
    zoom = 1;
    resize();
  }

  function getZoom() {
    return zoom;
  }

  function track(obj) {
    mapObjects.push(obj);
    scene.add(obj);
    return obj;
  }

  function clearMap() {
    mapObjects.forEach(function (o) { scene.remove(o); });
    mapObjects = [];
    hoverKey = null;
  }

  function setTheme(t) {
    theme = t || {};
    if (theme.sky) scene.background.setHex(theme.sky);
    if (theme.fog) scene.fog.color.setHex(theme.fog);
    if (theme.sky && ambientLight) {
      var c = new THREE.Color(theme.sky);
      c.lerp(new THREE.Color(0xffffff), 0.35);
      ambientLight.color.copy(c);
    }
    if (theme.sky && hemiLight) hemiLight.color.setHex(theme.sky);
    if (theme.ground && hemiLight) hemiLight.groundColor.setHex(theme.ground);
  }

  function enrichTheme(raw) {
    function ch(v, f, min) { return Math.min(255, Math.max(min || 0, Math.round(v * f))); }
    function brighten(hex, f, min) {
      return (ch((hex >> 16) & 0xff, f, min) << 16) |
             (ch((hex >> 8) & 0xff, f, min) << 8) | ch(hex & 0xff, f, min);
    }
    return {
      ground: brighten(raw.ground, 1.32, 28),
      path: brighten(raw.path, 1.18, 48),
      sky: brighten(raw.sky, 2.2, 32),
      fog: brighten(raw.fog, 1.9, 28),
      build: brighten(raw.build, 1.15, 24),
      tree: brighten(raw.tree, 1.12, 24),
      trunk: raw.trunk,
      base: brighten(raw.base, 1.1, 36),
      portal: raw.portal,
    };
  }

  function addGround(mapSize, groundColor) {
    var g = new THREE.Mesh(
      new THREE.BoxGeometry(mapSize + 2, 0.3, mapSize + 2),
      new THREE.MeshStandardMaterial({ color: groundColor, roughness: 0.75 })
    );
    g.position.y = -0.15;
    g.receiveShadow = true;
    track(g);
  }

  function addPathTile(x, z, y, color) {
    var tile = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.14, 1.9),
      new THREE.MeshStandardMaterial({ color: color, roughness: 0.65 })
    );
    tile.position.set(x, y + 0.07, z);
    tile.receiveShadow = true;
    track(tile);
  }

  function addBuildSpot(key, x, z, y, color, highGround) {
    var pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.9, 0.12, 6),
      new THREE.MeshStandardMaterial({
        color: color, transparent: true, opacity: 0.72,
        emissive: color, emissiveIntensity: 0.25,
      })
    );
    pad.position.set(x, y + 0.08, z);
    pad.receiveShadow = true;
    pad.userData.spotKey = key;
    track(pad);

    var ring = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1.05, 6),
      new THREE.MeshBasicMaterial({ color: 0xa5d6a7, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 0.14, z);
    ring.visible = false;
    ring.userData.spotKey = key;
    track(ring);

    if (highGround) {
      var marker = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.32, 4),
        new THREE.MeshStandardMaterial({ color: 0xffd54f, emissive: 0xff8f00, emissiveIntensity: 0.35 })
      );
      marker.position.set(x + 0.55, y + 0.42, z - 0.55);
      marker.rotation.y = Math.PI / 4;
      track(marker);
    }

    return { pad: pad, ring: ring };
  }

  function setSpotOccupied(pad, occupied, highGround) {
    if (!pad) return;
    var baseColor = highGround ? 0x558b2f : (theme.build || 0x4caf50);
    pad.material.color.setHex(occupied ? 0x455a64 : baseColor);
    pad.material.emissive.setHex(occupied ? 0x000000 : (highGround ? 0x33691e : 0x2e7d32));
    pad.material.opacity = occupied ? 0.35 : 0.72;
  }

  function setHover(key, rings, towerType, range) {
    hoverKey = key;
    Object.keys(rings).forEach(function (k) {
      if (rings[k]) rings[k].visible = k === key;
    });
    return createRangeRing(key, range);
  }

  var rangeMesh = null;

  var RANGE_STYLE = {
    archer: { color: 0x66bb6a, fill: 0.12, ring: 0.28 },
    cannon: { color: 0xff7043, fill: 0.1, ring: 0.32 },
    frost:  { color: 0x4fc3f7, fill: 0.1, ring: 0.3 },
  };

  function createRangeRing(spotKey, range, towerType, x, z, y, highGround) {
    if (rangeMesh) {
      scene.remove(rangeMesh);
      rangeMesh.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      rangeMesh = null;
    }
    if (!spotKey || !range) return null;
    var st = RANGE_STYLE[towerType] || RANGE_STYLE.archer;
    var group = new THREE.Group();
    var fill = new THREE.Mesh(
      new THREE.CircleGeometry(range, 48),
      new THREE.MeshBasicMaterial({
        color: st.color, transparent: true, opacity: st.fill,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    fill.rotation.x = -Math.PI / 2;
    fill.position.y = 0.02;
    group.add(fill);
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(0.1, range - 0.12), range, 48),
      new THREE.MeshBasicMaterial({
        color: st.color, transparent: true, opacity: st.ring,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    group.add(ring);
    if (highGround) {
      var bonus = new THREE.Mesh(
        new THREE.RingGeometry(Math.max(0.1, range - 0.2), range - 0.05, 48),
        new THREE.MeshBasicMaterial({
          color: 0xffd54f, transparent: true, opacity: 0.22,
          side: THREE.DoubleSide, depthWrite: false,
        })
      );
      bonus.rotation.x = -Math.PI / 2;
      bonus.position.y = 0.06;
      group.add(bonus);
    }
    group.position.set(x, y + 0.14, z);
    scene.add(group);
    rangeMesh = group;
    return rangeMesh;
  }

  function showSellHint(spotKey, x, z, y, range, refund) {
    if (rangeMesh) {
      scene.remove(rangeMesh);
      rangeMesh.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      rangeMesh = null;
    }
    var group = new THREE.Group();
    var fill = new THREE.Mesh(
      new THREE.CircleGeometry(range || 2, 48),
      new THREE.MeshBasicMaterial({
        color: 0xff5252, transparent: true, opacity: 0.08,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    fill.rotation.x = -Math.PI / 2;
    group.add(fill);
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(Math.max(0.1, (range || 2) - 0.15), range || 2, 48),
      new THREE.MeshBasicMaterial({
        color: 0xff5252, transparent: true, opacity: 0.45,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);
    group.position.set(x, y + 0.14, z);
    group.userData.sellRefund = refund;
    scene.add(group);
    rangeMesh = group;
    return group;
  }

  function clearHover(rings) {
    hoverKey = null;
    Object.keys(rings || {}).forEach(function (k) { if (rings[k]) rings[k].visible = false; });
    if (rangeMesh) {
      scene.remove(rangeMesh);
      rangeMesh.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      rangeMesh = null;
    }
  }

  function addPortal(x, z, y, color) {
    var portal = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.14, 8, 16),
      new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.55 })
    );
    portal.position.set(x, y + 0.75, z);
    portal.rotation.x = Math.PI / 2;
    portal.userData.spin = true;
    track(portal);
  }

  function addBase(x, z, y, color) {
    var base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.15, 1.6, 8),
      new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.35 })
    );
    base.position.set(x, y + 0.8, z);
    base.castShadow = true;
    track(base);
    var flag = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.9, 4),
      new THREE.MeshStandardMaterial({ color: 0xffd54f, emissive: 0xff8f00, emissiveIntensity: 0.25 })
    );
    flag.position.set(x, y + 2.0, z);
    track(flag);
  }

  function addTree(x, z, y) {
    var trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 1.1, 6),
      new THREE.MeshStandardMaterial({ color: theme.trunk || 0x5d4037 })
    );
    trunk.position.set(x, y + 0.55, z);
    trunk.castShadow = true;
    track(trunk);
    var leaves = new THREE.Mesh(
      new THREE.ConeGeometry(0.75, 1.4, 6),
      new THREE.MeshStandardMaterial({ color: theme.tree || 0x2e7d32 })
    );
    leaves.position.set(x, y + 1.65, z);
    leaves.castShadow = true;
    track(leaves);
  }

  function createTowerMesh(type, cfg) {
    var group = new THREE.Group();
    var woodMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.85 });
    var stoneMat = new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.7 });
    var accentMat = new THREE.MeshStandardMaterial({
      color: cfg.color, emissive: cfg.color, emissiveIntensity: 0.22, roughness: 0.55,
    });

    var foundation = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.28, 8), stoneMat);
    foundation.position.y = 0.14;
    foundation.castShadow = true;
    group.add(foundation);

    if (type === 'archer') {
      var deck = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.58, 0.22, 8), woodMat);
      deck.position.y = 0.38;
      deck.castShadow = true;
      group.add(deck);
      var pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, cfg.height * 0.65, 8), accentMat);
      pillar.position.y = 0.55 + cfg.height * 0.32;
      pillar.castShadow = true;
      group.add(pillar);
      var roof = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.62, 4), accentMat);
      roof.position.y = 0.55 + cfg.height * 0.65 + 0.42;
      roof.castShadow = true;
      group.add(roof);
      var bow = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 6, 12, Math.PI), woodMat);
      bow.rotation.y = Math.PI / 2;
      bow.rotation.z = Math.PI / 2;
      bow.position.set(0.42, 0.55 + cfg.height * 0.45, 0);
      group.add(bow);
      var flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.22, 0.34),
        new THREE.MeshStandardMaterial({ color: 0xffeb3b, side: THREE.DoubleSide, emissive: 0xffc107, emissiveIntensity: 0.2 })
      );
      flag.position.set(-0.38, 0.55 + cfg.height * 0.75, 0.12);
      group.add(flag);
    } else if (type === 'cannon') {
      var platform = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.18, 0.85), stoneMat);
      platform.position.y = 0.38;
      platform.castShadow = true;
      group.add(platform);
      var wheelMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
      [[-0.38, -0.28], [-0.38, 0.28], [0.38, -0.28], [0.38, 0.28]].forEach(function (pos) {
        var wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 10), wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(pos[0], 0.32, pos[1]);
        wheel.castShadow = true;
        group.add(wheel);
      });
      var turret = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), accentMat);
      turret.position.y = 0.62;
      turret.castShadow = true;
      group.add(turret);
      var barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 1.05, 8),
        new THREE.MeshStandardMaterial({ color: 0x424242, metalness: 0.55, roughness: 0.35 })
      );
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(0.55, 0.62, 0);
      barrel.castShadow = true;
      group.add(barrel);
      var ammo = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), stoneMat);
      ammo.position.set(-0.28, 0.52, 0.22);
      group.add(ammo);
    } else {
      var iceBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.58, 0.66, 0.24, 6),
        new THREE.MeshStandardMaterial({
          color: 0xb3e5fc, transparent: true, opacity: 0.85, emissive: 0x4fc3f7, emissiveIntensity: 0.15,
        })
      );
      iceBase.position.y = 0.36;
      iceBase.castShadow = true;
      group.add(iceBase);
      var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, cfg.height * 0.55, 6), accentMat);
      stem.position.y = 0.55 + cfg.height * 0.27;
      stem.castShadow = true;
      group.add(stem);
      [[0, 0.25], [0.22, -0.12], [-0.2, -0.1]].forEach(function (off, i) {
        var crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.22 + i * 0.04),
          new THREE.MeshStandardMaterial({
            color: 0x80deea, emissive: 0x00bcd4, emissiveIntensity: 0.5,
            transparent: true, opacity: 0.9,
          })
        );
        crystal.position.set(off[0], 0.55 + cfg.height * 0.55 + off[1], off[1] * 0.3);
        crystal.rotation.y = i * 1.2;
        group.add(crystal);
      });
      var snow = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 4), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe1f5fe, emissiveIntensity: 0.3 }));
      snow.position.y = 0.55 + cfg.height + 0.35;
      group.add(snow);
    }

    return group;
  }

  function addCuteEye(group, x, y, z, size) {
    var sclera = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.55, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.08 })
    );
    sclera.position.set(x, y, z);
    group.add(sclera);
    var pupil = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.28, 6, 4),
      new THREE.MeshStandardMaterial({ color: 0x212121 })
    );
    pupil.position.set(x + size * 0.08, y + size * 0.05, z + size * 0.35);
    group.add(pupil);
  }

  function createEnemyMesh(type, cfg) {
    var group = new THREE.Group();
    group.userData.bobPhase = Math.random() * Math.PI * 2;

    var bodyGeo = new THREE.SphereGeometry(cfg.size, 14, 12);
    bodyGeo.scale(type === 'tank' ? 1.15 : 1, type === 'fast' ? 0.78 : 0.88, type === 'tank' ? 1.1 : 1);
    var bodyMat = new THREE.MeshStandardMaterial({
      color: cfg.color, emissive: cfg.color, emissiveIntensity: 0.18, roughness: 0.45,
    });
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    group.add(body);
    group.userData.body = body;
    group.userData.bodyMat = bodyMat;

    var eyeSize = type === 'tank' ? 0.14 : type === 'fast' ? 0.09 : 0.11;
    addCuteEye(group, -cfg.size * 0.38, cfg.size * 0.22, cfg.size * 0.55, eyeSize);
    addCuteEye(group, cfg.size * 0.38, cfg.size * 0.22, cfg.size * 0.55, eyeSize);

    var blushMat = new THREE.MeshStandardMaterial({ color: 0xff8a80, transparent: true, opacity: 0.55 });
    [[-0.55, 0], [0.55, 0]].forEach(function (side) {
      var blush = new THREE.Mesh(new THREE.SphereGeometry(cfg.size * 0.14, 6, 4), blushMat);
      blush.position.set(side[0] * cfg.size * 0.55, cfg.size * 0.05, cfg.size * 0.62);
      group.add(blush);
    });

    if (type === 'fast') {
      var earMat = new THREE.MeshStandardMaterial({ color: cfg.color, emissive: cfg.color, emissiveIntensity: 0.12 });
      [[-1, 1], [1, 1]].forEach(function (side) {
        var ear = new THREE.Mesh(new THREE.ConeGeometry(cfg.size * 0.22, cfg.size * 0.42, 4), earMat);
        ear.position.set(side[0] * cfg.size * 0.55, cfg.size * 0.72, cfg.size * 0.15);
        ear.rotation.z = side[0] * 0.35;
        group.add(ear);
      });
    } else if (type === 'tank') {
      var armorMat = new THREE.MeshStandardMaterial({ color: 0xce93d8, metalness: 0.35, roughness: 0.4 });
      var plate = new THREE.Mesh(new THREE.BoxGeometry(cfg.size * 1.35, cfg.size * 0.35, cfg.size * 1.05), armorMat);
      plate.position.set(0, cfg.size * 0.15, 0);
      plate.castShadow = true;
      group.add(plate);
      var horn = new THREE.Mesh(new THREE.ConeGeometry(cfg.size * 0.18, cfg.size * 0.35, 4), armorMat);
      horn.rotation.x = -Math.PI / 2;
      horn.position.set(0, cfg.size * 0.35, cfg.size * 0.75);
      group.add(horn);
    } else {
      var smile = new THREE.Mesh(
        new THREE.TorusGeometry(cfg.size * 0.18, cfg.size * 0.04, 4, 8, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x5d4037 })
      );
      smile.rotation.x = Math.PI;
      smile.position.set(0, -cfg.size * 0.08, cfg.size * 0.62);
      group.add(smile);
    }

    return group;
  }

  function createProjectileMesh(type) {
    var group = new THREE.Group();
    group.userData.spin = type === 'frost';

    function glowMesh(geo, color, opacity, emissive) {
      return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: emissive || 0.65,
        transparent: opacity < 1,
        opacity: opacity,
      }));
    }

    if (type === 'archer') {
      var shaft = glowMesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 6), 0xffeb3b, 1, 0.85);
      shaft.rotation.x = Math.PI / 2;
      shaft.position.z = -0.08;
      group.add(shaft);
      var tip = glowMesh(new THREE.ConeGeometry(0.09, 0.2, 6), 0xfff176, 1, 0.9);
      tip.rotation.x = -Math.PI / 2;
      tip.position.z = 0.28;
      group.add(tip);
      var tail = glowMesh(new THREE.ConeGeometry(0.06, 0.14, 4), 0xff9800, 0.75, 0.5);
      tail.rotation.x = Math.PI / 2;
      tail.position.z = -0.34;
      group.add(tail);
    } else if (type === 'cannon') {
      var core = glowMesh(new THREE.SphereGeometry(0.18, 8, 6), 0xff7043, 1, 0.95);
      group.add(core);
      var halo = glowMesh(new THREE.SphereGeometry(0.28, 8, 6), 0xffab40, 0.35, 0.4);
      group.add(halo);
    } else {
      var crystal = glowMesh(new THREE.OctahedronGeometry(0.16), 0x80deea, 0.95, 0.85);
      group.add(crystal);
      var frostGlow = glowMesh(new THREE.SphereGeometry(0.24, 8, 6), 0x4fc3f7, 0.28, 0.35);
      group.add(frostGlow);
    }

    return group;
  }

  function pickBuildSpot(clientX, clientY, pads) {
    mouse.x = (clientX / global.innerWidth) * 2 - 1;
    mouse.y = -(clientY / global.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    var meshes = [];
    Object.keys(pads).forEach(function (k) { if (pads[k]) meshes.push(pads[k]); });
    var hits = raycaster.intersectObjects(meshes, false);
    if (hits.length > 0 && hits[0].object.userData.spotKey) {
      return hits[0].object.userData.spotKey;
    }
    return null;
  }

  function worldToScreen(x, y, z) {
    var v = new THREE.Vector3(x, y, z);
    v.project(camera);
    return {
      x: (v.x * 0.5 + 0.5) * global.innerWidth,
      y: (-v.y * 0.5 + 0.5) * global.innerHeight,
      visible: v.z < 1 && v.z > -1,
    };
  }

  function animateMap(dt) {
    mapObjects.forEach(function (o) {
      if (o.userData && o.userData.spin) o.rotation.z += dt * 1.8;
    });
  }

  function render() {
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  global.Render3D = {
    init: init,
    resize: resize,
    setZoom: setZoom,
    resetZoom: resetZoom,
    getZoom: getZoom,
    rotateView: rotateView,
    setViewFace: setViewFace,
    getViewFace: getViewFace,
    setTheme: setTheme,
    enrichTheme: enrichTheme,
    clearMap: clearMap,
    addGround: addGround,
    addPathTile: addPathTile,
    addBuildSpot: addBuildSpot,
    setSpotOccupied: setSpotOccupied,
    setHover: setHover,
    clearHover: clearHover,
    createRangeRing: createRangeRing,
    showSellHint: showSellHint,
    addPortal: addPortal,
    addBase: addBase,
    addTree: addTree,
    createTowerMesh: createTowerMesh,
    createEnemyMesh: createEnemyMesh,
    createProjectileMesh: createProjectileMesh,
    pickBuildSpot: pickBuildSpot,
    worldToScreen: worldToScreen,
    animateMap: animateMap,
    render: render,
    getScene: function () { return scene; },
  };
})(window);
