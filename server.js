const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });



const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);
app.use(morgan('dev'))

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const connection = mongoose.connection;
let gfs;

connection.once('open', () => {
  console.log('MongoDB database connection established successfully');
  app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
  });
  // Initialize GridFS
  const { GridFSBucket } = require('mongodb');
  gfs = new GridFSBucket(connection.db, {
    bucketName: 'uploads'
  });
});

// Import Routes
const candidateRoutes = require('./routes/candidates');
const uploadRoutes = require('./routes/upload');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

// Routes
app.use('/api/candidates', candidateRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'IGSAA Backend API is running' });
});

