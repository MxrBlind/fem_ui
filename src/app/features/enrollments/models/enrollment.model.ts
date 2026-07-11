import { UserDto } from '@core/models/auth.model';
import { CycleDto } from './cycle.model';

export interface CategoryDto {
  id?: number;
  title: string;
  description: string;
  code: string;
  active?: boolean;
}

export interface LevelDto {
  id?: number;
  title?: string;
  code?: string;
  active?: boolean;
}

export interface SubjectDto {
  id?: number;
  code: string;
  description: string;
  category: CategoryDto;
  level: LevelDto;
}

export interface CreateSubjectRequest {
  code: string;
  description: string;
  category: { id: number };
  level: { id: number };
}

export interface CourseDto {
  id?: number;
  subject: SubjectDto;
  teacher: UserDto;
  credits: number;
  cycle: CycleDto;
}

export interface EnrollmentDto {
  id?: number;
  student?: UserDto;
  course?: CourseDto;
  active?: boolean;
  scholarshipPercent?: number;
  grade?: number;
  startDate?: string;
}

export interface CreateEnrollmentRequest {
  student: { id: number };
  course: { id: number };
  scholarshipPercent: number;
  active: true;
}

export interface CreateCourseRequest {
  subject: { id: number };
  teacher: { id: number };
  cycle: { id: number };
  credits: number;
}

export interface EnrollmentRow {
  id: number;
  fullName: string;
  church: string;
  subject: string;
  category: string;
  grade: number;
  raw: EnrollmentDto;
}

export interface CourseRow {
  id: number;
  subjectDescription: string;
  credits: number;
  teacherFullName: string;
  categoryTitle: string;
  levelTitle: string;
  raw: CourseDto;
}
