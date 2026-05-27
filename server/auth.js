import { compare, hash } from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "./database.js";
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

export async function getUserFromToken(token) {
  if (!token) return null;

  const payload = verifyToken(token);
  const userId = payload?.sub || payload?.userId;
  if (!userId) return null;

  const user = await findUserById(userId);
  return toPublicUser(user);
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
  const user = await getUserFromToken(getAuthToken(req));
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

  if (req.method === "PATCH" && parts[1] === "password") {
    const user = await requireUser(req, res);
    if (!user) return true;

    const body = await readBody(req);
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");

    if (!currentPassword || !newPassword) {
      sendJson(res, 400, { message: "Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới" });
      return true;
    }

    if (newPassword.length < 6) {
      sendJson(res, 400, { message: "Mật khẩu mới phải có tối thiểu 6 ký tự" });
      return true;
    }

    try {
      const result = await pool.query(
        "SELECT password_hash FROM users WHERE id = $1",
        [user.id],
      );
      const row = result.rows[0];

      if (!row) {
        sendJson(res, 401, { message: "Authentication required" });
        return true;
      }

      const matches = await compare(currentPassword, row.password_hash);
      if (!matches) {
        sendJson(res, 400, { message: "Mật khẩu hiện tại không đúng" });
        return true;
      }

      const newHash = await hash(newPassword, 10);
      await pool.query(
        "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
        [newHash, user.id],
      );

      sendJson(res, 200, { message: "Cập nhật mật khẩu thành công" });
    } catch (error) {
      console.error("[Auth] Change password failed:", error.message);
      sendJson(res, 500, { message: "Đã có lỗi xảy ra, vui lòng thử lại" });
    }

    return true;
  }

  return false;
}
