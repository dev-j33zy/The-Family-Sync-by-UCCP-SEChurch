import mongoose from 'mongoose'
import { createdAtOnly, schemaOptions } from './common.js'

// Members cluster.
export const RELATIONSHIP_TYPES = [
  'spouse',
  'father',
  'mother',
  'sibling',
  'child',
  'grandchild',
]

export const relationshipSchema = new mongoose.Schema(
  {
    member_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      index: true,
    },
    related_member_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      index: true,
    },
    relationship_type: { type: String, required: true, enum: RELATIONSHIP_TYPES },
  },
  { ...schemaOptions, timestamps: createdAtOnly }
)

relationshipSchema.index(
  { member_id: 1, related_member_id: 1, relationship_type: 1 },
  { unique: true }
)
