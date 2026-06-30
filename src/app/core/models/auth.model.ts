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

export interface ProfileDto {
  id?: number;
  parentLastName?: string;
  motherLastName?: string;
  name?: string;
  email?: string;
  birthDate?: string;
  address?: string;
  phone?: string;
  church?: string;
}

export interface UserDto {
  id: number;
  username: string;
  active?: boolean;
  status?: string;
  profile?: ProfileDto;
  role?: RoleDto | null;
}