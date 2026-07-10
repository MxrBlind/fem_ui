export interface CreateStudentProfile {
  name: string;
  parentLastName: string;
  motherLastName: string;
  birthDate: string;
  address: string;
  church: string;
  email: string;
  phone: string;
}

export interface CreateStudentRequest {
  username: string;
  password: string;
  profile: CreateStudentProfile;
  role: { id: number };
}
