import { Schema, model } from 'mongoose';

const importTemplateSchema = new Schema({
  agentId: { type: Schema.Types.ObjectId, ref: "Agent", required: true },
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
importTemplateSchema.index({ agentId: 1 });
export default model('ImportTemplate', importTemplateSchema);