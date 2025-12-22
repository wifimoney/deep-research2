import type { UseCase } from '../../shared/types/use-case.types.js';
import type * as UserServiceModule from '../../../../my-app/src/services/userService.js';

type UserService = {
  deleteSession: typeof UserServiceModule.deleteSession;
};

export interface LogoutUserInput {
  betterAuthSession?: any;
  legacySessionId?: string;
  betterAuthInstance?: any;
  requestHeaders?: Headers;
}

export interface LogoutUserOutput {
  success: boolean;
  message: string;
}

export class LogoutUserUseCase implements UseCase<LogoutUserInput, LogoutUserOutput> {
  constructor(
    private readonly userService: UserService
  ) {}

  async execute(input: LogoutUserInput): Promise<LogoutUserOutput> {
    // Handle Better Auth session (for OAuth users like Google)
    if (input.betterAuthSession && input.betterAuthInstance) {
      try {
        await input.betterAuthInstance.api.signOut({ headers: input.requestHeaders });
        console.log('Better Auth sign-out successful');
      } catch (error) {
        console.error('Better Auth sign-out error:', error);
        // Continue with legacy logout even if Better Auth sign-out fails
      }
    }

    // Handle legacy session (for email/password users)
    if (input.legacySessionId) {
      try {
        await this.userService.deleteSession(input.legacySessionId);
      } catch (error) {
        console.error('Legacy session deletion error:', error);
      }
    }

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }
}

