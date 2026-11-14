import mongoose from 'mongoose'
import { createdAtOnly, schemaOptions } from './common.js'

// Members cluster.
export const familyGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
  },
  { ...schemaOptions, timestamps: createdAtOnly }
)
