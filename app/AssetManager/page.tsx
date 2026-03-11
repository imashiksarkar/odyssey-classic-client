import { ProjectsList } from "@/components/AssetManager/ProjectsList";

export default function AssetManagerPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <ProjectsList />
      </div>
    </div>
  );
}
