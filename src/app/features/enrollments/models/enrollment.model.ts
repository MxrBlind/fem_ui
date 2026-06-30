import { UserDto } from '../../../core/models/auth.model';
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

export interface EnrollmentRow {
  id: number;
  fullName: string;
  church: string;
  subject: string;
  category: string;
  grade: number;
  raw: EnrollmentDto;
}
