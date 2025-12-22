export interface UseCase<Input, Output> {
  execute(input: Input): Promise<Output>;
}

export interface UseCaseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

