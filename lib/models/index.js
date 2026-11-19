import { connectDB } from '../db.js'
import { userSchema } from './user.js'
import { sessionSchema } from './session.js'
import { authTokenSchema } from './auth-token.js'
import { familyGroupSchema } from './family-group.js'
import { memberSchema } from './member.js'
import { relationshipSchema } from './relationship.js'
import { messageBlastSchema } from './message-blast.js'
import { messageBlastRecipientSchema } from './message-blast-recipient.js'
import { imageSchema } from './image.js'
import { pendingPhotoSchema } from './pending-photo.js'

export { RELATIONSHIP_TYPES } from './relationship.js'

// Which schemas live on which cluster.
const DOMAIN_SCHEMAS = {
  admin: {
    User: userSchema,
    Session: sessionSchema,
    AuthToken: authTokenSchema,
  },
  members: {
    FamilyGroup: familyGroupSchema,
    Member: memberSchema,
    Relationship: relationshipSchema,
    MessageBlast: messageBlastSchema,
    MessageBlastRecipient: messageBlastRecipientSchema,
  },
  images: {
    Image: imageSchema,
    PendingPhoto: pendingPhotoSchema,
  },
}

const bound = {}

/**
 * Connect to a cluster and return its models, bound to that connection.
 *
 *   const { Member } = await modelsFor('members')
 *   const { User } = await modelsFor('admin')
 *   const { Image } = await modelsFor('images')
 *
 * Cross-cluster `populate()` does not work; reference ids manually.
 */
export async function modelsFor(domain) {
  if (bound[domain]) return bound[domain]

  const schemas = DOMAIN_SCHEMAS[domain]
  if (!schemas) throw new Error(`Unknown database domain: ${domain}`)

  const conn = await connectDB(domain)
  const models = {}
  for (const [name, schema] of Object.entries(schemas)) {
    models[name] = conn.models[name] || conn.model(name, schema)
  }

  bound[domain] = models
  return models
}
