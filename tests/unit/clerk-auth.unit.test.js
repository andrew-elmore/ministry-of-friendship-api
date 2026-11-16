const mockAuth = { userId: null };

jest.mock('@clerk/express', () => ({
  clerkMiddleware: jest.fn(),
  getAuth: () => mockAuth,
}));

const { CLERK_USER_HEADER, requireClerkUser } = require('../../auth/clerkAuth');

describe('requireClerkUser', () => {
  const respond = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
  };

  it('rejects a request without a verified Clerk user', () => {
    mockAuth.userId = null;
    const req = { headers: { [CLERK_USER_HEADER]: 'user_spoofed' } };
    const res = respond();
    const next = jest.fn();

    requireClerkUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(req.headers[CLERK_USER_HEADER]).toBeUndefined();
  });

  it('replaces any client supplied user header with the verified Clerk user id', () => {
    mockAuth.userId = 'user_verified';
    const req = { headers: { [CLERK_USER_HEADER]: 'user_spoofed' } };
    const next = jest.fn();

    requireClerkUser(req, respond(), next);

    expect(next).toHaveBeenCalled();
    expect(req.headers[CLERK_USER_HEADER]).toBe('user_verified');
  });
});
