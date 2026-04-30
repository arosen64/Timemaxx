import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../backend/convex/_generated/api";
import { Id } from "../../../backend/convex/_generated/dataModel";
import { Course } from "../types";
import DifficultyRating from "./DifficultyRating";
import Button from "./ui/Button";
import Selector from "./ui/Selector";
import { GRADES, STUDY_GOALS, REMOVE_CLASS_TASKS_WARNING } from "../constants";

const PAGE_SIZE = 4;

interface CoursesListProps {
  courses: Course[];
  onCoursesChange: (courses: Course[]) => void;
}

export default function CoursesList({ courses, onCoursesChange }: CoursesListProps) {
  const deleteUserCourse = useMutation(api.mutations.userCourses.deleteUserCourse);
  const updateUserCourse = useMutation(api.mutations.userCourses.updateUserCourse);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const handleRemove = async (index: number) => {
    const course = courses[index];
    if (course.userCourseId) {
      const ok = window.confirm(
        `${REMOVE_CLASS_TASKS_WARNING}\n\nRemove "${course.title}" from your courses?`
      );
      if (!ok) return;
      await deleteUserCourse({ userCourseId: course.userCourseId as Id<"userCourses"> });
    }
    const next = courses.filter((_, j) => j !== index);
    onCoursesChange(next);
    const maxPage = Math.max(0, Math.ceil(next.length / PAGE_SIZE) - 1);
    setPage((p) => Math.min(p, maxPage));
  };

  const handleUpdate = (index: number, patch: Partial<Course>) => {
    const updated = courses.map((c, j) => (j === index ? { ...c, ...patch } : c));
    onCoursesChange(updated);
    const course = courses[index];
    if (course.userCourseId) {
      updateUserCourse({
        userCourseId: course.userCourseId as Id<"userCourses">,
        grade: patch.grade ?? course.grade,
        studyGoal: patch.studyGoal ?? course.studyGoal,
        difficultyRating: patch.difficultyRating ?? course.difficultyRating,
      });
    }
  };

  const filtered = courses.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-border" />
        <span className="font-body text-xs font-medium text-slate-blue">
          Added courses ({courses.length})
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0);
        }}
        placeholder="Search added courses..."
        className="rounded-lg border border-border bg-bg-gray px-3 py-2 font-body text-sm text-navy outline-none placeholder:text-light-blue focus:border-sky-blue focus:ring-2 focus:ring-sky-blue/20"
      />

      {paged.map((course) => {
        const realIndex = courses.indexOf(course);
        return (
          <div
            key={realIndex}
            className="flex flex-col gap-2 rounded-lg border border-border bg-bg-gray p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-body text-sm font-semibold text-navy">{course.title}</span>
                {course.term && (
                  <span className="inline-block w-fit rounded-full bg-navy/10 px-2 py-0.5 font-body text-xs font-medium text-navy">
                    {course.term}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemove(realIndex)}
                className="text-light-blue transition-colors hover:text-urgent-red"
              >
                ×
              </button>
            </div>

            {course.grade !== undefined ? (
              <div className="flex items-center gap-2">
                <span className="font-body text-xs text-slate-blue">Grade:</span>
                <Selector
                  value={course.grade}
                  onChange={(val) => handleUpdate(realIndex, { grade: val })}
                  placeholder="Select grade"
                  options={GRADES.map((g) => ({ label: g, value: g }))}
                  className="text-xs py-1 h-auto"
                />
              </div>
            ) : (
              <div className="flex gap-2">
                {STUDY_GOALS.map((goal) => (
                  <label
                    key={goal}
                    className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-2 py-2 font-body text-xs font-medium transition-colors ${
                      course.studyGoal === goal
                        ? "border-sky-blue bg-sky-blue/10 text-navy"
                        : "border-border text-slate-blue hover:border-sky-blue/50 hover:bg-sky-blue/5"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`studyGoal-${realIndex}`}
                      value={goal}
                      checked={course.studyGoal === goal}
                      onChange={() => handleUpdate(realIndex, { studyGoal: goal })}
                      className="sr-only"
                    />
                    {goal}
                  </label>
                ))}
              </div>
            )}

            {course.grade !== undefined && (
              <DifficultyRating
                value={course.difficultyRating ?? 3}
                onChange={(n) => handleUpdate(realIndex, { difficultyRating: n })}
              />
            )}
          </div>
        );
      })}

      {filtered.length === 0 && search && (
        <p className="text-center font-body text-sm text-light-blue">No courses match "{search}"</p>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="primary"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0}
            className="px-4 h-8 text-xs"
          >
            ← Prev
          </Button>
          <span className="font-body text-xs text-light-blue">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="primary"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1}
            className="px-4 h-8 text-xs"
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
