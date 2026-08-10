import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Uploads a base64 data URI (or remote URL) buffer to Cloudinary.
// `fileBase64` should already include the data URI prefix, e.g. "data:application/pdf;base64,...."
export async function uploadToCloudinary(fileBase64, folder = "ksu-procurement") {
  const result = await cloudinary.uploader.upload(fileBase64, {
    folder,
    resource_type: "auto", // handles pdf/doc/image correctly
  });
  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

export async function deleteFromCloudinary(publicId) {
  return cloudinary.uploader.destroy(publicId, { resource_type: "auto" });
}

export default cloudinary;
