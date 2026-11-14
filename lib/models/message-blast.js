import mongoose from 'mongoose'
import { createdAtOnly, schemaOptions } from './common.js'

// Members cluster.
export const messageBlastSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    audience: { type: mongoose.Schema.Types.Mixed, default: {} },
    recipient_count: { type: Number, default: 0 },
    sent_count: { type: Number, default: 0 },
    failed_count: { type: Number, default: 0 },
    skipped_count: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['sending', 'sent', 'partial', 'failed'],
      default: 'sending',
    },
    // ObjectId of a user in the admin cluster. Populated manually, never with
    // Mongoose populate(), because it lives in a different connection.
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
  },
  { ...schemaOptions, timestamps: createdAtOnly }
)

messageBlastSchema.index({ created_at: -1 })
