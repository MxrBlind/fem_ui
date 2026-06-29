export interface LoginRequest {
  username: string;
  password: string;
}

export interface JwtResponse {
  token: string;
  type: 'Bearer';
  expirationDate: string;
}

export interface RoleDto {
  id?: number;
  name?: string;
  description?: string;
}

export interface UserDto {
  id: number;
  username: string;
  active?: boolean;
  status?: string;
  role?: RoleDto | null;
}