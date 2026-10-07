import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import model from './models/aerosense_ise_calibration_v1.glb';
import {mountISECalibrationView} from './ise/ise-calibration-view.mjs';

// The preparation controller owns every calibration result and the five-second clock.
// This canvas renders the current absolute state and never runs the GLB clip separately.
export function mountISEEquipmentView(image:HTMLImageElement){
 const lowPower=(navigator.hardwareConcurrency||8)<=4||(Number((navigator as any).deviceMemory)||8)<=4||new URLSearchParams(location.search).has('lowPower');
 return mountISECalibrationView({
  THREE,GLTFLoader,image,modelUrl:'data:model/gltf-binary;base64,'+model,
  maxPixelRatio:lowPower?1:1.25,
  readState:()=>((window as any).__AEROSENSE_PREPARATION__?.state().ise),
  isVisible:()=>{const layer=document.getElementById('eventLayer');return !!layer?.classList.contains('open')&&layer.getAttribute('aria-hidden')!=='true'&&image.closest('[data-ise-calibration]')?.isConnected;},
 });
}
