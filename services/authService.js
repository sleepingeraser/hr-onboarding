// services/authService.js - TEMPORARY VERSION (NO FRAAPPE)
const jwt = require("jsonwebtoken");

// In-memory user storage (temporary!)
const users = [];

class AuthService {
  async register(userData) {
    // Check if user exists
    const existing = users.find(
      (u) => u.email === userData.email.toLowerCase(),
    );
    if (existing) {
      throw new Error("Email already registered");
    }

    // Create user
    const newUser = {
      userId: users.length + 1,
      name: userData.name,
      email: userData.email.toLowerCase(),
      password: userData.password, // In real app, hash this!
      role: userData.role,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);

    return {
      message: "Registered successfully",
      user: newUser,
    };
  }

  async login(email, password) {
    const user = users.find((u) => u.email === email.toLowerCase());

    if (!user || user.password !== password) {
      throw new Error("Invalid credentials");
    }

    const token = jwt.sign(
      {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    );

    return {
      token,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }
}

module.exports = new AuthService();
