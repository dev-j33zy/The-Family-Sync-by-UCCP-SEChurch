// Shared Mongoose schema options.
//
// Every model exposes a string `id` in JSON (instead of Mongo's `_id`) so the
// existing client code keeps working unchanged.
export const schemaOptions = {
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(_doc, ret) {
      ret.id = String(ret._id)
      delete ret._id
      return ret
    },
  },
  toObject: { virtuals: true },
}

// created_at only (no updated_at) for append-only collections.
export const createdAtOnly = { createdAt: 'created_at', updatedAt: false }

// Both created_at and updated_at.
export const bothTimestamps = { createdAt: 'created_at', updatedAt: 'updated_at' }
