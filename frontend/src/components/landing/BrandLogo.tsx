import { BookOpenIcon } from "../icons";

export default function BrandLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded bg-teal text-navy">
        <BookOpenIcon size={26} />
      </div>
      <span className="font-heading text-xl font-bold text-white">Timemaxx</span>
    </div>
  );
}
