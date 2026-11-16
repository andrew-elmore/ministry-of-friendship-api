const { CLERK_USER_HEADER } = require('../auth/clerkAuth');

const GUEST_SLOTS = ['guestOne', 'guestTwo', 'guestThree'];
const PLACEHOLDER_GAMER_TAGS = ['OPEN', 'CLASSIFIED'];

/**
 * The Clerk user id that the API's Clerk middleware verified for this request.
 * @param {Parse.Cloud.TriggerRequest} request
 * @returns {string}
 */
const clerkUserIdOf = (request) => {
  const clerkUserId = request.headers && request.headers[CLERK_USER_HEADER];
  if (!clerkUserId) {
    throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, 'A valid Clerk session is required.');
  }
  return clerkUserId;
};

/**
 * Stamps a new record with its creator's Clerk user id, or confirms the requester owns an existing record.
 * @param {Parse.Cloud.TriggerRequest} request
 * @returns {string} The requester's Clerk user id.
 */
const claimOrRequireOwner = (request) => {
  const clerkUserId = clerkUserIdOf(request);
  if (request.original && request.original.get('clerkUserId') !== clerkUserId) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Only the owner can change this record.');
  }
  request.object.set('clerkUserId', clerkUserId);
  return clerkUserId;
};

/**
 * Blocks deletes by anyone other than the record's owner.
 * @param {Parse.Cloud.TriggerRequest} request
 */
const requireOwnerToDelete = (request) => {
  if (request.master) return;
  if (request.object.get('clerkUserId') !== clerkUserIdOf(request)) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Only the owner can delete this record.');
  }
};

/**
 * The Profile id belonging to a Clerk user, or the shared placeholder Profile with the given gamer tag.
 * @param {string} field Either clerkUserId or gamerTag.
 * @param {string} value
 * @returns {Promise<string|undefined>}
 */
const profileIdWhere = async (field, value) => {
  const profile = await new Parse.Query('Profile').equalTo(field, value).first({ useMasterKey: true });
  return profile && profile.id;
};

/**
 * Rejects a save that points the record at a Preference the requester does not own.
 * @param {Parse.Cloud.TriggerRequest} request
 * @param {string} clerkUserId
 * @returns {Promise<void>}
 */
const requireOwnPreference = async (request, clerkUserId) => {
  const preference = request.object.get('preference');
  if (!preference || !request.object.dirtyKeys().includes('preference')) return;
  const stored = await new Parse.Query('Preference').get(preference.id, { useMasterKey: true }).catch(() => null);
  if (!stored || stored.get('clerkUserId') !== clerkUserId) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'You can only use your own preference.');
  }
};

/**
 * Restricts a Parse built-in class that the schema cannot lock down to master key requests.
 * @param {Parse.Cloud.TriggerRequest} request
 */
const requireMasterKey = (request) => {
  if (!request.master) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'This class is not available to clients.');
  }
};

Parse.Cloud.beforeSave('_Audience', requireMasterKey);
Parse.Cloud.beforeDelete('_Audience', requireMasterKey);
Parse.Cloud.beforeFind('_Audience', requireMasterKey);

Parse.Cloud.define('ping', async () => {
  return 'pong';
});

Parse.Cloud.beforeSave('Profile', async (request) => {
  if (request.master) return;
  const clerkUserId = claimOrRequireOwner(request);
  const gamerTag = request.object.get('gamerTag');
  if (!gamerTag || PLACEHOLDER_GAMER_TAGS.includes(gamerTag.toUpperCase())) {
    throw new Parse.Error(Parse.Error.VALIDATION_ERROR, 'Choose a different gamer tag.');
  }
  if (!request.original && await profileIdWhere('clerkUserId', clerkUserId)) {
    throw new Parse.Error(Parse.Error.DUPLICATE_VALUE, 'This account already has a profile.');
  }
  await requireOwnPreference(request, clerkUserId);
});

Parse.Cloud.beforeDelete('Profile', requireOwnerToDelete);

Parse.Cloud.beforeSave('Preference', (request) => {
  if (request.master) return;
  claimOrRequireOwner(request);
});

Parse.Cloud.beforeDelete('Preference', requireOwnerToDelete);

Parse.Cloud.beforeSave('Squad', async (request) => {
  if (request.master) return;
  const clerkUserId = clerkUserIdOf(request);
  const myProfileId = await profileIdWhere('clerkUserId', clerkUserId);

  if (!request.original) {
    const host = request.object.get('host');
    if (!myProfileId || !host || host.id !== myProfileId) {
      throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'You can only host a squad as yourself.');
    }
    request.object.set('clerkUserId', clerkUserId);
    await requireOwnPreference(request, clerkUserId);
    return;
  }

  if (request.original.get('clerkUserId') === clerkUserId) {
    request.object.set('clerkUserId', clerkUserId);
    await requireOwnPreference(request, clerkUserId);
    return;
  }

  const openProfileId = await profileIdWhere('gamerTag', 'OPEN');
  const changedKeys = request.object.dirtyKeys();
  const isJoinOrLeave = changedKeys.length > 0 && changedKeys.every((slot) => {
    if (!GUEST_SLOTS.includes(slot)) return false;
    const before = request.original.get(slot) && request.original.get(slot).id;
    const after = request.object.get(slot) && request.object.get(slot).id;
    const joins = before === openProfileId && after === myProfileId;
    const leaves = before === myProfileId && after === openProfileId;
    return Boolean(myProfileId && openProfileId) && (joins || leaves);
  });
  const slotsHeld = GUEST_SLOTS.filter((slot) => {
    const guest = request.object.get(slot);
    return guest && guest.id === myProfileId;
  }).length;
  if (!isJoinOrLeave || slotsHeld > 1) {
    throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Only the host can change this squad.');
  }
});

Parse.Cloud.beforeDelete('Squad', requireOwnerToDelete);
