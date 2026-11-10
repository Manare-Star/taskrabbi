import { LegalDocumentView } from "../../components/LegalDocumentView";
import { TERMS } from "../../lib/legal";

export default function TermsScreen() {
  return <LegalDocumentView document={TERMS} />;
}
