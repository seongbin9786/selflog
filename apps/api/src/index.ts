import bcrypt from "bcryptjs";
const { compare, genSalt, hash } = bcrypt;
import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { cors } from "hono/cors";
import { jwt } from "hono/jwt";
import { logger } from "hono/logger";
import { sign } from "jsonwebtoken";

import { getAllLogs, getLog, getLogBackups, saveLog } from "./logs";
import { createUser, findUser } from "./users";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:4000"],
    credentials: true,
  }),
);

const JWT_SECRET = process.env.JWT_SECRET || "secretKey";

// Protected Routes Middleware
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

    const salt = await genSalt(10);
    const passwordHash = await hash(password, salt);

    await createUser(username, passwordHash);

    const token = sign({ username, sub: username }, JWT_SECRET, {
      expiresIn: "1h",
    });

    return c.json({ access_token: token });
  } catch (error) {
    console.error("Signup error:", error);
    return c.json({ message: "Internal Server Error" }, 500);
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

    const isValid = await compare(password, user.passwordHash);
    if (!isValid) {
      return c.json({ message: "Invalid credentials" }, 401);
    }

    const token = sign({ username, sub: username }, JWT_SECRET, {
      expiresIn: "1h",
    });

    return c.json({ access_token: token });
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ message: "Internal Server Error" }, 500);
  }
});

// Log Routes
app.get("/raw-logs", async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const userId = payload.username || payload.sub;
    const logs = await getAllLogs(userId);
    return c.json({ data: logs });
  } catch (error) {
    console.error("Get all logs error:", error);
    return c.json({ message: "Internal Server Error" }, 500);
  }
});

app.post("/raw-logs", async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const userId = payload.username || payload.sub; // Hono JWT puts payload in 'jwtPayload' context
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
      parentHash ?? null,
    );
    return c.json({ success: true, data: savedLog });
  } catch (error) {
    console.error("Save log error:", error);
    return c.json({ message: "Internal Server Error" }, 500);
  }
});

app.post("/raw-logs/bulk", async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const userId = payload.username || payload.sub;
    const { logs } = await c.req.json();

    if (!Array.isArray(logs)) {
      return c.json({ message: "Logs must be an array" }, 400);
    }

    const { bulkSaveLogs } = await import("./logs");
    const savedLogs = await bulkSaveLogs(userId, logs);

    return c.json({ success: true, data: savedLogs });
  } catch (error) {
    console.error("Bulk save logs error:", error);
    return c.json({ message: "Internal Server Error" }, 500);
  }
});

app.get("/raw-logs/:date", async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const userId = payload.username || payload.sub;
    const date = c.req.param("date");

    const log = await getLog(userId, date);
    return c.json(log || { date, content: "" });
  } catch (error) {
    console.error("Get log error:", error);
    return c.json({ message: "Internal Server Error" }, 500);
  }
});

app.get("/raw-logs/:date/backups", async (c) => {
  try {
    const payload = c.get("jwtPayload");
    const userId = payload.username || payload.sub;
    const date = c.req.param("date");

    const backups = await getLogBackups(userId, date);
    return c.json({ data: backups });
  } catch (error) {
    console.error("Get log backups error:", error);
    return c.json({ message: "Internal Server Error" }, 500);
  }
});

// Export for Lambda
export const handler = handle(app);

// Export for local dev (if needed, though dev script uses tsx watch src/index.ts which needs explicit serve)
// For local development with `tsx`, we need to serve it manually using @hono/node-server
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { serve } = require("@hono/node-server");
  const port = Number(process.env.PORT) || 3000;
  console.log(`Server is running on port ${port}`);
  serve({
    fetch: app.fetch,
    port,
  });
}
