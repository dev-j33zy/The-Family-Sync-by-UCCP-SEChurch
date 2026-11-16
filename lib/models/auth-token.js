import mongoose from 'mongoose'
import { createdAtOnly, schemaOptions } from './common.js'

// Admin cluster.
//
// One row per live invite / password-reset link. Only the SHA-256 hash of the
// token is stored, so a database read cannot be turned into a working link.
// Consuming a row sets `used_at`, which makes the link single-use even when
// two requests race.
export const authTokenSchema = new mongoose.Schema(
  {
    token_hash: { type: String, required: true, unique: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purpose: { type: String, enum: ['invite', 'reset'], required: true },
    expires_at: { type: Date, required: true },
    used_at: { type: Date, default: null },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    requested_ip: { type: String, default: null },
  },
  { ...schemaOptions, timestamps: createdAtOnly }
)

// Expired rows are dead weight; let MongoDB remove them.
authTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 })
