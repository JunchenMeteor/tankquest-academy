import { useEffect, useRef } from 'react';
import {
  CylinderGeometry,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Group } from 'three';

import { loadTankRig, paintTankRig } from './tank-asset.js';
import type { TankRig } from './tank-rig.js';
import { useI18n } from '../../i18n/I18nProvider.js';

interface GarageTankPreviewProps {
  code: string;
  primaryColor?: string;
  secondaryColor?: string;
}

function colorNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value.replace('#', ''), 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function disposePainted(root: Group | null) {
  root?.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const materials = Array.isArray(node.material)
      ? node.material
      : [node.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value && typeof value === 'object' && 'isTexture' in value) {
          (value as unknown as { dispose: () => void }).dispose();
        }
      }
      material.dispose();
    }
  });
}

export default function GarageTankPreview({
  code,
  primaryColor,
  secondaryColor,
}: GarageTankPreviewProps) {
  const { t } = useI18n();
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const paintedRef = useRef<Group | null>(null);
  const assetRef = useRef<TankRig | null>(null);
  const colorsRef = useRef({ primaryColor, secondaryColor });

  useEffect(() => {
    colorsRef.current = { primaryColor, secondaryColor };
  }, [primaryColor, secondaryColor]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const scene = new Scene();
    scene.background = null;
    scene.fog = new Fog(0x121b1f, 12, 28);
    sceneRef.current = scene;
    const camera = new PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(7, 4.1, 7);
    camera.lookAt(new Vector3(0, 0.85, 0));
    const renderer = new WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.dataset.garagePreview = code;
    renderer.domElement.setAttribute('aria-label', t('garage.previewHelp'));
    host.append(renderer.domElement);
    const key = new DirectionalLight(0xffe4ba, 3.2);
    key.position.set(-4, 8, 5);
    key.castShadow = true;
    scene.add(key);
    scene.add(new HemisphereLight(0xbcd8ef, 0x303d30, 1.2));
    const ground = new Mesh(
      new CylinderGeometry(4.2, 4.2, 0.12, 64),
      new MeshStandardMaterial({ color: 0x26332f, roughness: 0.86 })
    );
    ground.position.y = -0.04;
    ground.receiveShadow = true;
    scene.add(ground);

    const attach = () => {
      if (!assetRef.current || disposed) return;
      if (paintedRef.current) {
        scene.remove(paintedRef.current);
        disposePainted(paintedRef.current);
      }
      const painted = paintTankRig(
        assetRef.current,
        colorNumber(colorsRef.current.primaryColor, 0x5d7d46),
        colorNumber(colorsRef.current.secondaryColor, 0xe8c65a)
      );
      painted.root.rotation.y = -0.45;
      painted.root.traverse((node) => {
        if (node instanceof Mesh) node.castShadow = true;
      });
      paintedRef.current = painted.root;
      scene.add(painted.root);
    };
    void loadTankRig()
      .then((asset) => {
        if (disposed) return;
        assetRef.current = asset;
        attach();
      })
      .catch(() => {
        host.dataset.loadError = 'true';
      });
    attach();

    let distance = 10;
    let yaw = -0.45;
    let dragging = false;
    let previousX = 0;
    let previousY = 0;
    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const canvas = renderer.domElement;
    const down = (event: PointerEvent) => {
      dragging = true;
      previousX = event.clientX;
      previousY = event.clientY;
      canvas.setPointerCapture?.(event.pointerId);
      canvas.focus();
    };
    const move = (event: PointerEvent) => {
      if (!dragging || !paintedRef.current) return;
      yaw += (event.clientX - previousX) * 0.008;
      paintedRef.current.rotation.y = yaw;
      previousX = event.clientX;
      previousY = event.clientY;
      distance = Math.max(
        5.5,
        Math.min(13, distance + (event.clientY - previousY) * 0.01)
      );
    };
    const up = () => {
      dragging = false;
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      distance = Math.max(5.5, Math.min(13, distance + event.deltaY * 0.008));
    };
    const keydown = (event: KeyboardEvent) => {
      if (!paintedRef.current) return;
      if (event.key === 'ArrowLeft') paintedRef.current.rotation.y -= 0.12;
      if (event.key === 'ArrowRight') paintedRef.current.rotation.y += 0.12;
      if (event.key.toLowerCase() === 'r') {
        paintedRef.current.rotation.y = -0.45;
        distance = 10;
      }
      if (event.key.startsWith('Arrow') || event.key.toLowerCase() === 'r') {
        event.preventDefault();
      }
      yaw = paintedRef.current.rotation.y;
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('keydown', keydown);
    let frame = 0;
    const render = () => {
      frame = requestAnimationFrame(render);
      const scale = distance / 10;
      camera.position.set(7 * scale, 4.1 * scale, 7 * scale);
      camera.lookAt(0, 0.85, 0);
      renderer.render(scene, camera);
    };
    render();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('keydown', keydown);
      disposePainted(paintedRef.current);
      ground.geometry.dispose();
      ground.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      paintedRef.current = null;
      assetRef.current = null;
      sceneRef.current = null;
    };
  }, [code, primaryColor, secondaryColor, t]);

  return <div className="garage-preview" ref={hostRef} />;
}
