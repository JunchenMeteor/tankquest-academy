# Tank model attribution

## simple tank

- Author: Haider Al_Asady
- Source: https://sketchfab.com/3d-models/simple-tank-db0f1bde8e1648d2963f16b372d069ed
- License: Creative Commons Attribution 4.0 International (CC BY 4.0)
- License text: https://creativecommons.org/licenses/by/4.0/
- Changes: geometry and textures are compressed for web delivery; turret, gun, muzzle, hull, and fourteen road-wheel articulation nodes are authored explicitly, with replacement cylindrical wheels and hubs sharing centred axles. Mixed-material meshes are split by physical region so hull armour, turret armour, observation glass, and equipment follow the correct joint without changing their UVs. Runtime code normalizes the model's scale, orientation, placement, and faction colours.

The model is used for the high-quality Three.js battle view. No non-commercial licensed assets are included.

## M24 Chaffee — light scout

- Author: buffinbag
- Source: https://sketchfab.com/3d-models/m24-chaffee-4f5e64590a514da2a6736fcac5c954e9
- License: Creative Commons Attribution 4.0 International (CC BY 4.0)
- License text: https://creativecommons.org/licenses/by/4.0/
- Changes: the material-partitioned source is regrouped by connected geometry into hull, turret, cannon, track links, suspension, five independent road wheels per side, a front drive sprocket, a rear idler, and three return rollers per side. Every wheel is centred on its own axle. The turret ring, gun trunnion and muzzle are articulated explicitly. Geometry is reduced to 26,427 triangles and compressed with Draco; native PBR textures are capped at 512px and converted to WebP.

## Tank (legacy light scout) — Quaternius

- Author: Quaternius
- Source: https://poly.pizza/m/jWS1CLA0RO and https://poly.pizza/bundle/Animated-Tank-Pack-0tfvbeAJkU
- License: Creative Commons Zero 1.0 (CC0)
- License text: https://creativecommons.org/publicdomain/zero/1.0/
- Changes: orientation is normalized for battle; the source armature is baked; independent idler, road-wheel, sprocket, and return-roller nodes are generated from the track dimensions. The turret, gun, and muzzle are articulated explicitly.

## T-34-85 (Tank) — medium

- Author: KLGaming
- Source: https://sketchfab.com/3d-models/t-34-85-tank-f344bd94aa8b4daf9761207a12fa6ae4
- License: Creative Commons Attribution 4.0 International (CC BY 4.0)
- License text: https://creativecommons.org/licenses/by/4.0/
- Changes: geometry is reduced and compressed with Draco; WebP textures are capped at 512px. Existing wheel nodes are recentered and the hull, turret, gun, and muzzle are articulated explicitly.

## Tiger II H (Königstiger) — heavy

- Author: Pechacek
- Source: https://sketchfab.com/3d-models/tiger-ii-h-konigstiger-f33fc5fbaef04727b4f9b9a1230084d6
- License: Creative Commons Attribution 4.0 International (CC BY 4.0)
- License text: https://creativecommons.org/licenses/by/4.0/
- Changes: the hull, turret, machine gun, mantlet and cannon are regrouped into explicit articulation joints. Eight double-road-wheel stations per side, the front drive sprocket and rear idler are independently centred and tagged with their physical roles. The non-welded cannon is preserved without decimation so the barrel remains continuous. Geometry is reduced to 29,566 triangles and compressed with Draco; native PBR textures, including AO, are capped at 512px and converted to WebP.
