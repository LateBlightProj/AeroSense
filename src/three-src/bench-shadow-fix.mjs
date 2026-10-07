// Three.js r180. One cached directional shadow; no material, camera, or business-clock changes.
const installed = new WeakMap();
export function installBenchShadows(THREE, {renderer, model, key, quality = 'standard'}) {
  if (installed.has(model)) return installed.get(model);
  if (!key?.isDirectionalLight) throw new Error('Pass the existing bench directional key');
  const snapshots = [];
  const isEffect = object => {
    for (let o = object; o && o !== model; o = o.parent) if (/^(Airflow_|Anchor_)/.test(o.name)) return true;
    return false;
  };
  model.traverse(object => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const transparent = materials.some(m => m.transparent || m.opacity < .98 || (m.transmission || 0) > 0);
    const eligible = !isEffect(object) && !transparent;
    snapshots.push({object, cast:object.castShadow, receive:object.receiveShadow, eligible});
  });
  const oldCast = key.castShadow, originalShadow = key.shadow;
  const shadow = originalShadow.clone(); // Own new GPU maps; preserve an existing map for rollback.
  const size = Math.min(quality === 'low' ? 512 : 1024, renderer.capabilities?.maxTextureSize || 1024);
  shadow.mapSize.set(size,size); shadow.bias = -.00005;
  shadow.normalBias = quality === 'low' ? .0025 : .0015;
  shadow.autoUpdate = false; shadow.needsUpdate = true;
  let enabled = false, disposed = false;
  const canvas=renderer.domElement;
  const contextRestored=()=>{ if (!disposed && enabled) shadow.needsUpdate=true; };
  function fitShadow() {
    model.updateWorldMatrix(true,true); key.updateWorldMatrix(true,false); key.target.updateWorldMatrix(true,false);
    const bounds = new THREE.Box3();
    for (const {object,eligible} of snapshots) if (eligible) {
      object.geometry.computeBoundingBox(); // markDirty may follow an in-place vertex edit.
      bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
    }
    if (bounds.isEmpty()) throw new Error('No opaque bench geometry to fit');
    shadow.updateMatrices(key);
    const view = shadow.camera.matrixWorldInverse, lightBounds = new THREE.Box3();
    for (const x of [bounds.min.x,bounds.max.x]) for (const y of [bounds.min.y,bounds.max.y]) for (const z of [bounds.min.z,bounds.max.z]) lightBounds.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(view));
    const c = shadow.camera, pad = .10;
    c.left=lightBounds.min.x-pad; c.right=lightBounds.max.x+pad;
    c.bottom=lightBounds.min.y-pad; c.top=lightBounds.max.y+pad;
    c.near=Math.max(.02,-lightBounds.max.z-pad); c.far=Math.max(c.near+.5,-lightBounds.min.z+pad);
    c.updateProjectionMatrix(); shadow.updateMatrices(key); shadow.needsUpdate=true;
    return bounds;
  }
  function setEnabled(value) {
    if (disposed) throw new Error('Shadow helper disposed');
    enabled=Boolean(value); key.castShadow=enabled || oldCast; key.shadow=enabled?shadow:originalShadow;
    for (const s of snapshots) { s.object.castShadow=enabled?s.eligible:s.cast; s.object.receiveShadow=enabled?s.eligible:s.receive; }
    if (enabled) fitShadow();
  }
  const api = {
    setEnabled,
    markDirty() { if (enabled) fitShadow(); }, // Call after sash/root/opaque-geometry/light changes, not airflow or camera orbit.
    render(renderCallback) {
      if (disposed) throw new Error('Shadow helper disposed');
      const oldEnabled=renderer.shadowMap.enabled, oldNeeds=renderer.shadowMap.needsUpdate;
      try {
        if (enabled) { renderer.shadowMap.enabled=true; if (shadow.needsUpdate) renderer.shadowMap.needsUpdate=true; }
        return renderCallback(); // Synchronous renderer.render(...) only.
      } finally { renderer.shadowMap.enabled=oldEnabled; renderer.shadowMap.needsUpdate=oldNeeds; }
    },
    inspect() { return {enabled, mapSize:shadow.mapSize.toArray(), opaqueCasters:snapshots.filter(x=>x.eligible).length, excluded:snapshots.filter(x=>!x.eligible).map(x=>x.object.name), shadowAutoUpdate:shadow.autoUpdate, globalShadowTypeUnchanged:true, near:shadow.camera.near, far:shadow.camera.far}; },
    dispose() {
      if (disposed) return;
      setEnabled(false); canvas?.removeEventListener?.('webglcontextrestored',contextRestored); shadow.dispose(); installed.delete(model); disposed=true;
    }
  };
  try {
    setEnabled(true);
    canvas?.addEventListener?.('webglcontextrestored',contextRestored);
    installed.set(model,api);
    return api;
  } catch (error) { api.dispose(); throw error; }
}
