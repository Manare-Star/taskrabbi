import { LegalDocumentView } from "../../components/LegalDocumentView";
import { PRIVACY } from "../../lib/legal";

export default function PrivacyScreen() {
  return <LegalDocumentView document={PRIVACY} />;
}
