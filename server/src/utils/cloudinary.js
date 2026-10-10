import { v2 as cloudinary } from 'cloudinary';

const configured =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

if (configured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

export const uploadsUseCloudinary = () => configured;

const FOLDER = process.env.CLOUDINARY_FOLDER || 'nagorik-sheba';

export function uploadBufferToCloudinary(buffer, { folder = FOLDER, resourceType = 'image' } = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

export function isAbsoluteUrl(v) {
  return typeof v === 'string' && /^https?:\/\//i.test(v);
}

export function toPublicImageUrl(stored) {
  if (!stored) return null;
  return stored;
}
