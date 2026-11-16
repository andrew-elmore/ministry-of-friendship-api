const { clerkMiddleware, getAuth } = require('@clerk/express');

const CLERK_USER_HEADER = 'x-clerk-user-id';

/**
 * Rejects any Parse request that lacks a Clerk session verified by clerkMiddleware, then hands the verified
 * Clerk user id to cloud code through a request header that only the server can set.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const requireClerkUser = (req, res, next) => {
  delete req.headers[CLERK_USER_HEADER];
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ code: 209, error: 'A valid Clerk session is required.' });
    return;
  }
  req.headers[CLERK_USER_HEADER] = userId;
  next();
};

module.exports = {
  CLERK_USER_HEADER,
  clerkMiddleware,
  requireClerkUser,
};
