import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Plus,
  Trash2,
  FileText,
  Settings,
  Eye,
  Upload,
  Calendar,
  Clock,
  Users,
  Download,
  Search,
  SlidersHorizontal,
  MoreHorizontal,
} from "lucide-react";
import LogoMark from "@/components/LogoMark";
import BrandText from "@/components/BrandText";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAdminExams, getExamReport } from "@/lib/api";
import type { ExamReportSummary } from "@/lib/types";

const steps = [
  { id: "details", label: "Details" },
  { id: "questions", label: "Questions" },
  { id: "proctoring", label: "Proctoring Rules" },
  { id: "review", label: "Review" },
];

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("exams");
  const [showWizard, setShowWizard] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [reportExamId, setReportExamId] = useState("all");
  const { data: exams = [], isLoading: examsLoading } = useQuery({
    queryKey: ["admin", "exams"],
    queryFn: getAdminExams,
  });
  const { data: reportSummary } = useQuery({
    queryKey: ["admin", "reports", reportExamId],
    queryFn: () => getExamReport(reportExamId),
  });
  const reportData: ExamReportSummary = reportSummary ?? {
    totalStudents: 0,
    passed: 0,
    flagged: 0,
    violations: 0,
    rows: [],
  };
  const [examDetails, setExamDetails] = useState({
    name: "",
    description: "",
    duration: 60,
    date: "",
    time: "",
  });
  const [questions, setQuestions] = useState<Question[]>([
    { id: "1", text: "Sample question 1?", options: ["Option A", "Option B", "Option C", "Option D"], correctAnswer: 0 },
  ]);
  const [proctoringRules, setProctoringRules] = useState({
    tabSwitchEnabled: true,
    tabSwitchThreshold: 3,
    multipleFacesEnabled: true,
    gazeAwayEnabled: true,
    gazeAwayThreshold: 30,
    noiseEnabled: true,
    noiseThreshold: 50,
    screenRecording: true,
  });

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { id: Date.now().toString(), text: "", options: ["", "", "", ""], correctAnswer: 0 },
    ]);
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="success">Active</Badge>;
      case "scheduled":
        return <Badge variant="secondary">Scheduled</Badge>;
      case "completed":
        return <Badge variant="outline">Completed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (showWizard) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card sticky top-0 z-40">
          <div className="container mx-auto flex h-16 items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <LogoMark className="h-8 w-8" />
                <BrandText className="font-bold text-xl" />
              </div>
              <Badge variant="secondary">Admin</Badge>
            </div>
            <Button variant="ghost" onClick={() => setShowWizard(false)}>
              Cancel
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-6 py-8 max-w-4xl">
          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        index < currentStep
                          ? "bg-success text-success-foreground"
                          : index === currentStep
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {index < currentStep ? <Check className="h-4 w-4" /> : index + 1}
                    </div>
                    <span
                      className={`text-sm ${
                        index <= currentStep ? "font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="flex-1 h-px bg-border mx-4 min-w-[40px]" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="exam-card p-6">
            {currentStep === 0 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Exam Details</h2>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Exam Name</Label>
                    <Input
                      id="name"
                      value={examDetails.name}
                      onChange={(e) => setExamDetails({ ...examDetails, name: e.target.value })}
                      placeholder="e.g., Introduction to Computer Science"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={examDetails.description}
                      onChange={(e) => setExamDetails({ ...examDetails, description: e.target.value })}
                      placeholder="Brief description of the exam..."
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration (minutes)</Label>
                      <Input
                        id="duration"
                        type="number"
                        value={examDetails.duration}
                        onChange={(e) => setExamDetails({ ...examDetails, duration: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={examDetails.date}
                        onChange={(e) => setExamDetails({ ...examDetails, date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="time">Time</Label>
                      <Input
                        id="time"
                        type="time"
                        value={examDetails.time}
                        onChange={(e) => setExamDetails({ ...examDetails, time: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Questions</h2>
                  <div className="flex gap-2">
                    <Button variant="outline">
                      <Upload className="h-4 w-4 mr-2" />
                      Import CSV
                    </Button>
                    <Button onClick={addQuestion}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Question
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {questions.map((question, qIndex) => (
                    <div key={question.id} className="p-4 border rounded-lg space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <Label>Question {qIndex + 1}</Label>
                          <Textarea
                            value={question.text}
                            onChange={(e) => {
                              const updated = [...questions];
                              updated[qIndex].text = e.target.value;
                              setQuestions(updated);
                            }}
                            placeholder="Enter your question..."
                            rows={2}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeQuestion(question.id)}
                        >
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {question.options.map((option, oIndex) => (
                          <div key={oIndex} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${question.id}`}
                              checked={question.correctAnswer === oIndex}
                              onChange={() => {
                                const updated = [...questions];
                                updated[qIndex].correctAnswer = oIndex;
                                setQuestions(updated);
                              }}
                              className="h-4 w-4"
                            />
                            <Input
                              value={option}
                              onChange={(e) => {
                                const updated = [...questions];
                                updated[qIndex].options[oIndex] = e.target.value;
                                setQuestions(updated);
                              }}
                              placeholder={`Option ${String.fromCharCode(65 + oIndex)}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Proctoring Rules</h2>
                <p className="text-muted-foreground">
                  Configure AI monitoring sensitivity and rules for this exam.
                </p>

                <div className="space-y-6">
                  {/* Tab Switch */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-base">Tab Switch Detection</Label>
                      <p className="text-sm text-muted-foreground">
                        Log when candidates switch browser tabs
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      {proctoringRules.tabSwitchEnabled && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Max:</span>
                          <Input
                            type="number"
                            value={proctoringRules.tabSwitchThreshold}
                            onChange={(e) =>
                              setProctoringRules({
                                ...proctoringRules,
                                tabSwitchThreshold: parseInt(e.target.value),
                              })
                            }
                            className="w-16"
                          />
                        </div>
                      )}
                      <Switch
                        checked={proctoringRules.tabSwitchEnabled}
                        onCheckedChange={(checked) =>
                          setProctoringRules({ ...proctoringRules, tabSwitchEnabled: checked })
                        }
                      />
                    </div>
                  </div>

                  {/* Multiple Faces */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-base">Multiple Faces Detection</Label>
                      <p className="text-sm text-muted-foreground">
                        Alert when more than one face is detected in frame
                      </p>
                    </div>
                    <Switch
                      checked={proctoringRules.multipleFacesEnabled}
                      onCheckedChange={(checked) =>
                        setProctoringRules({ ...proctoringRules, multipleFacesEnabled: checked })
                      }
                    />
                  </div>

                  {/* Gaze Away */}
                  <div className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-base">Gaze Away Detection</Label>
                        <p className="text-sm text-muted-foreground">
                          Log when candidates look away from screen
                        </p>
                      </div>
                      <Switch
                        checked={proctoringRules.gazeAwayEnabled}
                        onCheckedChange={(checked) =>
                          setProctoringRules({ ...proctoringRules, gazeAwayEnabled: checked })
                        }
                      />
                    </div>
                    {proctoringRules.gazeAwayEnabled && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Threshold (seconds)</span>
                          <span>{proctoringRules.gazeAwayThreshold}s</span>
                        </div>
                        <Slider
                          value={[proctoringRules.gazeAwayThreshold]}
                          onValueChange={(value) =>
                            setProctoringRules({ ...proctoringRules, gazeAwayThreshold: value[0] })
                          }
                          max={60}
                          min={5}
                          step={5}
                        />
                      </div>
                    )}
                  </div>

                  {/* Noise */}
                  <div className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label className="text-base">Background Noise Detection</Label>
                        <p className="text-sm text-muted-foreground">
                          Monitor for conversations or unusual sounds
                        </p>
                      </div>
                      <Switch
                        checked={proctoringRules.noiseEnabled}
                        onCheckedChange={(checked) =>
                          setProctoringRules({ ...proctoringRules, noiseEnabled: checked })
                        }
                      />
                    </div>
                    {proctoringRules.noiseEnabled && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Sensitivity</span>
                          <span>{proctoringRules.noiseThreshold}%</span>
                        </div>
                        <Slider
                          value={[proctoringRules.noiseThreshold]}
                          onValueChange={(value) =>
                            setProctoringRules({ ...proctoringRules, noiseThreshold: value[0] })
                          }
                          max={100}
                          min={10}
                          step={10}
                        />
                      </div>
                    )}
                  </div>

                  {/* Screen Recording */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-base">Screen Recording</Label>
                      <p className="text-sm text-muted-foreground">
                        Record candidate's screen during exam
                      </p>
                    </div>
                    <Switch
                      checked={proctoringRules.screenRecording}
                      onCheckedChange={(checked) =>
                        setProctoringRules({ ...proctoringRules, screenRecording: checked })
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Review & Publish</h2>

                <div className="grid gap-4">
                  <div className="p-4 bg-secondary rounded-lg">
                    <h3 className="font-medium mb-2">Exam Details</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Name:</span>
                      <span>{examDetails.name || "Not set"}</span>
                      <span className="text-muted-foreground">Duration:</span>
                      <span>{examDetails.duration} minutes</span>
                      <span className="text-muted-foreground">Date:</span>
                      <span>{examDetails.date || "Not set"}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-secondary rounded-lg">
                    <h3 className="font-medium mb-2">Questions</h3>
                    <p className="text-sm">
                      {questions.length} questions configured
                    </p>
                  </div>

                  <div className="p-4 bg-secondary rounded-lg">
                    <h3 className="font-medium mb-2">Proctoring Rules</h3>
                    <div className="flex flex-wrap gap-2">
                      {proctoringRules.tabSwitchEnabled && (
                        <Badge variant="secondary">Tab Switch Detection</Badge>
                      )}
                      {proctoringRules.multipleFacesEnabled && (
                        <Badge variant="secondary">Multiple Faces</Badge>
                      )}
                      {proctoringRules.gazeAwayEnabled && (
                        <Badge variant="secondary">Gaze Detection</Badge>
                      )}
                      {proctoringRules.noiseEnabled && (
                        <Badge variant="secondary">Noise Detection</Badge>
                      )}
                      {proctoringRules.screenRecording && (
                        <Badge variant="secondary">Screen Recording</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            {currentStep < steps.length - 1 ? (
              <Button onClick={() => setCurrentStep(currentStep + 1)}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={() => setShowWizard(false)}>
                <Check className="h-4 w-4 mr-2" />
                Publish Exam
              </Button>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <LogoMark className="h-8 w-8" />
              <BrandText className="font-bold text-xl" />
            </div>
            <Badge variant="secondary">Admin</Badge>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between mb-6">
            <TabsList>
              <TabsTrigger value="exams" className="gap-2">
                <FileText className="h-4 w-4" />
                Exams
              </TabsTrigger>
              <TabsTrigger value="reports" className="gap-2">
                <Eye className="h-4 w-4" />
                Reports
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            <Button onClick={() => setShowWizard(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Exam
            </Button>
          </div>

          <TabsContent value="exams">
            <div className="exam-card">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search exams..." className="pl-9 w-64" />
                  </div>
                  <Select defaultValue="all">
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {examsLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Loading exams...
                      </TableCell>
                    </TableRow>
                  )}
                  {!examsLoading && exams.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No exams found
                      </TableCell>
                    </TableRow>
                  )}
                  {exams.map((exam) => (
                    <TableRow key={exam.id}>
                      <TableCell className="font-medium">{exam.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {exam.date}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {exam.duration}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="h-4 w-4" />
                          {exam.students}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(exam.status)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Edit</DropdownMenuItem>
                            <DropdownMenuItem>View Results</DropdownMenuItem>
                            <DropdownMenuItem>Duplicate</DropdownMenuItem>
                            <DropdownMenuItem className="text-danger">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="reports">
            <div className="exam-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Exam Reports</h2>
                <div className="flex gap-2">
                  <Select value={reportExamId} onValueChange={setReportExamId}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select exam" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Exams</SelectItem>
                      {exams.map((exam) => (
                        <SelectItem key={exam.id} value={exam.id}>
                          {exam.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export Report
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-secondary rounded-lg text-center">
                  <p className="text-3xl font-bold">{reportData.totalStudents}</p>
                  <p className="text-sm text-muted-foreground">Total Students</p>
                </div>
                <div className="p-4 bg-success-light rounded-lg text-center">
                  <p className="text-3xl font-bold text-success">{reportData.passed}</p>
                  <p className="text-sm text-muted-foreground">Passed</p>
                </div>
                <div className="p-4 bg-warning-light rounded-lg text-center">
                  <p className="text-3xl font-bold text-warning">{reportData.flagged}</p>
                  <p className="text-sm text-muted-foreground">Flagged</p>
                </div>
                <div className="p-4 bg-danger-light rounded-lg text-center">
                  <p className="text-3xl font-bold text-danger">{reportData.violations}</p>
                  <p className="text-sm text-muted-foreground">Violations</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>AI Events</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {reportData.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No report data available
                    </TableCell>
                  </TableRow>
                )}
                {reportData.rows.map((row, index) => (
                  <TableRow key={`${row.student}-${index}`}>
                      <TableCell>{row.student}</TableCell>
                      <TableCell>{row.exam}</TableCell>
                      <TableCell>{row.score}</TableCell>
                      <TableCell>{row.aiEvents}</TableCell>
                      <TableCell>
                        {row.status === "Passed" && (
                          <Badge variant="success-light">Passed</Badge>
                        )}
                        {row.status === "Review" && (
                          <Badge variant="warning-light">Review</Badge>
                        )}
                        {row.status === "Flagged" && (
                          <Badge variant="danger-light">Flagged</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="exam-card p-6">
              <h2 className="text-xl font-semibold mb-6">Global Settings</h2>
              <p className="text-muted-foreground">
                Configure default proctoring settings and organization preferences.
              </p>
              <div className="mt-6 p-8 bg-secondary rounded-lg text-center">
                <Settings className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Settings panel would appear here</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}


