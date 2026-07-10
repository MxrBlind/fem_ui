export interface UpdateTeacherProfile {
  name: string;
  parentLastName: string;
  motherLastName: string;
  birthDate: string;
  address: string;
  church: string;
  email: string;
  phone: string;
}

export interface UpdateTeacherRequest {
  username: string;
  password?: string;
  profile: UpdateTeacherProfile;
}
