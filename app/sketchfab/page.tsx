"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Bounds } from "@react-three/drei";
import { Suspense, useState } from "react";

useGLTF.preload("/male_face/scene.gltf");
useGLTF.preload("/stylized_face/scene.gltf");
useGLTF.preload("/face/scene.gltf");
useGLTF.preload("/face_man/scene.gltf");

function Avatar({ url }: { url: string }) {
  const { scene } = useGLTF(url);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scene.traverse((obj: any) => {
    if (obj.isMesh) obj.frustumCulled = false;
  });

  return <primitive object={scene} />;
}

export default function SketchFab() {
  const [avatarUrl, setAvatarUrl] = useState("/male_face/scene.gltf");

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 10,
          display: "flex",
          gap: 8,
        }}
      >
        <button onClick={() => setAvatarUrl("/male_face/scene.gltf")}>
          Male
        </button>
        <button onClick={() => setAvatarUrl("/stylized_face/scene.gltf")}>
          Stylized
        </button>
        <button onClick={() => setAvatarUrl("/face/scene.gltf")}>Face</button>
        <button onClick={() => setAvatarUrl("/face_man/scene.gltf")}>
          Man
        </button>
      </div>

      <Canvas
        camera={{
          fov: 50,
          near: 0.01,
          far: 1000,
        }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 5, 3]} />

        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.4}>
            <Avatar key={avatarUrl} url={avatarUrl} />
          </Bounds>
        </Suspense>

        <OrbitControls makeDefault />
      </Canvas>
    </>
  );
}
