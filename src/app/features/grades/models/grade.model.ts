export interface GradeDto {
  enrollmentId: number;
  studentName: string;
  teacherName: string;
  studentId: number;
  courseName: string;
  courseId: number;
  subjectCode: string;
  cycleName: string;
  cycleId: number;
  active: boolean;
  grade: number;
  startDate: string;
}

export interface GradeRow {
  enrollmentId: number;
  studentId: number;
  courseName: string;
  teacherName: string;
  cycleName: string;
  startDate: string;
  grade: number;
  active: boolean;
  raw: GradeDto;
}
