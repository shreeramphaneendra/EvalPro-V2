const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload a buffer to Cloudinary.
// use_filename + unique_filename:false preserves the original filename in the URL.
const uploadBuffer = (buffer, options = {}) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:          'evalpro/assignments',
        resource_type:   'auto',
        use_filename:    true,
        unique_filename: false,
        ...options
      },
      (err, result) => err ? reject(err) : resolve(result)
    );
    stream.end(buffer);
  });

// Delete a file by public_id
const deleteFile = (publicId) =>
  cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });

// Returns true if Cloudinary is configured
const isConfigured = () =>
  !!(process.env.CLOUDINARY_CLOUD_NAME &&
     process.env.CLOUDINARY_API_KEY &&
     process.env.CLOUDINARY_API_SECRET);

// For PDFs: insert fl_attachment:false so they open inline in browser tab.
// For other files (Word, images): add fl_attachment with the original filename
// so browser downloads with the correct name instead of a hash/false.pdf.
const viewableUrl = (url, fileName) => {
  if (!url || !url.includes('cloudinary.com')) return url;
  const ext = (fileName || url).split('.').pop().toLowerCase();
  if (ext === 'pdf') {
    // Open inline in browser
    if (url.includes('fl_attachment')) return url;
    return url.replace('/upload/', '/upload/fl_attachment:false/');
  }
  // For other files: force download with correct filename
  const safe = (fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  if (url.includes('fl_attachment')) return url;
  return url.replace('/upload/', `/upload/fl_attachment:${safe}/`);
};

// Backwards-compat alias
const inlineUrl = viewableUrl;

module.exports = { uploadBuffer, deleteFile, isConfigured, inlineUrl, viewableUrl };
