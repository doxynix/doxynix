import jwt from "jsonwebtoken";

import { JWT_SECRET } from "@/shared/constants/env";

const ACCESS_EXPIRES = "10m";
const REFRESH_EXPIRES = "30d";

export const generateTokens = (userId: string) => {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES,
    subject: userId,
  });

  const refreshToken = jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: REFRESH_EXPIRES,
    subject: userId,
  });

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string) => jwt.verify(token, JWT_SECRET);

export const verifyRefreshToken = (token: string) => jwt.verify(token, JWT_SECRET);
