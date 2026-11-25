export const metadata = { title: 'Privacy (beta draft)' };

export default function Privacy() {
  return <div className="landing"><article className="legal-content">
    <p className="eyebrow">BETA DRAFT · NOT YET LEGALLY REVIEWED</p>
    <h1 className="page-title">Privacy notice</h1>
    <p className="notice warning">Working draft for the beta. Subprocessors, regions and retention periods must be confirmed and legally reviewed before paid launch.</p>
    <h2>What we collect</h2><p>Your email address for sign-in; the projects, briefs and files you upload; generated outputs; credit and payment records (we never see or store card details — payments are handled by the payment provider); and support messages.</p>
    <h2>How files are protected</h2><p>Uploads and outputs are stored privately and shared only through short-lived signed links to members of your workspace. They are never used in a public gallery, in analytics or in session recordings.</p>
    <h2>Who processes your data</h2><p>Planned processors: an authentication and database provider, private object storage, AI analysis and generation providers under paid data-processing terms, and a payment provider. The final list will be published here before launch.</p>
    <h2>Retention and deletion</h2><p>Proposed: source uploads up to 30 days, outputs up to 90 days, deletion within 30 days of a request unless the law requires us to keep records (for example payment records).</p>
    <h2>Your choices</h2><p>You can delete projects from your workspace and contact support to export or delete your data.</p>
  </article></div>;
}
