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

    // Set when an invite link is used: the address was proven to belong to
    // whoever opened the message. Accounts seeded with create-admin.js are
    // trusted and marked verified at creation time.
    email_verified_at: { type: Date, default: null },
    // Set when an invitation is sent, so the admin console can tell a pending
    // invite apart from an account that was set up manually.
    invited_at: { type: Date, default: null },
    password_changed_at: { type: Date, default: null },
    last_login_at: { type: Date, default: null },
  },
  { ...schemaOptions, timestamps: bothTimestamps }
)
