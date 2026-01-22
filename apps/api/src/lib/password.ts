import bcrypt from "bcryptjs";

export const hashPassword = async (value: string) => bcrypt.hash(value, 12);

export const verifyPassword = async (value: string, hash: string) =>
  bcrypt.compare(value, hash);
