import type { UseCase } from '../../shared/types/use-case.types.js';
import type * as UserServiceModule from '../../../../my-app/src/services/userService.js';
import { verifyPassword } from '../../../../my-app/src/utils/auth.js';

type UserService = {
  findUserByEmail: typeof UserServiceModule.findUserByEmail;
  createSession: typeof UserServiceModule.createSession;
};

export interface AuthenticateUserInput {
  email: string;
  password: string;
}

export interface AuthenticateUserOutput {
  user: {
    id: string;
    username: string;
    email: string;
  };
  sessionId: string;
}

export class AuthenticateUserUseCase implements UseCase<AuthenticateUserInput, AuthenticateUserOutput> {
  constructor(
    private readonly userService: UserService
  ) {}

  async execute(input: AuthenticateUserInput): Promise<AuthenticateUserOutput> {
    // Validate input
    if (!input.email || !input.password) {
      throw new Error('Email and password are required');
    }

    // Find user by email
    const user = await this.userService.findUserByEmail(input.email);

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await verifyPassword(input.password, user.password_hash);

    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

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

