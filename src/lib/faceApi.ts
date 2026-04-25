// Lazy load @vladmandic/face-api to reduce initial bundle size
let faceapi: typeof import('@vladmandic/face-api') | null = null;
let modelsLoaded = false;
let tfInitialized = false;

// Initialize TensorFlow.js backend before using face-api
async function initTensorFlow() {
  if (tfInitialized) return;

  try {
    const tf = await import('@tensorflow/tfjs');
    // Explicitly set the backend to ensure it's initialized
    await tf.setBackend('cpu');
    await tf.ready();
    tfInitialized = true;
    console.log('✅ TensorFlow.js backend initialized');
  } catch (error) {
    console.error('❌ Failed to initialize TensorFlow.js:', error);
    throw error;
  }
}

// Dynamically import @vladmandic/face-api only when needed
async function loadFaceApiLibrary() {
  if (!faceapi) {
    // Ensure TF.js is initialized first
    await initTensorFlow();
    faceapi = await import('@vladmandic/face-api');
  }
  return faceapi;
}

// Load face-api.js models
export async function loadFaceApiModels() {
  if (modelsLoaded) {
    console.log('ℹ️ Models already loaded');
    return;
  }

  // Lazy load the library first
  const api = await loadFaceApiLibrary();

  // Use local models from public/models folder
  const MODEL_URL = '/models';

  console.log('📦 Loading Face-API models from:', MODEL_URL);

  try {
    console.log('⏳ Loading SSD MobileNet v1...');
    await api.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    console.log('✅ SSD MobileNet v1 loaded');

    console.log('⏳ Loading Face Landmark 68...');
    await api.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    console.log('✅ Face Landmark 68 loaded');

    console.log('⏳ Loading Face Recognition...');
    await api.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    console.log('✅ Face Recognition loaded');

    modelsLoaded = true;
    console.log('✅ All Face-API models loaded successfully');
  } catch (error) {
    console.error('❌ Error loading Face-API models:', error);
    throw error;
  }
}

// Detect face and get descriptor
export async function detectFace(videoElement: HTMLVideoElement) {
  if (!modelsLoaded) {
    console.log('📦 Models not loaded, loading now...');
    await loadFaceApiModels();
  }

  const api = await loadFaceApiLibrary();

  // Verify video element is ready
  if (!videoElement || videoElement.readyState < 2) {
    console.warn('⚠️ Video element not ready for detection');
    return null;
  }

  try {
    if (!faceapi) throw new Error('faceapi not loaded');
    const detection = await faceapi
      .detectSingleFace(videoElement, new api.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (detection) {
      console.log('👤 Face detection result:', {
        score: detection.detection.score,
        box: detection.detection.box,
        descriptorLength: detection.descriptor.length,
      });
    }

    return detection;
  } catch (error) {
    console.error('❌ Error detecting face:', error);
    return null;
  }
}

// Compare two face descriptors
export async function compareFaces(
  descriptor1: Float32Array,
  descriptor2: number[],
): Promise<number> {
  const api = await loadFaceApiLibrary();
  const distance = api.euclideanDistance(descriptor1, descriptor2);
  return distance;
}

// Check if face match is valid (threshold: 0.6 is common)
export function isFaceMatch(distance: number, threshold: number = 0.6): boolean {
  return distance < threshold;
}

// Find best matching face from a list
export async function findBestMatch(
  inputDescriptor: Float32Array,
  knownDescriptors: { userId: string; name: string; descriptor: number[] }[],
): Promise<{ userId: string; name: string; distance: number } | null> {
  if (knownDescriptors.length === 0) return null;

  let bestMatch = {
    userId: knownDescriptors[0]!.userId,
    name: knownDescriptors[0]!.name,
    distance: await compareFaces(inputDescriptor, knownDescriptors[0]!.descriptor),
  };

  for (let i = 1; i < knownDescriptors.length; i++) {
    const distance = await compareFaces(inputDescriptor, knownDescriptors[i]!.descriptor);
    if (distance < bestMatch.distance) {
      bestMatch = {
        userId: knownDescriptors[i]!.userId,
        name: knownDescriptors[i]!.name,
        distance,
      };
    }
  }

  return bestMatch;
}

// Create canvas from video for display
export function createCanvasFromVideo(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(video, 0, 0);
  }
  return canvas;
}

// Convert canvas to blob for upload
export async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      'image/jpeg',
      0.95,
    );
  });
}
