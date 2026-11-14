import mongoose from 'mongoose'
import { bothTimestamps, schemaOptions } from './common.js'

// Admin cluster.
export const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    role: { type: String, enum: ['Administrator'], default: 'Administrator' },
    first_name: { type: String, default: null },
    last_name: { type: String, default: null },
    display_name: { type: String, default: null },
  },
  { ...schemaOptions, timestamps: bothTimestamps }
)
