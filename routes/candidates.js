const express = require('express');
const router = express.Router();
const Candidate = require('../models/Candidate');

// Create new candidate nomination
router.post('/', async (req, res) => {
  try {
    const candidateData = req.body;
    const candidate = new Candidate(candidateData);
    await candidate.save();
    
    res.status(201).json({
      success: true,
      message: 'Nomination submitted successfully',
      data: candidate,
      formNumber: candidate.formNumber
    });
  } catch (error) {
    console.error('Error submitting nomination:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get all candidates
router.get('/', async (req, res) => {
  try {
    const candidates = await Candidate.find().sort({ submittedAt: -1 });
    res.json({
      success: true,
      data: candidates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get candidate by ID
router.get('/:id', async (req, res) => {
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
      message: error.message
    });
  }
});

// Update candidate status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const candidate = await Candidate.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    
    res.json({
      success: true,
      message: 'Status updated successfully',
      data: candidate
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;