import PageHeader from "@/components/admin/PageHeader";
import FormField from "@/components/admin/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function QuestionCreatePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Add New Question"
        subtitle="Create a question and add it to the bank."
        actions={
          <>
            <Button variant="outline">Cancel</Button>
            <Button>Save Question</Button>
          </>
        }
      />

      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <FormField label="Question Type" required>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select question type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mcq">MCQ</SelectItem>
                <SelectItem value="true-false">True/False</SelectItem>
                <SelectItem value="short">Short Answer</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Section" required>
            <div className="flex flex-wrap gap-2">
              <Select>
                <SelectTrigger className="min-w-[200px]">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ds">Data Structures</SelectItem>
                  <SelectItem value="algo">Algorithms</SelectItem>
                  <SelectItem value="db">Database</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">Add new section</Button>
            </div>
          </FormField>
        </div>

        <FormField label="Question" required hint="Use the editor to format the question content.">
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
            Rich text editor placeholder
          </div>
        </FormField>

        <FormField label="Answers" required hint="Select the correct option.">
          <RadioGroup className="space-y-3">
            {["A", "B", "C"].map((label) => (
              <label key={label} className="flex items-center gap-3 rounded-lg border p-3">
                <RadioGroupItem value={label} />
                <Input placeholder={`Answer ${label}`} />
              </label>
            ))}
          </RadioGroup>
        </FormField>

        <FormField label="Source Code" hint="Optional code snippet for programming questions.">
          <Textarea rows={6} placeholder="Paste source code here..." />
        </FormField>
      </div>
    </div>
  );
}
