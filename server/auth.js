import { compare } from "bcryptjs";
import jwt from "jsonwebtoken";
import { readBody, sendJson } from "./httpUtils.js";
import {
  findUserById,
  findUserByUsername,
} from "./repositories/userRepository.js";

const jwtSecret = process.env.JWT_SECRET || "greenhouse_dev_secret_change_me";
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "7d";

export function getAuthToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
}

function toPublicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    name: user.name || user.username,
    role: user.role,
  };
}

function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      userId: user.id,
      username: user.username,
      role: user.role,
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn },
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, jwtSecret);
  } catch {
    return null;
  }
}

async function isPasswordValid(password, passwordHash) {
  if (!password || !passwordHash) return false;

  try {
    return await compare(password, passwordHash);
  } catch {
    return false;
  }
}

export async function requireUser(req, res) {
  const token = getAuthToken(req);

  if (!token) {
    sendJson(res, 401, { message: "Authentication required" });
    return null;
  }

  const payload = verifyToken(token);
  const userId = payload?.sub || payload?.userId;

  if (!userId) {
    sendJson(res, 401, { message: "Authentication required" });
    return null;
  }

  const user = await findUserById(userId);

  if (!user) {
    sendJson(res, 401, { message: "Authentication required" });
    return null;
  }

  req.user = toPublicUser(user);
  return req.user;
}

export async function handleAuth(req, res, parts) {
  if (req.method === "POST" && parts[1] === "login") {
    const credentials = await readBody(req);
    const username = String(credentials.username || "").trim();
    const password = String(credentials.password || "");
    const user = username ? await findUserByUsername(username) : null;
    const passwordMatches = user ? await isPasswordValid(password, user.password_hash) : false;

    if (!user || !passwordMatches) {
      sendJson(res, 401, { message: "Sai tài khoản hoặc mật khẩu" });
      return true;
    }

    sendJson(res, 200, {
      token: createToken(user),
      user: toPublicUser(user),
    });
    return true;
  }

  if (req.method === "GET" && parts[1] === "me") {
    const user = await requireUser(req, res);
    if (!user) return true;

    sendJson(res, 200, user);
    return true;
  }

  if (req.method === "POST" && parts[1] === "logout") {
    sendJson(res, 200, { success: true });
    return true;
  }

  return false;
}
