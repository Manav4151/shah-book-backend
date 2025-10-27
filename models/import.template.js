import { Schema, model } from 'mongoose';

const importTemplateSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  userId: {
    type: String,
    required: true,
    default: 'anonymous'
  },
  mapping: {
    type: Map,
    of: String,
    required: true
  },
  expectedHeaders: [{
    type: String,
    required: true
  }],
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsedAt: {
    type: Date
  }
}, {
  timestamps: true
});

export default model('ImportTemplate', importTemplateSchema);