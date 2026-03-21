import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/admin/PageHeader";
import DataTable, { ColumnDef } from "@/components/admin/DataTable";
import Modal from "@/components/admin/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listQuestions } from "@/lib/question-bank-api";
import type { Question } from "@/lib/question-bank-types";

type QuestionRow = {
  id: string;
  title: string;
  section: string;
  difficulty: "easy" | "medium" | "hard";
  type: "mcq" | "true-false" | "short";
};

function toRow(q: Question): QuestionRow {
  const difficulty =
    q.difficultyLabel === "Easy" ? "easy" : q.difficultyLabel === "Hard" ? "hard" : "medium";
  const type =
    q.type === "TRUE_FALSE" ? "true-false" : q.type === "SHORT" || q.type === "LONG" ? "short" : "mcq";
  return {
    id: q.id,
    title: q.title || "(Untitled)",
    section: q.sectionId || "—",
    difficulty,
    type,
  };
}

export default function QuestionsPage() {
  const [importOpen, setImportOpen] = useState(false);
  const [questionBank, setQuestionBank] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [type, setType] = useState("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listQuestions({})
      .then((list) => {
        if (!cancelled) setQuestionBank(list.map(toRow));
      })
      .catch(() => {
        if (!cancelled) setQuestionBank([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    return questionBank.filter((question) => {
      const matchesSection = section === "all" || question.section === section;
      const matchesDifficulty = difficulty === "all" || question.difficulty === difficulty;
      const matchesType = type === "all" || question.type === type;
      return matchesSection && matchesDifficulty && matchesType;
    });
  }, [questionBank, section, difficulty, type]);

  const columns: ColumnDef<QuestionRow>[] = [
    { header: "Question", accessor: "title" },
    { header: "Section", accessor: "section" },
    {
      header: "Difficulty",
      cell: (row) => <span className="capitalize">{row.difficulty}</span>,
    },
    {
      header: "Type",
      cell: (row) => <span className="uppercase">{row.type}</span>,
    },
    {
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to={`/admin/question-bank/${row.id}`}>Edit</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/admin/question-bank/${row.id}`}>Preview</Link>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Questions"
        subtitle="Manage the question bank and imports."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              Import Questions
            </Button>
            <Button asChild>
              <Link to="/questions/new">Add Question</Link>
            </Button>
          </>
        }
      />

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={section} onValueChange={setSection}>
            <SelectTrigger className="sm:w-44">
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sections</SelectItem>
              <SelectItem value="Data Structures">Data Structures</SelectItem>
              <SelectItem value="Algorithms">Algorithms</SelectItem>
              <SelectItem value="Database">Database</SelectItem>
            </SelectContent>
          </Select>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="sm:w-44">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Difficulties</SelectItem>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="sm:w-44">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="mcq">MCQ</SelectItem>
              <SelectItem value="true-false">True/False</SelectItem>
              <SelectItem value="short">Short Answer</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Search questions" className="sm:max-w-xs" />
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading questions…</div>
          ) : (
            <DataTable columns={columns} data={filtered} emptyMessage="No questions match the filters." />
          )}
        </div>
      </div>

      <Modal
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import Questions"
        description="Upload CSV or Excel files to import questions."
        footer={
          <>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button>Upload</Button>
          </>
        }
      >
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Drag & drop files here, or click to browse.
        </div>
      </Modal>
    </div>
  );
}
