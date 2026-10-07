import * as T from 'three';

// Powder coat is a dark body finish. Bare steel, optics and indicators keep
// their own response; an imported room environment must not turn every body
// into the same glossy studio material.
export function finishEquipmentMaterial(material:T.Material){
 if(!(material instanceof T.MeshStandardMaterial))return 'other';
 const name=material.name;
 const coated=/deep_teal_panel|source_dark_base/.test(name)||['Porcelain | satin powder coat','Pale ceramic | inset panels'].includes(name);
 const frame=/graphite_frame|source_graphite_frame/.test(name)||name==='Graphite | structural powder coat';
 const black=/black_|dark_rubber|epdm_|gasket|Recesses|Feet|EPDM/.test(name);
 const steel=/satin_stainless|source_fastener_metal|source_satin_steel|Stainless steel|Aluminium/.test(name);
 const glass=/clear_glass|Glass/.test(name);
 if(coated){material.color.setHex(0x303334);material.metalness=.08;material.roughness=.80;material.envMapIntensity=.08;return 'dark-coat';}
 if(frame){material.color.setHex(0x323739);material.metalness=.12;material.roughness=.68;material.envMapIntensity=.08;return 'dark-frame';}
 if(black){material.envMapIntensity=.02;return 'black';}
 if(steel){material.envMapIntensity=.24;return 'steel';}
 if(glass){material.envMapIntensity=.16;return 'glass';}
 // Printed marks and active illumination are not body paint.
 material.envMapIntensity=.16;return 'retained';
}

export function finishEquipment(root:T.Object3D){
 const seen=new Set<T.Material>();
 const records:{name:string;role:string;linearRGB:number[];environment:number}[]=[];
 root.traverse(o=>{if(o instanceof T.Mesh)for(const material of Array.isArray(o.material)?o.material:[o.material]){
  if(seen.has(material))continue;seen.add(material);
  const role=finishEquipmentMaterial(material);
  if(material instanceof T.MeshStandardMaterial)records.push({name:material.name,role,linearRGB:material.color.toArray(),environment:material.envMapIntensity});
 }});
 return records;
}

// Reviewed dark-scene assets carry their own linear PBR values and embedded
// normal/roughness maps. Keep them intact and use the existing direct lights;
// the studio environment belongs to legacy assets, not these reviewed bodies.
export function preserveEmbeddedEquipment(root:T.Object3D){
 const seen=new Set<T.Material>(),records:{name:string;role:string;linearRGB:number[];environment:number}[]=[];
 root.traverse(o=>{if(o instanceof T.Mesh)for(const material of Array.isArray(o.material)?o.material:[o.material]){
  if(seen.has(material))continue;seen.add(material);
  if(material instanceof T.MeshStandardMaterial){material.envMap=null;material.envMapIntensity=0;records.push({name:material.name,role:'embedded-pbr',linearRGB:material.color.toArray(),environment:material.envMapIntensity});}
 }});
 return records;
}

// Restore only the B05 body paint to the original hardware's graphite palette.
// Keep embedded surface maps, roughness, metalness, optics and active LEDs.
export function restoreCabinetGraphite(root:T.Object3D){
 const palette:Record<string,number>={
  'B05_Dark | source_dark_base':0x303334,
  'B05_Dark | source_graphite_frame':0x323739,
  'B05_Dark | source_black_channel':0x191919,
  'B05_Dark | source_black_cloth':0x101010,
  'B05_Dark | dark_rubber':0x141414,
  'B05_Darkscene | black_oxide_joint':0x242829,
  'B05_Darkscene | satin_coated_edge':0x323739
 };
 const seen=new Set<T.Material>();
 root.traverse(o=>{if(o instanceof T.Mesh)for(const material of Array.isArray(o.material)?o.material:[o.material]){
  if(seen.has(material))continue;seen.add(material);
  const hex=palette[material.name];
  if(hex!==undefined&&material instanceof T.MeshStandardMaterial)material.color.setHex(hex);
 }});
}
