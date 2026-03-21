import { useParams } from "react-router-dom";
import QuestionBankForm from "./QuestionBankForm";

export default function QuestionBankEditPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <QuestionBankForm mode="edit" questionId={id} />;
}
