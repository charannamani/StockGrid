const request = require("supertest");
const app = require("../app");
const { connect, closeDatabase, clearDatabase } = require("./testSetup");

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe("Auth", () => {
  const validUser = {
    name: "Test User",
    email: "test@stockgrid.com",
    password: "password123",
  };

  test("registers a new user with role hardcoded to staff", async () => {
    const res = await request(app).post("/api/auth/register").send(validUser);

    expect(res.statusCode).toBe(201);
    expect(res.body.email).toBe(validUser.email);
    expect(res.body.role).toBe("staff");
    expect(res.body.token).toBeDefined();
    expect(res.body.password).toBeUndefined();
  });

  test("rejects registration attempting to self-assign admin role", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validUser, role: "admin" });

    expect(res.statusCode).toBe(201);
    expect(res.body.role).toBe("staff");
  });

  test("rejects duplicate email registration", async () => {
    await request(app).post("/api/auth/register").send(validUser);
    const res = await request(app).post("/api/auth/register").send(validUser);

    expect(res.statusCode).toBe(400);
  });

  test("rejects registration with a short password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validUser, password: "123" });

    expect(res.statusCode).toBe(400);
  });

  test("logs in with correct credentials", async () => {
    await request(app).post("/api/auth/register").send(validUser);

    const res = await request(app).post("/api/auth/login").send({
      email: validUser.email,
      password: validUser.password,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test("rejects login with wrong password using a generic message", async () => {
    await request(app).post("/api/auth/register").send(validUser);

    const res = await request(app).post("/api/auth/login").send({
      email: validUser.email,
      password: "wrongpassword",
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  test("rejects login for a non-existent email with the same generic message", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "doesnotexist@stockgrid.com",
      password: "password123",
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });
});