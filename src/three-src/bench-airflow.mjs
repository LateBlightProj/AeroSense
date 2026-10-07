// Call update(deltaSeconds) from the application's EXISTING render loop.
// Pass the actual displayed model instance, not an unrendered loader template.
export function attachBenchAirflow(THREE, displayedModel, animations) {
  const flowRoot = displayedModel.getObjectByName('Airflow_Illustrative_Root');
  const clip = animations.find(a => a.name === 'Airflow_Loop');
  if (!flowRoot || !clip) throw new Error('Clean bench airflow root or Airflow_Loop is missing');
  const mixer = new THREE.AnimationMixer(displayedModel);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.enabled = true;
  action.clampWhenFinished = false;
  action.timeScale = 1;
  action.play();
  let enabled = true;
  flowRoot.visible = true;
  return {
    mixer, action, flowRoot,
    durationSeconds: clip.duration,
    getPhase() { return (action.time % clip.duration) / clip.duration; },
    update(deltaSeconds) {
      if (enabled && Number.isFinite(deltaSeconds) && deltaSeconds > 0) mixer.update(deltaSeconds);
    },
    setEnabled(value) {
      enabled = Boolean(value);
      flowRoot.visible = enabled;
      action.paused = !enabled;
    },
    dispose() { action.stop(); mixer.uncacheRoot(displayedModel); }
  };
}
