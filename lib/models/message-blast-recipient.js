import mongoose from 'mongoose'
import { createdAtOnly, schemaOptions } from './common.js'

// Members cluster.
export const messageBlastRecipientSchema = new mongoose.Schema(
  {
    blast_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MessageBlast',
      required: true,
      index: true,
    },
    member_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      default: null,
      index: true,
    },
    member_name: { type: String, default: null },
    phone_number: { type: String, default: null },
    rendered_message: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'skipped'],
      default: 'pending',
    },
    error: { type: String, default: null },
    provider_sid: { type: String, default: null },
  },
  { ...schemaOptions, timestamps: createdAtOnly }
)
