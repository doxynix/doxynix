import jwt from "jsonwebtoken";

const ACCESS_EXPIRES = "10m";
const REFRESH_EXPIRES = "30d";

export const generateTokens = (userId: string) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET!, {
    expiresIn: ACCESS_EXPIRES,
    subject: userId,
  });

  const refreshToken = jwt.sign({ userId }, process.env.JWT_SECRET!, {
    expiresIn: REFRESH_EXPIRES,
    subject: userId,
  });

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string) => jwt.verify(token, process.env.JWT_SECRET!);

export const verifyRefreshToken = (token: string) => jwt.verify(token, process.env.JWT_SECRET!);
