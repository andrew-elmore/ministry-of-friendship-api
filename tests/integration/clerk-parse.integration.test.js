const request = require('supertest');

const mockClerkSessions = {
  'Bearer alice-session': 'user_alice',
  'Bearer bob-session': 'user_bob',
  'Bearer carol-session': 'user_carol',
};

jest.mock('@clerk/express', () => ({
  clerkMiddleware: () => (req, res, next) => next(),
  getAuth: (req) => ({ userId: mockClerkSessions[req.headers.authorization] || null }),
}));

const { TEST_APP_ID, TEST_MASTER_KEY, createTestServer, stopTestServer } = require('../helpers/testServer');

jest.setTimeout(120000);

describe('Parse behind Clerk', () => {
  let app;
  let openProfileId;
  let classifiedProfileId;

  const asUser = (session) => ({
    'X-Parse-Application-Id': TEST_APP_ID,
    Authorization: `Bearer ${session}`,
  });

  const asMaster = {
    ...asUser('alice-session'),
    'X-Parse-Master-Key': TEST_MASTER_KEY,
  };

  const pointer = (className, objectId) => ({ __type: 'Pointer', className, objectId });

  const createProfile = async (session, gamerTag) => {
    const preference = await request(app).post('/parse/classes/Preference').set(asUser(session))
      .send({ type: 'PERSONAL', enemy: [], mic: [], objective: [], difficulty: [] });
    const profile = await request(app).post('/parse/classes/Profile').set(asUser(session))
      .send({ gamerTag, status: 'ACTIVE', preference: pointer('Preference', preference.body.objectId) });
    return profile;
  };

  beforeAll(async () => {
    app = await createTestServer();
    const open = await request(app).post('/parse/classes/Profile').set(asMaster).send({ gamerTag: 'OPEN' });
    const classified = await request(app).post('/parse/classes/Profile').set(asMaster).send({ gamerTag: 'CLASSIFIED' });
    openProfileId = open.body.objectId;
    classifiedProfileId = classified.body.objectId;
  });

  afterAll(async () => {
    await stopTestServer();
  });

  it('keeps /health public', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'healthy' });
  });

  it('rejects Parse requests without a Clerk session', async () => {
    const response = await request(app).get('/parse/classes/Profile')
      .set('X-Parse-Application-Id', TEST_APP_ID);
    expect(response.status).toBe(401);
  });

  it('rejects Parse requests with an unverified Clerk token', async () => {
    const response = await request(app).get('/parse/classes/Profile').set(asUser('forged-session'));
    expect(response.status).toBe(401);
  });

  it('runs cloud functions for a verified Clerk user', async () => {
    const response = await request(app).post('/parse/functions/ping').set(asUser('alice-session')).send({});
    expect(response.status).toBe(200);
    expect(response.body.result).toBe('pong');
  });

  it('blocks Parse username/password signup and login', async () => {
    const signup = await request(app).post('/parse/users').set(asUser('alice-session'))
      .send({ username: 'alice', password: 'secret123' });
    expect(signup.status).not.toBe(201);

    const login = await request(app).post('/parse/login').set(asUser('alice-session'))
      .send({ username: 'alice', password: 'secret123' });
    expect(login.status).not.toBe(200);
  });

  it('blocks clients from creating new classes', async () => {
    const response = await request(app).post('/parse/classes/Anything').set(asUser('alice-session')).send({ a: 1 });
    expect(response.status).not.toBe(201);
  });

  it('blocks clients from writing to Parse built-in classes', async () => {
    const role = await request(app).post('/parse/classes/_Role').set(asUser('alice-session'))
      .send({ name: 'admins', ACL: { '*': { read: true } } });
    expect(role.status).toBeGreaterThanOrEqual(400);

    const installation = await request(app).post('/parse/classes/_Installation').set(asUser('alice-session'))
      .send({ deviceType: 'web', installationId: 'abc-123' });
    expect(installation.status).toBeGreaterThanOrEqual(400);

    const audience = await request(app).post('/parse/classes/_Audience').set(asUser('alice-session'))
      .send({ name: 'everyone', query: '{}' });
    expect(audience.status).toBeGreaterThanOrEqual(400);

    const audiences = await request(app).get('/parse/classes/_Audience').set(asUser('alice-session'));
    expect(audiences.status).toBeGreaterThanOrEqual(400);

    const masterAudience = await request(app).post('/parse/classes/_Audience').set(asMaster)
      .send({ name: 'everyone', query: '{}' });
    expect(masterAudience.status).toBe(201);
  });

  it('stamps a new profile with the verified Clerk user id, ignoring the client value', async () => {
    const preference = await request(app).post('/parse/classes/Preference').set(asUser('alice-session'))
      .send({ type: 'PERSONAL', clerkUserId: 'user_bob' });
    const profile = await request(app).post('/parse/classes/Profile').set(asUser('alice-session'))
      .send({ gamerTag: 'Alice', status: 'ACTIVE', clerkUserId: 'user_bob', preference: pointer('Preference', preference.body.objectId) });
    expect(profile.status).toBe(201);

    const stored = await request(app).get(`/parse/classes/Profile/${profile.body.objectId}`).set(asUser('alice-session'));
    expect(stored.body.clerkUserId).toBe('user_alice');
    const storedPreference = await request(app).get(`/parse/classes/Preference/${preference.body.objectId}`).set(asUser('alice-session'));
    expect(storedPreference.body.clerkUserId).toBe('user_alice');
  });

  it('ignores a client supplied x-clerk-user-id header', async () => {
    const response = await request(app).post('/parse/classes/Preference')
      .set({ ...asUser('bob-session'), 'x-clerk-user-id': 'user_alice' })
      .send({ type: 'PERSONAL' });
    const stored = await request(app).get(`/parse/classes/Preference/${response.body.objectId}`).set(asUser('bob-session'));
    expect(stored.body.clerkUserId).toBe('user_bob');
  });

  it('allows one profile per Clerk user and reserves placeholder gamer tags', async () => {
    const second = await createProfile('alice-session', 'AliceAgain');
    expect(second.status).toBe(400);

    const placeholder = await createProfile('bob-session', 'open');
    expect(placeholder.status).toBe(400);
  });

  it('only lets the owner change or delete a profile', async () => {
    const bob = await createProfile('bob-session', 'Bob');
    expect(bob.status).toBe(201);

    const hijack = await request(app).put(`/parse/classes/Profile/${bob.body.objectId}`).set(asUser('alice-session'))
      .send({ gamerTag: 'Hijacked' });
    expect(hijack.status).toBe(400);

    const rename = await request(app).put(`/parse/classes/Profile/${bob.body.objectId}`).set(asUser('bob-session'))
      .send({ gamerTag: 'Bobby' });
    expect(rename.status).toBe(200);

    const removal = await request(app).delete(`/parse/classes/Profile/${bob.body.objectId}`).set(asUser('alice-session'));
    expect(removal.status).toBe(400);

    const placeholderEdit = await request(app).put(`/parse/classes/Profile/${openProfileId}`).set(asUser('alice-session'))
      .send({ gamerTag: 'Mine' });
    expect(placeholderEdit.status).toBe(400);
  });

  it('rejects pointing a profile at another user\'s preference', async () => {
    const preferences = await request(app).get('/parse/classes/Preference').set(asUser('alice-session'));
    const alicePreferenceId = preferences.body.results.find((preference) => preference.clerkUserId === 'user_alice').objectId;
    const profiles = await request(app).get('/parse/classes/Profile').set(asUser('bob-session'));
    const bobProfileId = profiles.body.results.find((profile) => profile.clerkUserId === 'user_bob').objectId;

    const create = await request(app).post('/parse/classes/Profile').set(asUser('carol-session'))
      .send({ gamerTag: 'Carol', status: 'ACTIVE', preference: pointer('Preference', alicePreferenceId) });
    expect(create.status).toBe(400);

    const update = await request(app).put(`/parse/classes/Profile/${bobProfileId}`).set(asUser('bob-session'))
      .send({ preference: pointer('Preference', alicePreferenceId) });
    expect(update.status).toBe(400);
  });

  describe('squads', () => {
    let aliceProfileId;
    let bobProfileId;
    let squadId;

    beforeAll(async () => {
      const profiles = await request(app).get('/parse/classes/Profile').set(asUser('alice-session'));
      aliceProfileId = profiles.body.results.find((profile) => profile.clerkUserId === 'user_alice').objectId;
      bobProfileId = profiles.body.results.find((profile) => profile.clerkUserId === 'user_bob').objectId;
    });

    it('only lets a user host a squad as themselves', async () => {
      const preferences = await request(app).get('/parse/classes/Preference').set(asUser('alice-session'));
      const alicePreferenceId = preferences.body.results.find((preference) => preference.clerkUserId === 'user_alice').objectId;
      const borrowedPreference = await request(app).post('/parse/classes/Squad').set(asUser('bob-session'))
        .send({ code: 'BORROW', host: pointer('Profile', bobProfileId), preference: pointer('Preference', alicePreferenceId) });
      expect(borrowedPreference.status).toBe(400);

      const spoofed = await request(app).post('/parse/classes/Squad').set(asUser('bob-session'))
        .send({ code: 'SPOOF', host: pointer('Profile', aliceProfileId) });
      expect(spoofed.status).toBe(400);

      const squad = await request(app).post('/parse/classes/Squad').set(asUser('alice-session'))
        .send({
          code: 'ABC123',
          host: pointer('Profile', aliceProfileId),
          guestOne: pointer('Profile', openProfileId),
          guestTwo: pointer('Profile', classifiedProfileId),
          guestThree: pointer('Profile', openProfileId),
        });
      expect(squad.status).toBe(201);
      squadId = squad.body.objectId;
    });

    it('lets another user join an open slot and leave it again, nothing more', async () => {
      const grabAll = await request(app).put(`/parse/classes/Squad/${squadId}`).set(asUser('bob-session'))
        .send({ guestOne: pointer('Profile', bobProfileId), guestThree: pointer('Profile', bobProfileId) });
      expect(grabAll.status).toBe(400);

      const join = await request(app).put(`/parse/classes/Squad/${squadId}`).set(asUser('bob-session'))
        .send({ guestOne: pointer('Profile', bobProfileId) });
      expect(join.status).toBe(200);

      const takeClassified = await request(app).put(`/parse/classes/Squad/${squadId}`).set(asUser('bob-session'))
        .send({ guestTwo: pointer('Profile', bobProfileId) });
      expect(takeClassified.status).toBe(400);

      const takeSecondSlot = await request(app).put(`/parse/classes/Squad/${squadId}`).set(asUser('bob-session'))
        .send({ guestThree: pointer('Profile', bobProfileId) });
      expect(takeSecondSlot.status).toBe(400);

      const changeCode = await request(app).put(`/parse/classes/Squad/${squadId}`).set(asUser('bob-session'))
        .send({ code: 'HACKED' });
      expect(changeCode.status).toBe(400);

      const leave = await request(app).put(`/parse/classes/Squad/${squadId}`).set(asUser('bob-session'))
        .send({ guestOne: pointer('Profile', openProfileId) });
      expect(leave.status).toBe(200);
    });

    it('lets only the host change or disband the squad', async () => {
      const kick = await request(app).put(`/parse/classes/Squad/${squadId}`).set(asUser('alice-session'))
        .send({ guestTwo: pointer('Profile', openProfileId) });
      expect(kick.status).toBe(200);

      const disbandByGuest = await request(app).delete(`/parse/classes/Squad/${squadId}`).set(asUser('bob-session'));
      expect(disbandByGuest.status).toBe(400);

      const disband = await request(app).delete(`/parse/classes/Squad/${squadId}`).set(asUser('alice-session'));
      expect(disband.status).toBe(200);
    });
  });
});
