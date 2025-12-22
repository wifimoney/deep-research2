import type { UseCase } from '../../shared/types/use-case.types.js';
import type * as UserServiceModule from '../../../../my-app/src/services/userService.js';

type UserService = {
  findUserByEmail: typeof UserServiceModule.findUserByEmail;
  findUserByUsername: typeof UserServiceModule.findUserByUsername;
  createUser: typeof UserServiceModule.createUser;
  createSession: typeof UserServiceModule.createSession;
};

export interface RegisterUserInput {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface RegisterUserOutput {
  user: {
    id: string;
    username: string;
    email: string;
  };
  sessionId: string;
}

export class RegisterUserUseCase implements UseCase<RegisterUserInput, RegisterUserOutput> {
  constructor(
    private readonly userService: UserService
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserOutput> {
    // Validate input
    if (!input.username || !input.email || !input.password || !input.confirmPassword) {
      throw new Error('All fields are required');
    }

    // Validate username length
    if (input.username.length < 3 || input.username.length > 50) {
      throw new Error('Username must be between 3 and 50 characters');
    }

    // Validate password length
    if (input.password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Check password confirmation
    if (input.password !== input.confirmPassword) {
      throw new Error('Passwords do not match');
    }

    // Check if email already exists
    const existingEmail = await this.userService.findUserByEmail(input.email);
    if (existingEmail) {
      throw new Error('Email is already registered');
    }

    // Check if username already exists
    const existingUsername = await this.userService.findUserByUsername(input.username);
    if (existingUsername) {
      throw new Error('Username is already taken');
    }

    // Create user
    const user = await this.userService.createUser(input.username, input.email, input.password);

    // Create session
    const sessionId = await this.userService.createSession(user.id);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      sessionId,
    };
  }
}

