const express = require('express');
const router = express.Router();
const Candidate = require('../models/Candidate');
const User = require('../models/User');
const { authMiddleware, roleMiddleware, permissionMiddleware } = require('../middleware/auth');

// Apply auth middleware to all admin routes
router.use(authMiddleware);
router.use(roleMiddleware('admin', 'moderator', 'viewer'));

// Get all candidates with filters and pagination
router.get('/candidates', permissionMiddleware('read_forms'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      position,
      electionType,
      search,
      sortBy = 'submittedAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};
    
    if (status) filter.status = status;
    if (position) filter.positionContested = new RegExp(position, 'i');
    if (electionType) filter.electionType = electionType;
    
    if (search) {
      filter.$or = [
        { fullName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { membershipNumber: new RegExp(search, 'i') },
        { formNumber: new RegExp(search, 'i') }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get total count
    const total = await Candidate.countDocuments(filter);
    
    // Get candidates with pagination
    const candidates = await Candidate.find(filter)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      data: candidates,
      pagination: {
        total,
        totalPages,
        currentPage: parseInt(page),
        hasNextPage,
        hasPrevPage,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching candidates'
    });
  }
});

// Get candidate by ID
router.get('/candidates/:id', permissionMiddleware('read_forms'), async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    res.json({
      success: true,
      data: candidate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching candidate'
    });
  }
});

// Update candidate status
router.patch('/candidates/:id/status', permissionMiddleware('write_forms'), async (req, res) => {
  try {
    const { status, notes } = req.body;
    const { id } = req.params;
    
    const validStatuses = ['pending', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const candidate = await Candidate.findByIdAndUpdate(
      id,
      { 
        status,
        reviewedBy: req.user._id,
        reviewedAt: Date.now(),
        reviewNotes: notes
      },
      { new: true }
    );

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    res.json({
      success: true,
      message: 'Candidate status updated successfully',
      data: candidate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating candidate status'
    });
  }
});

// Add notes to candidate
router.post('/candidates/:id/notes', permissionMiddleware('write_forms'), async (req, res) => {
  try {
    const { notes } = req.body;
    const { id } = req.params;

    const candidate = await Candidate.findByIdAndUpdate(
      id,
      {
        $push: {
          adminNotes: {
            note: notes,
            createdBy: req.user._id,
            createdAt: Date.now()
          }
        }
      },
      { new: true }
    );

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }

    res.json({
      success: true,
      message: 'Note added successfully',
      data: candidate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding note'
    });
  }
});

// Get statistics
router.get('/statistics', permissionMiddleware('read_forms'), async (req, res) => {
  try {
    const totalCandidates = await Candidate.countDocuments();
    const pendingCandidates = await Candidate.countDocuments({ status: 'pending' });
    const approvedCandidates = await Candidate.countDocuments({ status: 'approved' });
    const rejectedCandidates = await Candidate.countDocuments({ status: 'rejected' });
    
    // Positions statistics
    const positions = await Candidate.aggregate([
      { $group: { _id: '$positionContested', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Monthly submissions
    const monthlySubmissions = await Candidate.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$submittedAt' },
            month: { $month: '$submittedAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]);

    res.json({
      success: true,
      data: {
        totalCandidates,
        pendingCandidates,
        approvedCandidates,
        rejectedCandidates,
        positions,
        monthlySubmissions
      }
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics'
    });
  }
});

// User Management Routes (Admin only)
router.use('/users', roleMiddleware('admin'));

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users'
    });
  }
});

// Create user
router.post('/users', async (req, res) => {
  try {
    const { email, password, fullName, role, permissions } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }
    
    const user = new User({
      email,
      password,
      fullName,
      role,
      permissions
    });
    
    await user.save();
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating user'
    });
  }
});

// Update user
router.put('/users/:id', async (req, res) => {
  try {
    const { fullName, role, permissions, isActive } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        fullName,
        role,
        permissions,
        isActive
      },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating user'
    });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting user'
    });
  }
});

module.exports = router;