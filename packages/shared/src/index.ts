export type AgeGroup = 'child_6_8' | 'child_9_12' | 'teen' | 'adult';

export type GameMode =
  'child_learning' | 'teen_challenge' | 'adult_casual' | 'parent_management';

export interface TankStats {
  firepower: number;
  mobility: number;
  armor: number;
  stealth: number;
  vision: number;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  requestId: string;
}
