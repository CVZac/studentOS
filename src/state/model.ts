import { useMemo } from 'react';
import { generateTodos } from '../core/recommendations';
import { classSubjectStats, sortExams, studentSubjectStats, totalRank } from '../core/scoreStats';
import { useStudentOS } from './store';

/** 当前学生的全部派生数据：评价结果、成绩区间、排名与提升待办 */
export function useStudentModel() {
  const { dataset, classEval, studentId, framework } = useStudentOS();

  return useMemo(() => {
    const student = dataset.students.find((s) => s.id === studentId)!;
    const evaluation = classEval.results.get(student.id)!;
    const subjectStats = studentSubjectStats(dataset, student.id);
    const classStats = classSubjectStats(dataset);
    const exams = sortExams(dataset.exams);
    const taken = new Set(dataset.scores.filter((r) => r.studentId === student.id).map((r) => r.examId));
    const latestExam = [...exams].reverse().find((e) => taken.has(e.id)) ?? null;

    return {
      student,
      evaluation,
      subjectStats,
      classStats,
      exams,
      latestExam,
      latestTotal: latestExam ? totalRank(dataset, latestExam.id, student.id) : null,
      rank: classEval.rankOf(student.id),
      todos: generateTodos({ evaluation, subjectStats, classStats, levels: framework.levels }),
    };
  }, [dataset, classEval, studentId, framework]);
}

export type StudentModel = ReturnType<typeof useStudentModel>;
