import mongoose from 'mongoose'
import { bothTimestamps, schemaOptions } from './common.js'

// Members cluster.
export const memberSchema = new mongoose.Schema(
  {
    family_group_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FamilyGroup',
      default: null,
      index: true,
    },
    last_name: { type: String, required: true, trim: true },
    first_name: { type: String, required: true, trim: true },
    middle_name: { type: String, default: null },
    // Optional name suffix (Jr., Sr., III, ...). Kept deliberately short.
    prefix: { type: String, default: null, trim: true, maxlength: 12 },
    date_of_birth: { type: Date, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], default: null },
    citizenship: { type: String, default: null },
    relationship_status: {
      type: String,
      enum: ['single', 'married', 'widowed', 'separated', 'divorced'],
      default: null,
    },
    wedding_anniversary: { type: Date, default: null },
    communicant_class_graduate: { type: String, enum: ['Yes', 'No'], default: null },
    date_of_membership: { type: Date, default: null },
    membership_status: {
      type: String,
      enum: ['new', 'active', 'dormant', 'cancelled'],
      default: 'new',
      index: true,
    },
    membership_type: {
      type: String,
      enum: ['regular', 'associate', 'affiliate'],
      default: null,
    },
    phone_number: { type: String, default: null },
    email_address: { type: String, default: null },
    street_address: { type: String, default: null },
    village: { type: String, default: null },
    barangay: { type: String, default: null },
    city: { type: String, default: null },
    registered_at: { type: Date, default: Date.now },
    // The bytes live in the images cluster; this only says whether to render
    // one. serializeMember() turns it into a `/api/images/<id>` URL.
    has_profile_picture: { type: Boolean, default: false },
    // No default: the sparse unique index must only contain assigned codes.
    member_code: { type: String, unique: true, sparse: true },
  },
  { ...schemaOptions, timestamps: bothTimestamps }
)

memberSchema.index({ last_name: 1, first_name: 1 })
