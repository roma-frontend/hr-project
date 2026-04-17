'use server';

import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload any file (PDF, image, doc, etc.) for task attachments
export async function uploadTaskAttachment(base64File: string, fileName: string): Promise<string> {
  try {
    const publicId = `task_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)}`;
    const result = await cloudinary.uploader.upload(base64File, {
      folder: 'hr-office/task-attachments',
      public_id: publicId,
      resource_type: 'auto', // auto-detect: image, video, raw (pdf, doc, etc.)
      overwrite: false,
    });
    return result.secure_url;
  } catch (error) {
    console.error('❌ Attachment upload error:', error);
    throw new Error(error instanceof Error ? error.message : 'Upload failed');
  }
}

export async function uploadAvatarToCloudinary(
  base64Image: string,
  userId: string,
): Promise<string> {
  console.log('☁️ Cloudinary signed upload starting...');
  console.log('👤 User ID:', userId);

  try {
    console.log('📤 Uploading to Cloudinary with SDK...');

    const result = await cloudinary.uploader.upload(base64Image, {
      folder: 'hr-office/avatars',
      public_id: userId,
      overwrite: true,
      transformation: [
        { width: 200, height: 200, crop: 'fill', gravity: 'face' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
    });

    console.log('✅ Upload successful!');
    console.log('🔗 URL:', result.secure_url);

    return result.secure_url;
  } catch (error) {
    console.error('❌ Upload error:', error);
    throw new Error(error instanceof Error ? error.message : 'Upload failed');
  }
}

export async function uploadChatAttachment(
  base64File: string,
  fileName: string,
  mimeType: string,
): Promise<{ url: string; name: string; type: string }> {
  console.log('🎤 Voice message upload starting...');
  console.log('📄 File name:', fileName);
  console.log('📄 MIME type:', mimeType);
  console.log('📄 Base64 size:', base64File.length);

  // Validate environment variables
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.error('❌ Missing Cloudinary credentials:', {
      cloudName: !!cloudName,
      apiKey: !!apiKey,
      apiSecret: !!apiSecret,
    });
    throw new Error('Cloudinary credentials not configured');
  }

  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
  const publicId = `chat_${Date.now()}_${safeFileName}`;

  // Determine resource type based on mime type
  let resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto';
  if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) {
    resourceType = 'video'; // Cloudinary stores audio files as video resources
  }

  // Add data URL prefix if not present (required for proper upload)
  let uploadData = base64File;
  if (!base64File.startsWith('data:')) {
    uploadData = `data:${mimeType};base64,${base64File}`;
    console.log('📝 Added data URL prefix');
  }

  console.log('📤 Uploading to Cloudinary...', {
    publicId,
    resourceType,
    folder: 'hr-office/chat-attachments',
  });

  try {
    const result = await cloudinary.uploader.upload(uploadData, {
      folder: 'hr-office/chat-attachments',
      public_id: publicId,
      resource_type: resourceType,
      overwrite: false,
      unique_filename: true,
      // For audio files, add specific transformations
      ...(resourceType === 'video'
        ? {
            eager: [{ width: 0, height: 0, crop: 'scale', audio_codec: 'aac' }],
            eager_async: true,
          }
        : {}),
    });

    console.log('✅ Voice message uploaded successfully:', result.secure_url);
    return { url: result.secure_url, name: fileName, type: mimeType };
  } catch (error: any) {
    console.error('❌ Voice message upload failed:', error);
    console.error('❌ Error details:', {
      message: error?.message,
      error: error?.error,
      status: error?.status,
      http_code: error?.http_code,
    });
    const errorMessage = error instanceof Error ? error.message : 'Upload failed';
    throw new Error(`Voice message upload error: ${errorMessage}`);
  }
}

export async function deleteAvatarFromCloudinary(userId: string): Promise<void> {
  console.log('🗑️ Cloudinary delete starting...');
  console.log('👤 User ID:', userId);

  try {
    const publicId = `hr-office/avatars/${userId}`;
    console.log('📤 Deleting from Cloudinary:', publicId);

    const result = await cloudinary.uploader.destroy(publicId);

    console.log('✅ Delete result:', result);

    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error(`Delete failed: ${result.result}`);
    }
  } catch (error) {
    console.error('❌ Delete error:', error);
    throw new Error(error instanceof Error ? error.message : 'Delete failed');
  }
}

export async function deleteTaskAttachmentFromCloudinary(url: string): Promise<void> {
  console.log('🗑️ Cloudinary task attachment delete starting...');
  console.log('🔗 URL:', url);

  try {
    // Extract public_id from URL
    // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/v1234567890/hr-office/task-attachments/task_1234567890_filename.pdf
    const urlParts = url.split('/');
    const folderIndex = urlParts.findIndex((part) => part === 'task-attachments');
    if (folderIndex === -1) {
      throw new Error('Invalid task attachment URL');
    }

    // Get the public_id (folder/filename without extension and version)
    const folder = urlParts[folderIndex];
    const filenameWithVersion = urlParts[folderIndex + 1];
    const filename = filenameWithVersion.replace(/^v\d+_/, '').split('.')[0];
    const publicId = `hr-office/${folder}/${filename}`;

    console.log('📤 Deleting from Cloudinary:', publicId);

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw', // task attachments can be any file type
    });

    console.log('✅ Delete result:', result);

    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error(`Delete failed: ${result.result}`);
    }
  } catch (error) {
    console.error('❌ Delete error:', error);
    throw new Error(error instanceof Error ? error.message : 'Delete failed');
  }
}
