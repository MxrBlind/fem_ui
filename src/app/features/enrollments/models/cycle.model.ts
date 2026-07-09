import { UserDto } from '@core/models/auth.model';

export interface CycleDto {
  id?: number;
  description: string;
  startDate: string;
  endDate: string;
  principal?: UserDto;
  current?: boolean;
  active?: boolean;
}

export interface CreateCycleRequest {
  description: string;
  startDate: string;
  endDate: string;
  principal: { id: number };
}

export interface UpdateCycleRequest {
  description: string;
  startDate: string;
  endDate: string;
  principal: { id: number };
  current: boolean;
}
