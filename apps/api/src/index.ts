import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";

import { serve } from "@hono/node-server";
import { type Context, Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { cors } from "hono/cors";
import { jwt } from "hono/jwt";
import { logger } from "hono/logger";
import { SignJWT } from "jose";

import {
  bulkSaveLogs,
  getAllLogs,
  getLog,
  getLogBackups,
  saveLog,
} from "./logs";
import { createUser, findUser } from "./users";

const app = new Hono();
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ??
  [
    "http://localhost:3000",
    "https://localhost:3000",
    "http://localhost:5173",
    "https://localhost:5173",
    "http://localhost:5174",
    "https://localhost:5174",
    "http://localhost:6006",
    "https://localhost:6006",
    "http://localhost:4000",
    "https://localhost:4000",
  ].join(",")
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return undefined;
      return allowedOrigins.includes(origin) ? origin : undefined;
    },
    credentials: false,
  })
);

const JWT_SECRET = process.env.JWT_SECRET?.trim();
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET must be set and fixed across deployments");
}
const jwtSigningKey = new TextEncoder().encode(JWT_SECRET);

const createAccessToken = async (username: string) => {
  return new SignJWT({ username, sub: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(jwtSigningKey);
};

const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const passwordHash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${passwordHash}`;
};

const verifyPassword = (password: string, storedHash: string) => {
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) return false;
  const expected = Buffer.from(expectedHash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(expected, actual);
};

type LambdaEnvLike = {
  event?: {
    requestContext?: {
      requestId?: string;
    };
  };
  requestContext?: {
    requestId?: string;
  };
  lambdaContext?: {
    awsRequestId?: string;
  };
};

const getRequestId = (c: Context): string | undefined => {
  const env = c.env as LambdaEnvLike | undefined;
  return (
    env?.requestContext?.requestId ||
    env?.event?.requestContext?.requestId ||
    env?.lambdaContext?.awsRequestId
  );
};

const getErrorCode = (error: unknown): string => {
  if (
    typeof error === "object" &&
    error &&
    "name" in error &&
    typeof error.name === "string" &&
    error.name
  ) {
    return error.name;
  }
  return "UnknownError";
};

const logRouteError = (c: Context, message: string, error: unknown) => {
  const requestId = getRequestId(c);
  if (requestId) {
    console.error(`${message} [requestId=${requestId}]`, error);
    return;
  }
  console.error(message, error);
};

const internalServerError = (c: Context, error: unknown) => {
  const requestId = getRequestId(c);
  if (requestId) {
    c.header("x-request-id", requestId);
  }

  return c.json(
    {
      message: "Internal Server Error",
      code: getErrorCode(error),
      ...(requestId ? { requestId } : {}),
    },
    500
  );
};

// Protected Routes Middleware
// Hono route pattern "/raw-logs/*" does not include "/raw-logs" itself.
app.use("/raw-logs", jwt({ secret: JWT_SECRET }));
app.use("/raw-logs/*", jwt({ secret: JWT_SECRET }));

// Routes
app.get("/", (c) => c.text("Hello from Hono!"));

app.post("/auth/signup", async (c) => {
  try {
    const { username, password } = await c.req.json();

    if (!username || !password) {
      return c.json({ message: "Username and password are required" }, 400);
    }

    const existingUser = await findUser(username);
    if (existingUser) {
      return c.json({ message: "Username already exists" }, 409);
    }

    const passwordHash = hashPassword(password);

    await createUser(username, passwordHash);

    const token = await createAccessToken(username);

    return c.json({ access_token: token });
  } catch (error) {
    logRouteError(c, "Signup error:", error);
    return internalServerError(c, error);
  }
});

app.post("/auth/login", async (c) => {
  try {
    const { username, password } = await c.req.json();

    if (!username || !password) {
      return c.json({ message: "Username and password are required" }, 400);
    }

    const user = await findUser(username);
    if (!user) {
      return c.json({ message: "Invalid credentials" }, 401);
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return c.json({ message: "Invalid credentials" }, 401);
    }

    const token = await createAccessToken(username);

    return c.json({ access_token: token });
  } catch (error) {
    logRouteError(c, "Login error:", error);
    return internalServerError(c, error);
  }
});

// Log Routes
app.get("/raw-logs", async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const userId = payload?.username || payload?.sub;
    if (!userId) {
      return c.json({ message: "Unauthorized" }, 401);
    }
    const logs = await getAllLogs(userId);
    return c.json({ data: logs });
  } catch (error) {
    logRouteError(c, "Get all logs error:", error);
    return internalServerError(c, error);
  }
});

app.post("/raw-logs", async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const userId = payload?.username || payload?.sub; // Hono JWT puts payload in 'jwtPayload' context
    if (!userId) {
      return c.json({ message: "Unauthorized" }, 401);
    }
    const { date, content, contentHash, parentHash } = await c.req.json();

    if (!date) {
      return c.json({ message: "Date is required" }, 400);
    }

    if (!contentHash) {
      return c.json({ message: "contentHash is required" }, 400);
    }

    const savedLog = await saveLog(
      userId,
      date,
      content || "",
      contentHash,
      parentHash ?? null
    );
    return c.json({ success: true, data: savedLog });
  } catch (error) {
    logRouteError(c, "Save log error:", error);
    return internalServerError(c, error);
  }
});

app.post("/raw-logs/bulk", async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const userId = payload?.username || payload?.sub;
    if (!userId) {
      return c.json({ message: "Unauthorized" }, 401);
    }
    const { logs } = await c.req.json();

    if (!logs || !Array.isArray(logs)) {
      return c.json({ message: "logs array is required" }, 400);
    }

    const savedLogs = await bulkSaveLogs(userId, logs);
    return c.json({ success: true, data: savedLogs });
  } catch (error) {
    logRouteError(c, "Bulk save logs error:", error);
    return internalServerError(c, error);
  }
});

app.get("/raw-logs/:date", async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const userId = payload?.username || payload?.sub;
    if (!userId) {
      return c.json({ message: "Unauthorized" }, 401);
    }
    const date = c.req.param("date");

    const log = await getLog(userId, date);
    return c.json(log || { date, content: "" });
  } catch (error) {
    logRouteError(c, "Get log error:", error);
    return internalServerError(c, error);
  }
});

app.get("/raw-logs/:date/backups", async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const userId = payload?.username || payload?.sub;
    if (!userId) {
      return c.json({ message: "Unauthorized" }, 401);
    }
    const date = c.req.param("date");

    const backups = await getLogBackups(userId, date);
    return c.json({ data: backups });
  } catch (error) {
    logRouteError(c, "Get log backups error:", error);
    return internalServerError(c, error);
  }
});

// Export for Lambda
export const handler = handle(app);

// For local development with `tsx`, we need to serve it manually using @hono/node-server
const isMain =
  process.argv[1] &&
  (process.argv[1] === fileURLToPath(import.meta.url) ||
    process.argv[1].endsWith("index.ts"));

if (isMain) {
  const port = Number(process.env.PORT) || 3000;
  console.log(`Server is running on port ${port}`);
  serve({
    fetch: app.fetch,
    port,
  });
}
