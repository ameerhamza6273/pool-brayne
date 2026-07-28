import type { FastifyRequest, FastifyReply } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";

const jwks = createRemoteJWKSet(new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Missing bearer token" });
    return;
  }

  try {
    const token = header.slice("Bearer ".length);
    const { payload } = await jwtVerify(token, jwks);
    if (typeof payload.sub !== "string") {
      reply.code(401).send({ error: "Invalid token" });
      return;
    }
    req.userId = payload.sub;
  } catch {
    reply.code(401).send({ error: "Invalid or expired token" });
  }
}
