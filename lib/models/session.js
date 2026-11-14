import mongoose from 'mongoose'
import { createdAtOnly, schemaOptions } from './common.js'

// Admin cluster.
export const sessionSchema = new mongoose.Schema(
  {
    token_hash: { type: String, required: true, unique: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expires_at: { type: Date, required: true, index: true },
  },
  { ...schemaOptions, timestamps: createdAtOnly }
)
