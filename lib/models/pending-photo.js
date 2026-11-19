import mongoose from 'mongoose'
import { bothTimestamps, schemaOptions } from './common.js'

// Images cluster. A photo proposed by a public registrant whose details matched
// an existing member. Held here until an administrator approves or rejects it;
// one pending photo per member (a new submission overwrites the old one).
// `data` is raw base64 (no data: prefix), same encoding as the Image model.
export const pendingPhotoSchema = new mongoose.Schema(
  {
    member_id: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    mime_type: { type: String, required: true },
    data: { type: String, required: true },
    byte_size: { type: Number, default: 0 },
    submitted_name: { type: String, default: '' },
    submitted_email: { type: String, default: '' },
  },
  { ...schemaOptions, timestamps: bothTimestamps }
)
