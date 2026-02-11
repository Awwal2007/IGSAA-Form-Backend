const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  // Section A: General Information
  positionContested: {
    type: String,
    required: [true, 'Position contested is required'],
    trim: true
  },
  electionType: {
    type: String,
    enum: ['Executive Election', 'By-Election', 'Other'],
    required: [true, 'Election type is required']
  },
  otherElectionType: {
    type: String,
    trim: true
  },
  formNumber: {
    type: String,
    required: [true, 'Form number is required'],
    unique: true,
    trim: true
  },
  electionYear: {
    type: Number,
    default: 2026
  },
  
  // Section B: Candidate's Bio-Data
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Prefer not to say'],
    required: [true, 'Gender is required']
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  yearOfAdmission: {
    type: Number,
    required: [true, 'Year of admission is required'],
    min: [1900, 'Year must be after 1900'],
    max: [new Date().getFullYear(), 'Year cannot be in the future']
  },
  yearOfGraduation: {
    type: Number,
    required: [true, 'Year of graduation is required'],
    validate: {
      validator: function(value) {
        return value >= this.yearOfAdmission;
      },
      message: 'Graduation year must be after admission year'
    }
  },
  membershipNumber: {
    type: String,
    required: [true, 'Membership number is required'],
    trim: true
  },
  residentialAddress: {
    type: String,
    required: [true, 'Residential address is required'],
    trim: true
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^[\+]?[1-9][\d]{0,15}$/.test(v);
      },
      message: 'Invalid phone number format'
    }
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Invalid email format'
    }
  },
  
  // Section C: Membership & Eligibility
  isRegisteredMember: {
    type: Boolean,
    required: [true, 'Registration status is required']
  },
  isStanzaFinancial: {
    type: Boolean,
    required: [true, 'Stanza financial status is required']
  },
  hasPaidAllDues: {
    type: Boolean,
    required: [true, 'Dues payment status is required']
  },
  hasBeenDisciplined: {
    type: Boolean,
    required: [true, 'Discipline history is required']
  },
  disciplineDetails: {
    type: String,
    trim: true
  },
  
  // Section D: Experience & Service
  previousPositions: {
    type: String,
    trim: true
  },
  otherExperience: {
    type: String,
    trim: true
  },
  
  // Section E: 1st Sponsor
  sponsor1Name: {
    type: String,
    required: [true, 'First sponsor name is required'],
    trim: true
  },
  sponsor1Stanza: {
    type: String,
    required: [true, 'First sponsor stanza is required'],
    trim: true
  },
  sponsor1Date: {
    type: Date,
    required: [true, 'First sponsor date is required']
  },
  
  // Section F: 2nd Sponsor
  sponsor2Name: {
    type: String,
    required: [true, 'Second sponsor name is required'],
    trim: true
  },
  sponsor2Stanza: {
    type: String,
    required: [true, 'Second sponsor stanza is required'],
    trim: true
  },
  sponsor2Date: {
    type: Date,
    required: [true, 'Second sponsor date is required']
  },
  
  // Section G: Declaration
  declarationName: {
    type: String,
    required: [true, 'Declaration name is required'],
    trim: true
  },
  declarationDate: {
    type: Date,
    required: [true, 'Declaration date is required']
  },
  
  // File References (GridFS file IDs)
  passportPhoto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'uploads.files'
  },
  stanzaTestimony: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'uploads.files'
  },
  signature: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'uploads.files'
  },
  sponsorsSignature: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'uploads.files'
  },
  otherDocuments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'uploads.files'
  }],
  
  // Review fields
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  reviewNotes: String,
  adminNotes: [{
    note: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Timestamps
  submittedAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'submittedAt', updatedAt: 'updatedAt' }
});

// Index for better query performance
candidateSchema.index({ status: 1, submittedAt: -1 });
candidateSchema.index({ email: 1 });
candidateSchema.index({ formNumber: 1 }, { unique: true });
candidateSchema.index({ fullName: 'text', email: 'text', formNumber: 'text' });

// Pre-save middleware to generate form number if not provided
candidateSchema.pre('save', function(next) {
  if (!this.formNumber) {
    const year = this.electionYear || new Date().getFullYear();
    const random = Math.floor(10000 + Math.random() * 90000);
    this.formNumber = `IGSAA-${year}-${random}`;
  }
  
  // Validate graduation year is after admission year
  if (this.yearOfGraduation && this.yearOfAdmission) {
    if (this.yearOfGraduation < this.yearOfAdmission) {
      next(new Error('Graduation year must be after admission year'));
      return;
    }
  }
  
  next();
});

module.exports = mongoose.model('Candidate', candidateSchema);