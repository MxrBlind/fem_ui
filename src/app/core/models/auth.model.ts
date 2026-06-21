export interface LoginRequest {
  username: string;
  password: string;
}

export interface JwtResponse {
  token: string;
  type: 'Bearer';
  expirationDate: string;
}