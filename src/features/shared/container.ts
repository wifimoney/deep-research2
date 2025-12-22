/**
 * Service Container for Dependency Injection
 * 
 * Centralizes all service instances and provides them to use-cases
 */

import * as UserService from '../../../../my-app/src/services/userService.js';
import * as MemoryService from '../../../../my-app/src/services/memoryService.js';
import * as GoogleService from '../../../../my-app/src/services/googleService.js';
import * as WorkingMemoryService from '../../../../my-app/src/services/workingMemoryService.js';
import * as StorageModule from '../../../../my-app/src/mastra/config/storage.js';
import * as ChatAgentModule from '../../../../my-app/src/agents/chatAgent.js';
import * as DashboardAgentModule from '../../../../my-app/src/mastra/agents/dashboardAgent.js';
import * as MemoryModule from '../../../../my-app/src/mastra/config/memory.js';
import * as ConfigModule from '../../../../my-app/src/mastra/config/config.js';
import { AuthenticateUserUseCase } from '../auth/use-cases/authenticate-user.use-case.js';
import { RegisterUserUseCase } from '../auth/use-cases/register-user.use-case.js';
import { LogoutUserUseCase } from '../auth/use-cases/logout-user.use-case.js';
import { SendMessageUseCase } from '../chat/use-cases/send-message.use-case.js';
import { SendDashboardMessageUseCase } from '../chat/use-cases/send-dashboard-message.use-case.js';
import { GetHistoryUseCase } from '../chat/use-cases/get-history.use-case.js';
import { ListThreadsUseCase } from '../threads/use-cases/list-threads.use-case.js';
import { CreateThreadUseCase } from '../threads/use-cases/create-thread.use-case.js';
import { UpdateThreadTitleUseCase } from '../threads/use-cases/update-thread-title.use-case.js';
import { DeleteThreadUseCase } from '../threads/use-cases/delete-thread.use-case.js';
import { ListUnreadEmailsUseCase } from '../gmail/use-cases/list-unread-emails.use-case.js';
import { SearchEmailsBySenderUseCase } from '../gmail/use-cases/search-emails-by-sender.use-case.js';

export class ServiceContainer {
  // Services
  readonly userService = UserService;
  readonly memoryService = MemoryService;
  readonly googleService = GoogleService.googleService;
  readonly workingMemoryService = WorkingMemoryService;
  readonly storage = StorageModule.storage;
  readonly ensureStorageInitialized = StorageModule.ensureStorageInitialized;
  readonly chatAgent = ChatAgentModule.chatAgent;
  readonly dashboardAgent = DashboardAgentModule.dashboardAgent;
  readonly memory = MemoryModule.standardMemory;
  readonly apiKeysConfig = ConfigModule.apiKeysConfig;

  // Use-cases
  readonly authenticateUserUseCase: AuthenticateUserUseCase;
  readonly registerUserUseCase: RegisterUserUseCase;
  readonly logoutUserUseCase: LogoutUserUseCase;
  readonly sendMessageUseCase: SendMessageUseCase;
  readonly sendDashboardMessageUseCase: SendDashboardMessageUseCase;
  readonly getHistoryUseCase: GetHistoryUseCase;
  readonly listThreadsUseCase: ListThreadsUseCase;
  readonly createThreadUseCase: CreateThreadUseCase;
  readonly updateThreadTitleUseCase: UpdateThreadTitleUseCase;
  readonly deleteThreadUseCase: DeleteThreadUseCase;
  readonly listUnreadEmailsUseCase: ListUnreadEmailsUseCase;
  readonly searchEmailsBySenderUseCase: SearchEmailsBySenderUseCase;

  constructor() {
    // Initialize use-cases with dependencies
    this.authenticateUserUseCase = new AuthenticateUserUseCase(this.userService);
    this.registerUserUseCase = new RegisterUserUseCase(this.userService);
    this.logoutUserUseCase = new LogoutUserUseCase(this.userService);
    
    this.sendMessageUseCase = new SendMessageUseCase(
      this.storage,
      this.ensureStorageInitialized,
      this.chatAgent,
      this.workingMemoryService,
      this.apiKeysConfig,
      this.memoryService
    );
    
    this.sendDashboardMessageUseCase = new SendDashboardMessageUseCase(
      this.storage,
      this.ensureStorageInitialized,
      this.dashboardAgent,
      this.apiKeysConfig,
      this.memoryService
    );
    
    this.getHistoryUseCase = new GetHistoryUseCase(
      this.storage,
      this.ensureStorageInitialized,
      this.memory
    );
    
    this.listThreadsUseCase = new ListThreadsUseCase(
      this.storage,
      this.ensureStorageInitialized
    );
    
    this.createThreadUseCase = new CreateThreadUseCase(
      this.storage,
      this.ensureStorageInitialized
    );
    
    this.updateThreadTitleUseCase = new UpdateThreadTitleUseCase(
      this.storage,
      this.ensureStorageInitialized
    );
    
    this.deleteThreadUseCase = new DeleteThreadUseCase(
      this.storage,
      this.ensureStorageInitialized,
      this.workingMemoryService
    );
    
    this.listUnreadEmailsUseCase = new ListUnreadEmailsUseCase(this.googleService);
    this.searchEmailsBySenderUseCase = new SearchEmailsBySenderUseCase(this.googleService);
  }
}

// Singleton instance
let containerInstance: ServiceContainer | null = null;

export function getContainer(): ServiceContainer {
  if (!containerInstance) {
    containerInstance = new ServiceContainer();
  }
  return containerInstance;
}

