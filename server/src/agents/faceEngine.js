import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const MODELS_DIR = path.join(__dirname, '..', '..', 'models');
export const FACE_MATCH_THRESHOLD = 0.55;

let state = { ready: false, error: null, faceapi: null, loadImage: null };

export async function initFaceEngine() {
  if (state.ready || state.error) return state;
  try {
    const require = createRequire(import.meta.url);
    const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
    const napi = require('@napi-rs/canvas');
    const tf = faceapi.tf;
    try {
      await tf.setBackend('wasm');
    } catch {
      await tf.setBackend('cpu');
    }
    await tf.ready();
    class PatchedCanvas extends napi.Canvas {
      constructor(w = 300, h = 300) { super(w, h); }
    }
    faceapi.env.monkeyPatch({ Canvas: PatchedCanvas, Image: napi.Image, ImageData: napi.ImageData });
    await faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS_DIR);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_DIR);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_DIR);
    state = { ready: true, error: null, faceapi, loadImage: napi.loadImage };
  } catch (e) {
    state = { ready: false, error: e.message, faceapi: null, loadImage: null };
  }
  return state;
}

export function engineAvailable() {
  return state.ready;
}

async function describe(imagePath) {
  const { faceapi, loadImage } = state;
  const canvas = await loadImage(imagePath);
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 });
  const result = await faceapi.detectSingleFace(canvas, options).withFaceLandmarks().withFaceDescriptor();
  return result || null;
}

export async function compareFaces(selfiePath, idPhotoPath) {
  if (!state.ready) return { available: false };
  try {
    const selfie = await describe(selfiePath);
    const idFace = await describe(idPhotoPath);
    if (!selfie) return { available: true, matched: false, reason: 'No clear face detected in the selfie. Retake with good lighting.' };
    if (!idFace) return { available: true, matched: false, reason: 'No clear face detected on the ID card photo. Retake the whole card clearly.' };
    const distance = state.faceapi.euclideanDistance(selfie.descriptor, idFace.descriptor);
    const matched = distance <= FACE_MATCH_THRESHOLD;
    return { available: true, matched, distance: Math.round(distance * 1000) / 1000 };
  } catch (e) {
    return { available: true, matched: false, reason: 'Face analysis failed: ' + e.message };
  }
}
