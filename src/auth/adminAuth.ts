import type { FastifyRequest } from "fastify";

const tokenFromRequest = (request: FastifyRequest): string => {
  const raw = request.headers.authorization || request.headers["x-api-key"] || "";
  const header = (Array.isArray(raw) ? raw[0] : raw) || "";
  return header.startsWith("Bearer ") ? header.slice(7) : header;
};

export const isAdminRequest = (
  request: FastifyRequest,
  adminPassword: string,
): boolean => {
  return tokenFromRequest(request) === adminPassword;
};

export const adminAuthMode = (
  request: FastifyRequest,
  adminPassword: string,
): "password" | null => {
  return tokenFromRequest(request) === adminPassword ? "password" : null;
};
