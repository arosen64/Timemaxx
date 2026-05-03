import { ProfileData, Course } from "../types";
import CourseSelector from "./CourseSelector";
import TranscriptUpload from "./TranscriptUpload";
import CoursesList from "./CoursesList";

interface CoursesFormProps {
  data: ProfileData;
  onChange: (data: ProfileData) => void;
}

export default function CoursesForm({ data, onChange }: CoursesFormProps) {
  const handleAddCourse = (course: Course) => {
    if (data.courses.some((c) => c.title === course.title && c.term === course.term)) return;
    onChange({ ...data, courses: [...data.courses, course] });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-2xl font-bold text-navy">Your Classes</h2>
        <p className="mt-1 font-body text-sm text-slate-blue">
          Upload your transcript to auto-fill, or search and add courses manually.
        </p>
        <p className="mt-1 font-body text-xs text-light-blue">
          Rate the difficulty of past courses (1–5) — all default to 3. This helps generate a more
          accurate academic profile.
        </p>
      </div>

      <TranscriptUpload
        onCoursesAdded={(newCourses) =>
          onChange({ ...data, courses: [...data.courses, ...newCourses] })
        }
      />

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="font-body text-xs text-light-blue">or add manually</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="flex flex-col gap-3">
        <CourseSelector onAddCourse={handleAddCourse} />

        {data.courses.length > 0 && (
          <CoursesList
            courses={data.courses}
            onCoursesChange={(courses) => onChange({ ...data, courses })}
          />
        )}
      </div>
    </div>
  );
}
