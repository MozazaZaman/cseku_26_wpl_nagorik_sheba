import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const MODELS_DIR = path.join(__dirname, '..', '..', 'models');
// 0.60 is face-api recommended; 0.62 gives authentic users a little extra tolerance for NID photo quality/lighting
export const FACE_MATCH_THRESHOLD = 0.62;
export const FACE_MATCH_THRESHOLD_STRICT = 0.55;

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
  // Try progressively more permissive detection for NID cards (small face, glare, low res)
  const attempts = [
    new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.25 }),
    new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }),
    new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }),
  ];
  for (const options of attempts) {
    const result = await faceapi.detectSingleFace(canvas, options).withFaceLandmarks().withFaceDescriptor();
    if (result) return result;
  }
  return null;
}

export async function compareFaces(selfiePath, idPhotoPath) {
  if (!state.ready) return { available: false };
  try {
    const selfie = await describe(selfiePath);
    const idFace = await describe(idPhotoPath);
    if (!selfie) return { available: true, matched: false, reason: 'No clear face detected in the selfie. Please retake with good front lighting, no mask/glasses, and look straight at the camera.' };
    if (!idFace) return { available: true, matched: false, reason: 'No clear face detected on the ID card photo. Please retake the whole card clearly in good light without glare or blur.' };
    const distance = state.faceapi.euclideanDistance(selfie.descriptor, idFace.descriptor);
    const matched = distance <= FACE_MATCH_THRESHOLD;
    const confidence = distance <= FACE_MATCH_THRESHOLD_STRICT ? 'high' : distance <= FACE_MATCH_THRESHOLD ? 'medium' : 'low';
    return { available: true, matched, distance: Math.round(distance * 1000) / 1000, confidence };
  } catch (e) {
    return { available: true, matched: false, reason: 'Face analysis failed: ' + e.message };
  }
}
