export interface CreateTeacherProfile {
  name: string;
  parentLastName: string;
  motherLastName: string;
  birthDate: string;
  address: string;
  church: string;
  email: string;
  phone: string;
}

export interface CreateTeacherRequest {
  username: string;
  password: string;
  profile: CreateTeacherProfile;
  role: { id: number };
}
