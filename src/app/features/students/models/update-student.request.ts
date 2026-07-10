export interface UpdateStudentProfile {
  name: string;
  parentLastName: string;
  motherLastName: string;
  birthDate: string;
  address: string;
  church: string;
  email: string;
  phone: string;
}

// Backend role id for students; keep in sync with the server's role table.
export const STUDENT_ROLE_ID = 3;

export interface UpdateStudentRequest {
  username: string;
  password?: string;
  role: { id: typeof STUDENT_ROLE_ID };
  profile: UpdateStudentProfile;
}
