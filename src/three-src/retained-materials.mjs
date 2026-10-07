// Optional integration example; not auto-executed and not embedded into the GLB.
// The system owner reviews it against current source before calling it.
export function applyRetainedMaterialPresets(fluidGroup, presets) {
  const resolved = presets.objects.map(p => {
    const matches=[];
    fluidGroup.traverse(o=>{if(o.isMesh&&o.name===p.name&&p.position.every((v,i)=>Math.abs(o.position.getComponent(i)-v)<1e-6))matches.push(o);});
    if(matches.length!==1)throw new Error('Exact retained-material target mismatch: '+p.name+' '+p.position.join(','));
    const mesh=matches[0];if(Array.isArray(mesh.material)||!mesh.material.isMeshStandardMaterial)throw new Error('Unexpected retained material type');
    return {mesh,p};
  });
  const changes=[];
  for(const {mesh,p} of resolved){
    const oldMaterial=mesh.material;
    if(p.name==='uv-c-reactor'){
      // Preserve the unique material object captured by the UV update closure.
      const old={color:oldMaterial.color.clone(),metalness:oldMaterial.metalness,roughness:oldMaterial.roughness};
      oldMaterial.color.setRGB(...p.linearRGB);oldMaterial.metalness=p.metalness;oldMaterial.roughness=p.roughness;
      changes.push(()=>{oldMaterial.color.copy(old.color);oldMaterial.metalness=old.metalness;oldMaterial.roughness=old.roughness;});
    }else{
      // Bodies/caps share source materials with unrelated panels and fittings.
      // Isolate only the selected Mesh material; retain the Mesh and geometry.
      const isolated=oldMaterial.clone();isolated.name=oldMaterial.name+' | reviewed midtone preset';
      isolated.color.setRGB(...p.linearRGB);isolated.metalness=p.metalness;isolated.roughness=p.roughness;mesh.material=isolated;
      changes.push(()=>{mesh.material=oldMaterial;isolated.dispose();});
    }
  }
  // No opacity/transparent/depthWrite/emission/state/geometry/transform field is changed.
  return {rollback(){for(const undo of changes.reverse())undo();}};
}
