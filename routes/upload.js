const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');

// Configure multer for memory storage
const storage = multer.memoryStorage();

const allowedMimeTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
  'image/webp', 
  'application/msword',           // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
];

const fileFilter = (req, file, cb) => {
  console.log('Uploaded file type:', file.mimetype);

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Error: File type not supported!'));
  }
};

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Max 10 files
  },
  fileFilter: fileFilter
});

// Initialize GridFSBucket - FIXED: Make sure connection is ready
let gfs;
let gridfsBucket;

const conn = mongoose.connection;

conn.once('open', () => {
  console.log('GridFSBucket initialized');
  gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'uploads'
  });
  gfs = gridfsBucket;
});

// Helper function to get GridFS bucket
const getGridFS = () => {
  if (!gridfsBucket) {
    throw new Error('GridFSBucket not initialized');
  }
  return gridfsBucket;
};

// Helper function to get file collection
const getFileCollection = () => {
  if (!conn || !conn.db) {
    throw new Error('Database connection not ready');
  }
  return conn.db.collection('uploads.files');
};

// Upload single file
router.post('/single', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Check if GridFS is initialized
    if (!gridfsBucket) {
      return res.status(500).json({
        success: false,
        message: 'GridFSBucket not initialized. Please try again.'
      });
    }

    // Generate unique filename
    const filename = crypto.randomBytes(16).toString('hex') + 
                     path.extname(req.file.originalname);
    
    // Create upload stream
    const uploadStream = gridfsBucket.openUploadStream(filename, {
      contentType: req.file.mimetype
    });
    
    // Write file buffer to GridFS
    uploadStream.end(req.file.buffer);
    
    uploadStream.on('finish', (file) => {
      res.json({
        success: true,
        fileId: file._id,
        filename: file.filename,
        contentType: file.contentType,
        size: file.length,
        message: 'File uploaded successfully'
      });
    });
    
    uploadStream.on('error', (error) => {
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Error uploading file'
      });
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading file'
    });
  }
});

// Upload multiple files
router.post('/multiple', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    if (!gridfsBucket) {
      return res.status(500).json({
        success: false,
        message: 'GridFSBucket not initialized. Please try again.'
      });
    }

    const uploadPromises = req.files.map((file) => {
      return new Promise((resolve, reject) => {
        const filename = crypto.randomBytes(16).toString('hex') + 
                         path.extname(file.originalname);
        
        const uploadStream = gridfsBucket.openUploadStream(filename, {
          contentType: file.mimetype
        });
        
        uploadStream.end(file.buffer);
        
        uploadStream.on('finish', (fileData) => {
          resolve({
            fileId: fileData._id,
            filename: fileData.filename,
            originalName: file.originalname,
            contentType: fileData.contentType,
            size: fileData.length
          });
        });
        
        uploadStream.on('error', reject);
      });
    });

    const uploadedFiles = await Promise.all(uploadPromises);
    
    res.json({
      success: true,
      files: uploadedFiles,
      message: 'Files uploaded successfully'
    });
    
  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading files'
    });
  }
});

// Get file by filename
router.get('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!gridfsBucket) {
      return res.status(500).json({
        success: false,
        message: 'GridFSBucket not initialized. Please try again.'
      });
    }

    // First get file info to know the content type
    const filesCollection = getFileCollection();
    const file = await filesCollection.findOne({ filename });
    
    if (!file) {
      return res.status(404).json({ 
        success: false,
        message: 'File not found' 
      });
    }

    // Set proper headers
    res.set('Content-Type', file.contentType);
    res.set('Content-Disposition', `inline; filename="${file.filename}"`);
    
    const downloadStream = gridfsBucket.openDownloadStreamByName(filename);
    
    downloadStream.pipe(res);
    
    downloadStream.on('error', (err) => {
      console.error('Download error:', err);
      res.status(500).json({ 
        success: false,
        message: 'Error downloading file' 
      });
    });
    
  } catch (error) {
    console.error('File retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving file'
    });
  }
});

// Get file by ID
router.get('/id/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file ID'
      });
    }

    if (!gridfsBucket) {
      return res.status(500).json({
        success: false,
        message: 'GridFSBucket not initialized. Please try again.'
      });
    }

    // First get file info to know the content type
    const filesCollection = getFileCollection();
    const file = await filesCollection.findOne({ _id: new mongoose.Types.ObjectId(id) });
    
    if (!file) {
      return res.status(404).json({ 
        success: false,
        message: 'File not found' 
      });
    }

    // Set proper headers
    res.set('Content-Type', file.contentType);
    res.set('Content-Disposition', `inline; filename="${file.filename}"`);
    
    const downloadStream = gridfsBucket.openDownloadStream(file._id);
    
    downloadStream.pipe(res);
    
    downloadStream.on('error', (err) => {
      console.error('Download error:', err);
      res.status(500).json({ 
        success: false,
        message: 'Error downloading file' 
      });
    });
    
  } catch (error) {
    console.error('File retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving file'
    });
  }
});

// Delete file by ID
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file ID'
      });
    }

    if (!gridfsBucket) {
      return res.status(500).json({
        success: false,
        message: 'GridFSBucket not initialized. Please try again.'
      });
    }

    // Delete file from GridFS
    await gridfsBucket.delete(new mongoose.Types.ObjectId(id));
    
    res.json({
      success: true,
      message: 'File deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting file'
    });
  }
});

// Get file info by ID - FIXED
router.get('/info/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file ID'
      });
    }

    // Check if database connection is ready
    if (!conn || !conn.db) {
      return res.status(500).json({
        success: false,
        message: 'Database connection not ready'
      });
    }

    const filesCollection = conn.db.collection('uploads.files');
    const files = await filesCollection.find({
      _id: new mongoose.Types.ObjectId(id)
    }).toArray();

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Also get chunks info for size verification
    const chunksCollection = conn.db.collection('uploads.chunks');
    const chunks = await chunksCollection.find({
      files_id: new mongoose.Types.ObjectId(id)
    }).toArray();

    const fileInfo = {
      ...files[0],
      chunks: chunks.length,
      totalSize: chunks.reduce((acc, chunk) => acc + chunk.data.length, 0)
    };

    res.json({
      success: true,
      file: fileInfo
    });
    
  } catch (error) {
    console.error('File info error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting file info'
    });
  }
});

// Get all files (optional, for debugging)
router.get('/', async (req, res) => {
  try {
    if (!conn || !conn.db) {
      return res.status(500).json({
        success: false,
        message: 'Database connection not ready'
      });
    }

    const filesCollection = conn.db.collection('uploads.files');
    const files = await filesCollection.find().toArray();
    
    res.json({
      success: true,
      files: files.map(file => ({
        id: file._id,
        filename: file.filename,
        contentType: file.contentType,
        size: file.length,
        uploadDate: file.uploadDate
      }))
    });
    
  } catch (error) {
    console.error('Get all files error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching files'
    });
  }
});

module.exports = router;