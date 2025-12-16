
import { Hono } from "hono";
import { handleRequest, createUser, getSession } from "./auth";

const app = new Hono();

// Auth Middleware
app.use("/auth/*", async (c, next) => {
  const response = await handleRequest(c.req.raw);
  if (response.status !== 200) {
    return response; // Return BetterAuth's response for login/logout/etc.
  }
  await next();
});

// Auth Routes
app.post("/auth/register", async (c) => {
  const { email, password } = await c.req.json();
  try {
    const user = await createUser(email, password);
    return c.json({ message: "User registered successfully", user: { id: user.id, email: user.email } }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post("/auth/login", async (c) => {
  // BetterAuth's handleRequest will take care of login
  return c.json({ message: "Login successful" });
});

app.post("/auth/logout", async (c) => {
  // BetterAuth's handleRequest will take care of logout
  return c.json({ message: "Logout successful" });
});

// Protected Route Example
app.get("/protected", async (c) => {
  const session = await getSession(c.req.raw);
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return c.json({ message: "You are authorized!", userId: session.userId });
});

app.get("/", (c) => c.text("Hello Hono!"));

export default app;
