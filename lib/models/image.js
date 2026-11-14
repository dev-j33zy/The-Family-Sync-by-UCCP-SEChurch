import mongoose from 'mongoose'
import { bothTimestamps, schemaOptions } from './common.js'

// Images cluster. One document per member photo, keyed by the member's
// ObjectId from the members cluster. `data` is raw base64 (no data: prefix).
export const imageSchema = new mongoose.Schema(
  {
    member_id: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    mime_type: { type: String, required: true },
    data: { type: String, required: true },
    byte_size: { type: Number, default: 0 },
  },
  { ...schemaOptions, timestamps: bothTimestamps }
)
