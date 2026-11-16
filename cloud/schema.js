const OPEN_TO_CLERK_USERS = {
  find: { '*': true },
  count: { '*': true },
  get: { '*': true },
  create: { '*': true },
  update: { '*': true },
  delete: { '*': true },
  addField: {},
  protectedFields: { '*': [] },
};

const MASTER_KEY_ONLY = {
  find: {},
  count: {},
  get: {},
  create: {},
  update: {},
  delete: {},
  addField: {},
  protectedFields: {},
};

module.exports = {
  lockSchemas: true,
  definitions: [
    {
      className: '_User',
      classLevelPermissions: MASTER_KEY_ONLY,
    },
    {
      className: '_Role',
      classLevelPermissions: MASTER_KEY_ONLY,
    },
    {
      className: '_Session',
      classLevelPermissions: MASTER_KEY_ONLY,
    },
    {
      className: '_Installation',
      classLevelPermissions: MASTER_KEY_ONLY,
    },
    {
      className: 'Preference',
      fields: {
        type: { type: 'String' },
        enemy: { type: 'Array' },
        mic: { type: 'Array' },
        objective: { type: 'Array' },
        difficulty: { type: 'Array' },
        clerkUserId: { type: 'String' },
      },
      classLevelPermissions: OPEN_TO_CLERK_USERS,
    },
    {
      className: 'Profile',
      fields: {
        gamerTag: { type: 'String' },
        preference: { type: 'Pointer', targetClass: 'Preference' },
        status: { type: 'String' },
        clerkUserId: { type: 'String' },
      },
      classLevelPermissions: OPEN_TO_CLERK_USERS,
    },
    {
      className: 'Squad',
      fields: {
        code: { type: 'String' },
        preference: { type: 'Pointer', targetClass: 'Preference' },
        host: { type: 'Pointer', targetClass: 'Profile' },
        guestOne: { type: 'Pointer', targetClass: 'Profile' },
        guestTwo: { type: 'Pointer', targetClass: 'Profile' },
        guestThree: { type: 'Pointer', targetClass: 'Profile' },
        clerkUserId: { type: 'String' },
      },
      classLevelPermissions: OPEN_TO_CLERK_USERS,
    },
  ],
};
